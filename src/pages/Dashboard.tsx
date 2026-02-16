import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { useTheme } from 'next-themes';
import {
  Users,
  Loader2,
  TrendingUp,
  ArrowRight,
  MessageCircle,
  Target,
  CalendarClock,
  BarChart3,
  CheckCircle2,
  Clock,
  Zap,
} from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  trendUp?: boolean;
  loading?: boolean;
  isDark: boolean;
}

const StatCard = ({ title, value, icon, trend, trendUp, loading, isDark }: StatCardProps) => {
  return (
    <Card className={`relative overflow-hidden ${isDark ? 'border-gray-700' : 'border-gray-200'} shadow-sm hover:shadow-md transition-all duration-300`}>
      <div className="p-6 relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className={`text-sm font-medium ${isDark ? 'text-gray-400' : 'text-gray-600/80'}`}>{title}</p>
            {loading ? (
              <div className="mt-2">
                <Loader2 className={`w-6 h-6 animate-spin ${isDark ? 'text-gray-500' : 'text-gray-400'}`} />
              </div>
            ) : (
              <h3 className={`text-3xl font-bold mt-2 ${
                isDark
                  ? 'bg-gradient-to-br from-gray-100 to-gray-300 bg-clip-text text-transparent'
                  : 'bg-gradient-to-br from-gray-900 to-gray-600 bg-clip-text text-transparent'
              }`}>
                {value}
              </h3>
            )}
            {trend && !loading && (
              <p
                className={`text-xs mt-2 flex items-center gap-1 font-medium ${
                  trendUp ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                <TrendingUp className={`w-3 h-3 ${!trendUp && 'rotate-180'}`} />
                {trend}
              </p>
            )}
          </div>
          <div className="p-4 rounded-2xl">
            {icon}
          </div>
        </div>
      </div>
      <div className={`absolute inset-0 pointer-events-none ${
        isDark
          ? 'bg-gradient-to-br from-white/5 to-transparent'
          : 'bg-gradient-to-br from-white/50 to-transparent'
      }`} />
    </Card>
  );
};

const Dashboard = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const navigate = useNavigate();

  const { useLeads, useLeadStatuses } = useCRM();

  // Fetch leads data for stats
  const { data: leadsData, isLoading: leadsLoading } = useLeads({ page: 1, page_size: 1 });
  const { data: statusesData } = useLeadStatuses({ page_size: 100, ordering: 'order_index', is_active: true });

  const totalLeads = leadsData?.count || 0;
  const statuses = statusesData?.results || [];

  // Count won statuses
  const wonStatusIds = useMemo(() => {
    return statuses.filter(s => s.is_won).map(s => s.id);
  }, [statuses]);

  return (
    <div className={`flex-1 p-6 overflow-auto ${
      isDark
        ? 'bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900'
        : 'bg-gradient-to-br from-gray-50 via-white to-gray-50'
    }`}>
      <div className="max-w-8xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className={`text-4xl font-bold ${
                isDark
                  ? 'bg-gradient-to-r from-gray-100 via-gray-200 to-gray-300 bg-clip-text text-transparent'
                  : 'bg-gradient-to-r from-gray-900 via-gray-800 to-gray-600 bg-clip-text text-transparent'
              }`}>
                Dashboard
              </h1>
              <p className={`mt-2 text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                Welcome back! Here's your CRM overview.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Navigation Tabs */}
        <div className="mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* CRM Leads Card */}
            <Card
              onClick={() => navigate('/crm/leads')}
              className={`group cursor-pointer relative overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-lg ${
                isDark
                  ? 'border-gray-700 bg-gradient-to-br from-indigo-950/40 via-gray-800/40 to-indigo-900/30 hover:border-indigo-600'
                  : 'border-gray-200 bg-gradient-to-br from-indigo-50/50 via-white to-indigo-50/30 hover:border-indigo-300'
              }`}
            >
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg transition-all duration-300 ${
                      isDark
                        ? 'bg-indigo-900/50 group-hover:bg-indigo-800/70'
                        : 'bg-indigo-100 group-hover:bg-indigo-200'
                    }`}>
                      <Target className={`w-5 h-5 ${
                        isDark ? 'text-indigo-400' : 'text-indigo-600'
                      }`} />
                    </div>
                    <div>
                      <h3 className={`text-sm font-semibold ${
                        isDark ? 'text-gray-100' : 'text-gray-900'
                      }`}>
                        Leads
                      </h3>
                      <p className={`text-xs mt-0.5 ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        Manage sales pipeline
                      </p>
                    </div>
                  </div>
                  <ArrowRight className={`w-4 h-4 transition-transform duration-300 group-hover:translate-x-1 ${
                    isDark ? 'text-gray-500' : 'text-gray-400'
                  }`} />
                </div>
              </div>
              <div className={`absolute inset-0 pointer-events-none transition-opacity duration-300 opacity-0 group-hover:opacity-100 ${
                isDark
                  ? 'bg-gradient-to-r from-indigo-600/10 to-transparent'
                  : 'bg-gradient-to-r from-indigo-100/50 to-transparent'
              }`} />
            </Card>

            {/* CRM Tasks Card */}
            <Card
              onClick={() => navigate('/crm/tasks')}
              className={`group cursor-pointer relative overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-lg ${
                isDark
                  ? 'border-gray-700 bg-gradient-to-br from-emerald-950/40 via-gray-800/40 to-emerald-900/30 hover:border-emerald-600'
                  : 'border-gray-200 bg-gradient-to-br from-emerald-50/50 via-white to-emerald-50/30 hover:border-emerald-300'
              }`}
            >
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg transition-all duration-300 ${
                      isDark
                        ? 'bg-emerald-900/50 group-hover:bg-emerald-800/70'
                        : 'bg-emerald-100 group-hover:bg-emerald-200'
                    }`}>
                      <CheckCircle2 className={`w-5 h-5 ${
                        isDark ? 'text-emerald-400' : 'text-emerald-600'
                      }`} />
                    </div>
                    <div>
                      <h3 className={`text-sm font-semibold ${
                        isDark ? 'text-gray-100' : 'text-gray-900'
                      }`}>
                        Tasks
                      </h3>
                      <p className={`text-xs mt-0.5 ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        Track CRM tasks
                      </p>
                    </div>
                  </div>
                  <ArrowRight className={`w-4 h-4 transition-transform duration-300 group-hover:translate-x-1 ${
                    isDark ? 'text-gray-500' : 'text-gray-400'
                  }`} />
                </div>
              </div>
              <div className={`absolute inset-0 pointer-events-none transition-opacity duration-300 opacity-0 group-hover:opacity-100 ${
                isDark
                  ? 'bg-gradient-to-r from-emerald-600/10 to-transparent'
                  : 'bg-gradient-to-r from-emerald-100/50 to-transparent'
              }`} />
            </Card>

            {/* WhatsApp Chats Card */}
            <Card
              onClick={() => navigate('/whatsapp/chats')}
              className={`group cursor-pointer relative overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-lg ${
                isDark
                  ? 'border-gray-700 bg-gradient-to-br from-green-950/40 via-gray-800/40 to-green-900/30 hover:border-green-600'
                  : 'border-gray-200 bg-gradient-to-br from-green-50/50 via-white to-green-50/30 hover:border-green-300'
              }`}
            >
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg transition-all duration-300 ${
                      isDark
                        ? 'bg-green-900/50 group-hover:bg-green-800/70'
                        : 'bg-green-100 group-hover:bg-green-200'
                    }`}>
                      <MessageCircle className={`w-5 h-5 ${
                        isDark ? 'text-green-400' : 'text-green-600'
                      }`} />
                    </div>
                    <div>
                      <h3 className={`text-sm font-semibold ${
                        isDark ? 'text-gray-100' : 'text-gray-900'
                      }`}>
                        WhatsApp
                      </h3>
                      <p className={`text-xs mt-0.5 ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        Chats & messaging
                      </p>
                    </div>
                  </div>
                  <ArrowRight className={`w-4 h-4 transition-transform duration-300 group-hover:translate-x-1 ${
                    isDark ? 'text-gray-500' : 'text-gray-400'
                  }`} />
                </div>
              </div>
              <div className={`absolute inset-0 pointer-events-none transition-opacity duration-300 opacity-0 group-hover:opacity-100 ${
                isDark
                  ? 'bg-gradient-to-r from-green-600/10 to-transparent'
                  : 'bg-gradient-to-r from-green-100/50 to-transparent'
              }`} />
            </Card>

            {/* Meetings Card */}
            <Card
              onClick={() => navigate('/crm/meetings')}
              className={`group cursor-pointer relative overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-lg ${
                isDark
                  ? 'border-gray-700 bg-gradient-to-br from-purple-950/40 via-gray-800/40 to-purple-900/30 hover:border-purple-600'
                  : 'border-gray-200 bg-gradient-to-br from-purple-50/50 via-white to-purple-50/30 hover:border-purple-300'
              }`}
            >
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg transition-all duration-300 ${
                      isDark
                        ? 'bg-purple-900/50 group-hover:bg-purple-800/70'
                        : 'bg-purple-100 group-hover:bg-purple-200'
                    }`}>
                      <CalendarClock className={`w-5 h-5 ${
                        isDark ? 'text-purple-400' : 'text-purple-600'
                      }`} />
                    </div>
                    <div>
                      <h3 className={`text-sm font-semibold ${
                        isDark ? 'text-gray-100' : 'text-gray-900'
                      }`}>
                        Meetings
                      </h3>
                      <p className={`text-xs mt-0.5 ${
                        isDark ? 'text-gray-400' : 'text-gray-500'
                      }`}>
                        Scheduled meetings
                      </p>
                    </div>
                  </div>
                  <ArrowRight className={`w-4 h-4 transition-transform duration-300 group-hover:translate-x-1 ${
                    isDark ? 'text-gray-500' : 'text-gray-400'
                  }`} />
                </div>
              </div>
              <div className={`absolute inset-0 pointer-events-none transition-opacity duration-300 opacity-0 group-hover:opacity-100 ${
                isDark
                  ? 'bg-gradient-to-r from-purple-600/10 to-transparent'
                  : 'bg-gradient-to-r from-purple-100/50 to-transparent'
              }`} />
            </Card>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <StatCard
            title="Total Leads"
            value={totalLeads.toLocaleString()}
            icon={<Users className="w-7 h-7 text-indigo-600" />}
            loading={leadsLoading}
            isDark={isDark}
          />
          <StatCard
            title="Active Statuses"
            value={statuses.length}
            icon={<BarChart3 className="w-7 h-7 text-emerald-600" />}
            loading={false}
            isDark={isDark}
          />
          <StatCard
            title="Won Statuses"
            value={wonStatusIds.length}
            icon={<Zap className="w-7 h-7 text-amber-600" />}
            loading={false}
            isDark={isDark}
          />
          <StatCard
            title="Pipeline Stages"
            value={statuses.filter(s => !s.is_won).length}
            icon={<Clock className="w-7 h-7 text-purple-600" />}
            loading={false}
            isDark={isDark}
          />
        </div>

        {/* Lead Statuses Pipeline Overview */}
        {statuses.length > 0 && (
          <Card className={`p-6 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
            <h3 className={`text-lg font-semibold mb-4 ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
              Pipeline Overview
            </h3>
            <div className="flex flex-wrap gap-3">
              {statuses.map((status) => (
                <div
                  key={status.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border"
                  style={{
                    borderColor: status.color_hex || '#6B7280',
                    backgroundColor: `${status.color_hex || '#6B7280'}15`,
                  }}
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: status.color_hex || '#6B7280' }}
                  />
                  <span className={`text-sm font-medium ${isDark ? 'text-gray-200' : 'text-gray-700'}`}>
                    {status.name}
                  </span>
                  {status.is_won && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">Won</span>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
