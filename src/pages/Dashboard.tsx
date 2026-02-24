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
  CheckCircle2,
  Clock,
  Zap,
  ChevronLeft,
  ChevronRight,
  Phone,
  Mail,
  FileText,
  MessageSquare,
  CircleDot,
  AlertTriangle,
} from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { useMeeting } from '@/hooks/useMeeting';
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
  isPast,
  parseISO,
  formatDistanceToNow,
} from 'date-fns';
import type { LeadStatus } from '@/types/crmTypes';

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

  const { useLeads, useLeadStatuses, useTasks, useLeadActivities } = useCRM();
  const { useUpcomingMeetings } = useMeeting();

  // --- Data hooks ---
  const { data: leadsData, isLoading: leadsLoading } = useLeads({ page: 1, page_size: 1 });
  const { data: statusesData } = useLeadStatuses({ page_size: 100, ordering: 'order_index', is_active: true });

  // Recent leads (latest 5)
  const { data: recentLeadsData } = useLeads({ page: 1, page_size: 5, ordering: '-created_at' });

  // Leads by priority
  const { data: highPriorityData } = useLeads({ page: 1, page_size: 1, priority: 'HIGH' });
  const { data: medPriorityData } = useLeads({ page: 1, page_size: 1, priority: 'MEDIUM' });
  const { data: lowPriorityData } = useLeads({ page: 1, page_size: 1, priority: 'LOW' });

  // Tasks
  const { data: allTasksData } = useTasks({ page: 1, page_size: 5, ordering: 'due_date' });
  const { data: openTasksData } = useTasks({ page: 1, page_size: 1, status: 'TODO' });
  const { data: inProgressTasksData } = useTasks({ page: 1, page_size: 1, status: 'IN_PROGRESS' });

  // Recent activities
  const { data: activitiesData } = useLeadActivities({ page: 1, page_size: 6, ordering: '-happened_at' });

  // Upcoming meetings
  const { data: upcomingMeetingsData } = useUpcomingMeetings({ page: 1, page_size: 5 });

  // Calendar follow-ups + tasks
  const calendarMonthStart = format(startOfMonth(calendarDate), 'yyyy-MM-dd');
  const calendarMonthEnd = format(endOfMonth(calendarDate), 'yyyy-MM-dd');
  const { data: followUpLeads } = useLeads({
    page: 1, page_size: 100,
    next_follow_up_at__gte: calendarMonthStart,
    next_follow_up_at__lte: calendarMonthEnd,
    next_follow_up_at__isnull: false,
  });
  const { data: calendarTasksData } = useTasks({ page: 1, page_size: 100 });

  // --- Computed values ---
  const totalLeads = leadsData?.count || 0;
  const statuses = statusesData?.results || [];
  const recentLeads = recentLeadsData?.results || [];
  const tasks = allTasksData?.results || [];
  const activities = activitiesData?.results || [];
  const upcomingMeetings = upcomingMeetingsData?.results || [];

  const wonStatusIds = useMemo(() => statuses.filter(s => s.is_won).map(s => s.id), [statuses]);
  const chartData = useMemo(() => generateChartData(), []);

  // Calendar event dates
  const eventDates = useMemo(() => {
    const dateMap: Record<string, { followups: number; tasks: number }> = {};
    if (followUpLeads?.results) {
      for (const lead of followUpLeads.results) {
        if (lead.next_follow_up_at) {
          const dateKey = format(parseISO(lead.next_follow_up_at), 'yyyy-MM-dd');
          if (!dateMap[dateKey]) dateMap[dateKey] = { followups: 0, tasks: 0 };
          dateMap[dateKey].followups++;
        }
      }
    }
    if (calendarTasksData?.results) {
      for (const task of calendarTasksData.results) {
        if (task.due_date) {
          const dateKey = format(parseISO(task.due_date), 'yyyy-MM-dd');
          if (!dateMap[dateKey]) dateMap[dateKey] = { followups: 0, tasks: 0 };
          dateMap[dateKey].tasks++;
        }
      }
    }
    return dateMap;
  }, [followUpLeads, calendarTasksData]);

  // Calendar grid
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(calendarDate);
    const monthEnd = endOfMonth(calendarDate);
    const start = startOfWeek(monthStart);
    const end = endOfWeek(monthEnd);
    const days: Date[] = [];
    let day = start;
    while (day <= end) { days.push(day); day = addDays(day, 1); }
    return days;
  }, [calendarDate]);

  // Get status object from ID or object
  const getStatusObj = (status?: LeadStatus | number): LeadStatus | undefined => {
    if (!status) return undefined;
    if (typeof status === 'number') return statuses.find(s => s.id === status);
    return status;
  };

  // Activity type icon
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'CALL': return <Phone className="w-3 h-3" />;
      case 'EMAIL': return <Mail className="w-3 h-3" />;
      case 'MEETING': return <CalendarClock className="w-3 h-3" />;
      case 'NOTE': return <FileText className="w-3 h-3" />;
      case 'SMS': return <MessageSquare className="w-3 h-3" />;
      default: return <CircleDot className="w-3 h-3" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'CALL': return 'bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400';
      case 'EMAIL': return 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400';
      case 'MEETING': return 'bg-purple-100 text-purple-600 dark:bg-purple-900/40 dark:text-purple-400';
      case 'NOTE': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400';
      case 'SMS': return 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/40 dark:text-cyan-400';
      default: return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  // Navigation items
  const navItems = [
    { label: 'Leads', icon: Target, path: '/crm/leads' },
    { label: 'Tasks', icon: CheckCircle2, path: '/crm/tasks' },
    { label: 'WhatsApp', icon: MessageCircle, path: '/whatsapp/chats' },
    { label: 'Meetings', icon: CalendarClock, path: '/crm/meetings' },
  ];

  // Stats
  const stats = [
    { label: 'Total Leads', value: totalLeads.toLocaleString(), icon: Users, loading: leadsLoading },
    { label: 'Open Tasks', value: (openTasksData?.count || 0) + (inProgressTasksData?.count || 0), icon: CheckCircle2, loading: false },
    { label: 'Won Statuses', value: wonStatusIds.length, icon: Zap, loading: false },
    { label: 'Meetings', value: upcomingMeetings.length, icon: CalendarClock, loading: false },
  ];

  // Priority stats
  const priorityStats = [
    { label: 'High', count: highPriorityData?.count || 0, color: 'bg-red-500' },
    { label: 'Medium', count: medPriorityData?.count || 0, color: 'bg-yellow-500' },
    { label: 'Low', count: lowPriorityData?.count || 0, color: 'bg-green-500' },
  ];
  const priorityTotal = priorityStats.reduce((a, b) => a + b.count, 0) || 1;

  // Card base class
  const cardClass = `rounded-lg border ${isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'}`;
  const mutedText = isDark ? 'text-gray-400' : 'text-gray-500';
  const dimText = isDark ? 'text-gray-500' : 'text-gray-400';
  const bodyText = isDark ? 'text-gray-300' : 'text-gray-700';
  const headText = isDark ? 'text-gray-200' : 'text-gray-800';
  const hoverBg = isDark ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50';

  return (
    <div className={`flex-1 p-4 overflow-auto ${isDark ? 'bg-gray-950' : 'bg-gray-50/80'}`}>
      <div className="space-y-3">

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

        {/* Stats + Priority Bar Row */}
        <div className="flex items-center gap-6 flex-wrap">
          {/* Stats */}
          <div className="flex items-center gap-4">
            {stats.map((stat) => (
              <div key={stat.label} className="flex items-center gap-2">
                <stat.icon className={`w-3.5 h-3.5 ${dimText}`} />
                <span className={`text-xs ${dimText}`}>{stat.label}</span>
                {stat.loading ? (
                  <Loader2 className={`w-3 h-3 animate-spin ${dimText}`} />
                ) : (
                  <span className={`text-sm font-semibold ${headText}`}>{stat.value}</span>
                )}
              </div>
            ))}
          </div>

          {/* Priority distribution mini bar */}
          <div className="flex items-center gap-2 ml-auto">
            <span className={`text-[10px] uppercase tracking-wider font-medium ${dimText}`}>Priority</span>
            <div className="flex items-center gap-1.5">
              {priorityStats.map((p) => (
                <div key={p.label} className="flex items-center gap-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${p.color}`} />
                  <span className={`text-[11px] ${mutedText}`}>{p.label}</span>
                  <span className={`text-[11px] font-semibold ${bodyText}`}>{p.count}</span>
                </div>
              ))}
            </div>
            {/* mini bar */}
            <div className="flex h-1.5 w-20 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-800">
              {priorityStats.map((p) => (
                <div
                  key={p.label}
                  className={p.color}
                  style={{ width: `${(p.count / priorityTotal) * 100}%` }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Chart + Calendar */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
          {/* Area Chart */}
          <div className={`${cardClass} p-4 lg:col-span-3`}>
            <h2 className={`text-xs font-medium mb-3 ${mutedText}`}>
              Leads Overview
            </h2>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="leadsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={isDark ? '#6366f1' : '#818cf8'} stopOpacity={0.2} />
                      <stop offset="100%" stopColor={isDark ? '#6366f1' : '#818cf8'} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1f2937' : '#f3f4f6'} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: isDark ? '#6b7280' : '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: isDark ? '#6b7280' : '#9ca3af' }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      fontSize: 11, borderRadius: 6,
                      border: isDark ? '1px solid #374151' : '1px solid #e5e7eb',
                      backgroundColor: isDark ? '#111827' : '#ffffff',
                      color: isDark ? '#e5e7eb' : '#374151',
                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                    }}
                  />
                  <Area type="monotone" dataKey="leads" stroke={isDark ? '#6366f1' : '#818cf8'} strokeWidth={2} fill="url(#leadsFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Calendar */}
          <div className={`${cardClass} p-4 lg:col-span-2`}>
            <div className="flex items-center justify-between mb-3">
              <h2 className={`text-xs font-medium ${mutedText}`}>
                {format(calendarDate, 'MMMM yyyy')}
              </h2>
              <div className="flex items-center gap-0.5">
                <button onClick={() => setCalendarDate(subMonths(calendarDate, 1))} className={`p-1 rounded ${hoverBg}`}>
                  <ChevronLeft className={`w-3.5 h-3.5 ${mutedText}`} />
                </button>
                <button onClick={() => setCalendarDate(addMonths(calendarDate, 1))} className={`p-1 rounded ${hoverBg}`}>
                  <ChevronRight className={`w-3.5 h-3.5 ${mutedText}`} />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-7 gap-0">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                <div key={d} className={`text-center text-[10px] font-medium py-1.5 ${dimText}`}>{d}</div>
              ))}
              {calendarDays.map((day, i) => {
                const inMonth = isSameMonth(day, calendarDate);
                const today = isToday(day);
                const dateKey = format(day, 'yyyy-MM-dd');
                const events = eventDates[dateKey];
                return (
                  <div key={i} className="flex flex-col items-center py-0.5">
                    <div className={`w-7 h-7 flex items-center justify-center rounded-md text-[11px] ${
                      !inMonth ? (isDark ? 'text-gray-700' : 'text-gray-300')
                        : today ? (isDark ? 'bg-indigo-600 text-white font-semibold' : 'bg-gray-900 text-white font-semibold')
                        : (isDark ? 'text-gray-300' : 'text-gray-700')
                    }`}>
                      {format(day, 'd')}
                    </div>
                    {inMonth && events && (
                      <div className="flex items-center gap-0.5 mt-0.5">
                        {events.followups > 0 && <div className="w-1 h-1 rounded-full bg-indigo-500" />}
                        {events.tasks > 0 && <div className="w-1 h-1 rounded-full bg-amber-500" />}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className={`flex items-center gap-3 mt-2 pt-2 border-t ${isDark ? 'border-gray-800' : 'border-gray-100'}`}>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                <span className={`text-[10px] ${mutedText}`}>Follow-ups</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span className={`text-[10px] ${mutedText}`}>Tasks</span>
              </div>
            </div>
          </div>
        </div>

        {/* Pipeline */}
        {statuses.length > 0 && (
          <div className={`${cardClass} p-3`}>
            <h2 className={`text-xs font-medium mb-2 ${mutedText}`}>Pipeline</h2>
            <div className="flex flex-wrap gap-1.5">
              {statuses.map((status) => (
                <div
                  key={status.id}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium border ${
                    isDark ? 'border-gray-800 bg-gray-800/50' : 'border-gray-100 bg-gray-50'
                  }`}
                >
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: status.color_hex || '#6B7280' }} />
                  <span className={isDark ? 'text-gray-300' : 'text-gray-600'}>{status.name}</span>
                  {status.is_won && (
                    <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-50 text-emerald-600 font-medium dark:bg-emerald-950 dark:text-emerald-400">Won</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Leads + Upcoming Tasks + Upcoming Meetings */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

          {/* Recent Leads */}
          <div className={`${cardClass} p-3`}>
            <div className="flex items-center justify-between mb-2">
              <h2 className={`text-xs font-medium ${mutedText}`}>Recent Leads</h2>
              <button
                onClick={() => navigate('/crm/leads')}
                className={`flex items-center gap-1 text-[10px] font-medium ${mutedText} ${hoverBg} px-1.5 py-0.5 rounded`}
              >
                View all <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            {recentLeads.length === 0 ? (
              <p className={`text-xs py-4 text-center ${dimText}`}>No leads yet</p>
            ) : (
              <div className="divide-y divide-border/40">
                {recentLeads.map((lead) => {
                  const statusObj = getStatusObj(lead.status);
                  return (
                    <div
                      key={lead.id}
                      className={`flex items-center gap-2.5 py-2 cursor-pointer ${hoverBg} -mx-1 px-1 rounded`}
                      onClick={() => navigate(`/crm/leads/${lead.id}`)}
                    >
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0 ${
                        isDark ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {lead.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs font-medium truncate ${headText}`}>{lead.name}</span>
                          {statusObj && (
                            <span
                              className="text-[9px] px-1 py-0 rounded font-medium shrink-0"
                              style={{
                                backgroundColor: `${statusObj.color_hex || '#6B7280'}20`,
                                color: statusObj.color_hex || '#6B7280',
                              }}
                            >
                              {statusObj.name}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          {lead.phone && <span className={`text-[10px] ${dimText}`}>{lead.phone}</span>}
                          {lead.company && <span className={`text-[10px] ${dimText}`}>· {lead.company}</span>}
                        </div>
                      </div>
                      <span className={`text-[10px] shrink-0 ${dimText}`}>
                        {formatDistanceToNow(parseISO(lead.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Upcoming Tasks */}
          <div className={`${cardClass} p-3`}>
            <div className="flex items-center justify-between mb-2">
              <h2 className={`text-xs font-medium ${mutedText}`}>Upcoming Tasks</h2>
              <button
                onClick={() => navigate('/crm/tasks')}
                className={`flex items-center gap-1 text-[10px] font-medium ${mutedText} ${hoverBg} px-1.5 py-0.5 rounded`}
              >
                View all <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            {tasks.length === 0 ? (
              <p className={`text-xs py-4 text-center ${dimText}`}>No tasks</p>
            ) : (
              <div className="divide-y divide-border/40">
                {tasks.map((task) => {
                  const isOverdue = task.due_date && task.status !== 'DONE' && task.status !== 'CANCELLED' && isPast(parseISO(task.due_date)) && !isToday(parseISO(task.due_date));
                  const isDone = task.status === 'DONE';
                  return (
                    <div key={task.id} className={`flex items-start gap-2.5 py-2 ${isDone ? 'opacity-50' : ''}`}>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 shrink-0 ${
                        isDone ? 'border-green-500 bg-green-500' : isOverdue ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'
                      }`}>
                        {isDone && <CheckCircle2 className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className={`text-xs font-medium ${isDone ? 'line-through' : ''} ${headText}`}>{task.title}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          {task.lead_name && <span className={`text-[10px] ${dimText}`}>{task.lead_name}</span>}
                          {task.due_date && (
                            <span className={`text-[10px] flex items-center gap-0.5 ${isOverdue ? 'text-red-500 font-medium' : dimText}`}>
                              {isOverdue && <AlertTriangle className="w-2.5 h-2.5" />}
                              {format(parseISO(task.due_date), 'MMM dd')}
                            </span>
                          )}
                          <span className={`text-[9px] px-1 py-0 rounded ${
                            task.priority === 'HIGH' ? 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                            : task.priority === 'LOW' ? 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400'
                          }`}>
                            {task.priority}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Upcoming Meetings */}
          <div className={`${cardClass} p-3`}>
            <div className="flex items-center justify-between mb-2">
              <h2 className={`text-xs font-medium ${mutedText}`}>Upcoming Meetings</h2>
              <button
                onClick={() => navigate('/crm/meetings')}
                className={`flex items-center gap-1 text-[10px] font-medium ${mutedText} ${hoverBg} px-1.5 py-0.5 rounded`}
              >
                View all <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            {upcomingMeetings.length === 0 ? (
              <p className={`text-xs py-4 text-center ${dimText}`}>No upcoming meetings</p>
            ) : (
              <div className="divide-y divide-border/40">
                {upcomingMeetings.map((meeting) => {
                  const startDate = parseISO(meeting.start_at);
                  const endDate = parseISO(meeting.end_at);
                  const meetingToday = isToday(startDate);
                  return (
                    <div key={meeting.id} className={`flex items-start gap-2.5 py-2`}>
                      <div className={`w-9 h-9 rounded-lg flex flex-col items-center justify-center shrink-0 ${
                        meetingToday
                          ? 'bg-indigo-100 dark:bg-indigo-900/40'
                          : isDark ? 'bg-gray-800' : 'bg-gray-50'
                      }`}>
                        <span className={`text-[9px] font-medium leading-none ${meetingToday ? 'text-indigo-600 dark:text-indigo-400' : dimText}`}>
                          {format(startDate, 'MMM')}
                        </span>
                        <span className={`text-sm font-bold leading-tight ${meetingToday ? 'text-indigo-700 dark:text-indigo-300' : headText}`}>
                          {format(startDate, 'd')}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className={`text-xs font-medium truncate block ${headText}`}>{meeting.title}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-[10px] ${dimText}`}>
                            {format(startDate, 'hh:mm a')} – {format(endDate, 'hh:mm a')}
                          </span>
                          {meetingToday && (
                            <span className="text-[9px] px-1 py-0 rounded bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400 font-medium">
                              Today
                            </span>
                          )}
                        </div>
                        {meeting.lead_name && (
                          <span className={`text-[10px] ${dimText} mt-0.5 block`}>{meeting.lead_name}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Recent Activities */}
        {activities.length > 0 && (
          <div className={`${cardClass} p-3`}>
            <h2 className={`text-xs font-medium mb-2 ${mutedText}`}>Recent Activity</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-4">
              {activities.map((activity) => (
                <div key={activity.id} className={`flex items-center gap-2.5 py-1.5 border-b border-border/30 last:border-b-0`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${getActivityColor(activity.type)}`}>
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={`text-xs truncate block ${bodyText}`}>
                      {activity.content || activity.type.charAt(0) + activity.type.slice(1).toLowerCase()}
                    </span>
                  </div>
                  <span className={`text-[10px] shrink-0 ${dimText}`}>
                    {formatDistanceToNow(parseISO(activity.happened_at), { addSuffix: true })}
                  </span>
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
