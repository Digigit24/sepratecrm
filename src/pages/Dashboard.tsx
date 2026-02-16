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
  isToday,
} from 'date-fns';

const generateChartData = () => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months.map((month, i) => ({
    name: month,
    leads: Math.floor(20 + Math.sin(i * 0.8) * 15 + i * 3),
  }));
};

const Dashboard = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const navigate = useNavigate();
  const [calendarDate, setCalendarDate] = useState(new Date());

  const { useLeads, useLeadStatuses } = useCRM();

  const { data: leadsData, isLoading: leadsLoading } = useLeads({ page: 1, page_size: 1 });
  const { data: statusesData } = useLeadStatuses({ page_size: 100, ordering: 'order_index', is_active: true });

  const totalLeads = leadsData?.count || 0;
  const statuses = statusesData?.results || [];

  const wonStatusIds = useMemo(() => {
    return statuses.filter(s => s.is_won).map(s => s.id);
  }, [statuses]);

  const chartData = useMemo(() => generateChartData(), []);

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

  const cardBase = isDark
    ? 'rounded-xl border border-gray-800 bg-gray-900'
    : 'rounded-xl border border-gray-200 bg-white';

  const labelText = isDark ? 'text-gray-500' : 'text-gray-400';
  const valueText = isDark ? 'text-gray-100' : 'text-gray-900';
  const headingText = isDark ? 'text-gray-200' : 'text-gray-700';
  const subtleText = isDark ? 'text-gray-500' : 'text-gray-400';
  const iconBg = isDark ? 'bg-gray-800' : 'bg-gray-50';
  const iconColor = isDark ? 'text-gray-400' : 'text-gray-400';

  const navItems = [
    { label: 'Leads', desc: 'Manage sales pipeline', icon: Target, path: '/crm/leads' },
    { label: 'Tasks', desc: 'Track CRM tasks', icon: CheckCircle2, path: '/crm/tasks' },
    { label: 'WhatsApp', desc: 'Chats & messaging', icon: MessageCircle, path: '/whatsapp/chats' },
    { label: 'Meetings', desc: 'Scheduled meetings', icon: CalendarClock, path: '/crm/meetings' },
  ];

  return (
    <div className={`flex-1 p-5 overflow-auto ${isDark ? 'bg-gray-950' : 'bg-gray-50/50'}`}>
      <div className="max-w-7xl mx-auto space-y-5">

        {/* Header */}
        <div>
          <h1 className={`text-lg font-semibold ${valueText}`}>Dashboard</h1>
          <p className={`text-[11px] mt-0.5 ${subtleText}`}>
            Welcome back! Here's your CRM overview.
          </p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className={`${cardBase} p-4`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-[11px] font-medium tracking-wide uppercase ${labelText}`}>Total Leads</p>
                {leadsLoading ? (
                  <Loader2 className={`w-4 h-4 mt-2 animate-spin ${labelText}`} />
                ) : (
                  <p className={`text-xl font-semibold mt-1 ${valueText}`}>{totalLeads.toLocaleString()}</p>
                )}
              </div>
              <div className={`p-2 rounded-lg ${iconBg}`}>
                <Users className={`w-4 h-4 ${iconColor}`} />
              </div>
            </div>
          </div>

          <div className={`${cardBase} p-4`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-[11px] font-medium tracking-wide uppercase ${labelText}`}>Active Statuses</p>
                <p className={`text-xl font-semibold mt-1 ${valueText}`}>{statuses.length}</p>
              </div>
              <div className={`p-2 rounded-lg ${iconBg}`}>
                <BarChart3 className={`w-4 h-4 ${iconColor}`} />
              </div>
            </div>
          </div>

          <div className={`${cardBase} p-4`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-[11px] font-medium tracking-wide uppercase ${labelText}`}>Won Statuses</p>
                <p className={`text-xl font-semibold mt-1 ${valueText}`}>{wonStatusIds.length}</p>
              </div>
              <div className={`p-2 rounded-lg ${iconBg}`}>
                <Zap className={`w-4 h-4 ${iconColor}`} />
              </div>
            </div>
          </div>

          <div className={`${cardBase} p-4`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-[11px] font-medium tracking-wide uppercase ${labelText}`}>Pipeline Stages</p>
                <p className={`text-xl font-semibold mt-1 ${valueText}`}>{statuses.filter(s => !s.is_won).length}</p>
              </div>
              <div className={`p-2 rounded-lg ${iconBg}`}>
                <Clock className={`w-4 h-4 ${iconColor}`} />
              </div>
            </div>
          </div>
        </div>

        {/* Chart + Calendar */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
          {/* Area Chart */}
          <div className={`${cardBase} p-4 lg:col-span-3`}>
            <h2 className={`text-xs font-semibold mb-4 ${headingText}`}>Leads Overview</h2>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="leadsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={isDark ? '#6366f1' : '#818cf8'} stopOpacity={0.15} />
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
                      borderRadius: 8,
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
                    strokeWidth={1.5}
                    fill="url(#leadsFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Calendar */}
          <div className={`${cardBase} p-4 lg:col-span-2`}>
            <div className="flex items-center justify-between mb-3">
              <h2 className={`text-xs font-semibold ${headingText}`}>
                {format(calendarDate, 'MMMM yyyy')}
              </h2>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCalendarDate(subMonths(calendarDate, 1))}
                  className={`p-1 rounded ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}
                >
                  <ChevronLeft className={`w-3.5 h-3.5 ${subtleText}`} />
                </button>
                <button
                  onClick={() => setCalendarDate(addMonths(calendarDate, 1))}
                  className={`p-1 rounded ${isDark ? 'hover:bg-gray-800' : 'hover:bg-gray-100'}`}
                >
                  <ChevronRight className={`w-3.5 h-3.5 ${subtleText}`} />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-0">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                <div key={d} className={`text-center text-[10px] font-medium py-1.5 ${subtleText}`}>
                  {d}
                </div>
              ))}
              {calendarDays.map((day, i) => {
                const inMonth = isSameMonth(day, calendarDate);
                const today = isToday(day);
                return (
                  <div
                    key={i}
                    className={`text-center py-1.5 text-[11px] rounded-md ${
                      !inMonth
                        ? isDark ? 'text-gray-700' : 'text-gray-300'
                        : today
                          ? 'bg-gray-900 text-white font-medium dark:bg-indigo-600'
                          : isDark ? 'text-gray-300' : 'text-gray-600'
                    }`}
                  >
                    {format(day, 'd')}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Quick Navigation */}
        <div>
          <h2 className={`text-xs font-semibold mb-3 ${headingText}`}>Quick Navigation</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {navItems.map((item) => (
              <div
                key={item.label}
                onClick={() => navigate(item.path)}
                className={`${cardBase} p-3 cursor-pointer group transition-colors ${
                  isDark ? 'hover:border-gray-700 hover:bg-gray-800/50' : 'hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-1.5 rounded-md ${iconBg}`}>
                      <item.icon className={`w-3.5 h-3.5 ${isDark ? 'text-gray-400' : 'text-gray-500'}`} />
                    </div>
                    <div>
                      <p className={`text-xs font-medium ${isDark ? 'text-gray-200' : 'text-gray-800'}`}>
                        {item.label}
                      </p>
                      <p className={`text-[10px] mt-0.5 ${subtleText}`}>
                        {item.desc}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className={`w-3 h-3 transition-transform group-hover:translate-x-0.5 ${
                    isDark ? 'text-gray-600' : 'text-gray-300'
                  }`} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Pipeline Overview */}
        {statuses.length > 0 && (
          <div className={`${cardBase} p-4`}>
            <h2 className={`text-xs font-semibold mb-3 ${headingText}`}>Pipeline Overview</h2>
            <div className="flex flex-wrap gap-2">
              {statuses.map((status) => (
                <div
                  key={status.id}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium border ${
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
                    <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-50 text-emerald-600 font-medium">
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
