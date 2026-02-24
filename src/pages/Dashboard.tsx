import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import {
  Users,
  Loader2,
  ArrowRight,
  MessageCircle,
  Target,
  CalendarClock,
  BarChart3,
  CheckCircle2,
  Clock,
  Zap,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
} from 'date-fns';

// Generate chart data from a sinusoidal pattern
const generateChartData = () => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months.map((month, i) => ({
    name: month,
    leads: Math.floor(20 + Math.sin(i * 0.8) * 15 + i * 3),
  }));
};

const Dashboard = () => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const navigate = useNavigate();
  const [calendarDate, setCalendarDate] = useState(new Date());

  const { useLeads, useLeadStatuses, useTasks } = useCRM();

  // Existing data hooks
  const { data: leadsData, isLoading: leadsLoading } = useLeads({ page: 1, page_size: 1 });
  const { data: statusesData } = useLeadStatuses({ page_size: 100, ordering: 'order_index', is_active: true });

  // Fetch leads with follow-ups for calendar
  const calendarMonthStart = format(startOfMonth(calendarDate), 'yyyy-MM-dd');
  const calendarMonthEnd = format(endOfMonth(calendarDate), 'yyyy-MM-dd');

  const { data: followUpLeads } = useLeads({
    page: 1,
    page_size: 100,
    next_follow_up_at__gte: calendarMonthStart,
    next_follow_up_at__lte: calendarMonthEnd,
    next_follow_up_at__isnull: false,
  });

  // Fetch tasks with due dates for calendar
  const { data: tasksData } = useTasks({
    page: 1,
    page_size: 100,
  });

  const totalLeads = leadsData?.count || 0;
  const statuses = statusesData?.results || [];

  const wonStatusIds = useMemo(() => {
    return statuses.filter(s => s.is_won).map(s => s.id);
  }, [statuses]);

  const chartData = useMemo(() => generateChartData(), []);

  // Build a map of dates with events for the calendar
  const eventDates = useMemo(() => {
    const dateMap: Record<string, { followups: number; tasks: number }> = {};

    // Add follow-up dates
    if (followUpLeads?.results) {
      for (const lead of followUpLeads.results) {
        if (lead.next_follow_up_at) {
          const dateKey = format(parseISO(lead.next_follow_up_at), 'yyyy-MM-dd');
          if (!dateMap[dateKey]) dateMap[dateKey] = { followups: 0, tasks: 0 };
          dateMap[dateKey].followups++;
        }
      }
    }

    // Add task due dates
    if (tasksData?.results) {
      for (const task of tasksData.results) {
        if (task.due_date) {
          const dateKey = format(parseISO(task.due_date), 'yyyy-MM-dd');
          if (!dateMap[dateKey]) dateMap[dateKey] = { followups: 0, tasks: 0 };
          dateMap[dateKey].tasks++;
        }
      }
    }

    return dateMap;
  }, [followUpLeads, tasksData]);

  // Calendar grid
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(calendarDate);
    const monthEnd = endOfMonth(calendarDate);
    const start = startOfWeek(monthStart);
    const end = endOfWeek(monthEnd);
    const days: Date[] = [];
    let day = start;
    while (day <= end) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [calendarDate]);

  // Navigation items
  const navItems = [
    { label: 'Leads', icon: Target, path: '/crm/leads' },
    { label: 'Tasks', icon: CheckCircle2, path: '/crm/tasks' },
    { label: 'WhatsApp', icon: MessageCircle, path: '/whatsapp/chats' },
    { label: 'Meetings', icon: CalendarClock, path: '/crm/meetings' },
  ];

  const stats = [
    { label: 'Total Leads', value: totalLeads.toLocaleString(), icon: Users, loading: leadsLoading },
    { label: 'Active Statuses', value: statuses.length, icon: BarChart3, loading: false },
    { label: 'Won', value: wonStatusIds.length, icon: Zap, loading: false },
    { label: 'Pipeline', value: statuses.filter(s => !s.is_won).length, icon: Clock, loading: false },
  ];

  return (
    <div className={`flex-1 p-4 overflow-auto ${isDark ? 'bg-gray-950' : 'bg-gray-50/80'}`}>
      <div className="space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className={`text-base font-semibold ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
            Dashboard
          </h1>
          <div className="flex items-center gap-1.5">
            {navItems.map((item) => (
              <button
                key={item.label}
                onClick={() => navigate(item.path)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  isDark
                    ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
                }`}
              >
                <item.icon className="w-3.5 h-3.5" />
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* Inline Stats Row */}
        <div className="flex items-center gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className="flex items-center gap-2">
              <stat.icon className={`w-3.5 h-3.5 ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
              <span className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>{stat.label}</span>
              {stat.loading ? (
                <Loader2 className={`w-3 h-3 animate-spin ${isDark ? 'text-gray-600' : 'text-gray-300'}`} />
              ) : (
                <span className={`text-sm font-semibold ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                  {stat.value}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Chart + Calendar */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
          {/* Area Chart */}
          <div className={`rounded-lg border p-4 lg:col-span-3 ${
            isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
          }`}>
            <h2 className={`text-xs font-medium mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Leads Overview
            </h2>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="leadsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={isDark ? '#6366f1' : '#818cf8'} stopOpacity={0.2} />
                      <stop offset="100%" stopColor={isDark ? '#6366f1' : '#818cf8'} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={isDark ? '#1f2937' : '#f3f4f6'}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: isDark ? '#6b7280' : '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: isDark ? '#6b7280' : '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      fontSize: 11,
                      borderRadius: 6,
                      border: isDark ? '1px solid #374151' : '1px solid #e5e7eb',
                      backgroundColor: isDark ? '#111827' : '#ffffff',
                      color: isDark ? '#e5e7eb' : '#374151',
                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="leads"
                    stroke={isDark ? '#6366f1' : '#818cf8'}
                    strokeWidth={2}
                    fill="url(#leadsFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Calendar */}
          <div className={`rounded-lg border p-4 lg:col-span-2 ${
            isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
          }`}>
            <div className="flex items-center justify-between mb-3">
              <h2 className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                {format(calendarDate, 'MMMM yyyy')}
              </h2>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => setCalendarDate(subMonths(calendarDate, 1))}
                  className={`p-1 rounded ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}
                >
                  <ChevronLeft className={`w-3.5 h-3.5 ${isDark ? 'text-gray-400' : 'text-gray-400'}`} />
                </button>
                <button
                  onClick={() => setCalendarDate(addMonths(calendarDate, 1))}
                  className={`p-1 rounded ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}
                >
                  <ChevronRight className={`w-3.5 h-3.5 ${isDark ? 'text-gray-400' : 'text-gray-400'}`} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-0">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                <div key={d} className={`text-center text-[10px] font-medium py-1.5 ${
                  isDark ? 'text-gray-500' : 'text-gray-400'
                }`}>
                  {d}
                </div>
              ))}
              {calendarDays.map((day, i) => {
                const inMonth = isSameMonth(day, calendarDate);
                const today = isToday(day);
                const dateKey = format(day, 'yyyy-MM-dd');
                const events = eventDates[dateKey];

                return (
                  <div
                    key={i}
                    className="flex flex-col items-center py-0.5"
                  >
                    <div
                      className={`w-7 h-7 flex items-center justify-center rounded-md text-[11px] ${
                        !inMonth
                          ? isDark ? 'text-gray-700' : 'text-gray-300'
                          : today
                            ? isDark
                              ? 'bg-indigo-600 text-white font-semibold'
                              : 'bg-gray-900 text-white font-semibold'
                            : isDark ? 'text-gray-300' : 'text-gray-700'
                      }`}
                    >
                      {format(day, 'd')}
                    </div>
                    {/* Event dots */}
                    {inMonth && events && (
                      <div className="flex items-center gap-0.5 mt-0.5">
                        {events.followups > 0 && (
                          <div className="w-1 h-1 rounded-full bg-indigo-500" title={`${events.followups} follow-up(s)`} />
                        )}
                        {events.tasks > 0 && (
                          <div className="w-1 h-1 rounded-full bg-amber-500" title={`${events.tasks} task(s)`} />
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Calendar legend */}
            <div className={`flex items-center gap-3 mt-2 pt-2 border-t ${
              isDark ? 'border-gray-800' : 'border-gray-100'
            }`}>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                <span className={`text-[10px] ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Follow-ups</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span className={`text-[10px] ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>Tasks</span>
              </div>
            </div>
          </div>
        </div>

        {/* Pipeline Overview */}
        {statuses.length > 0 && (
          <div className={`rounded-lg border p-3 ${
            isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'
          }`}>
            <h2 className={`text-xs font-medium mb-2 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
              Pipeline
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {statuses.map((status) => (
                <div
                  key={status.id}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium border ${
                    isDark ? 'border-gray-800 bg-gray-800/50' : 'border-gray-100 bg-gray-50'
                  }`}
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: status.color_hex || '#6B7280' }}
                  />
                  <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>
                    {status.name}
                  </span>
                  {status.is_won && (
                    <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-50 text-emerald-600 font-medium dark:bg-emerald-950 dark:text-emerald-400">
                      Won
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default Dashboard;
