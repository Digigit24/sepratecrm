// src/pages/telephony/TelephonyDashboardPage.tsx
// Admin telephony analytics dashboard — RBAC-gated via ModuleProtectedRoute
// (requiredPermission="telephony.analytics.view") in App.tsx.
import React, { useState } from 'react';
import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Phone,
  PhoneMissed,
  Clock,
  TrendingUp,
  AlertCircle,
  PhoneCall,
  RefreshCw,
  Users,
  Target,
  CheckCircle2,
  XCircle,
  ChevronRight,
  PhoneIncoming,
  PhoneOutgoing,
  Info,
} from 'lucide-react';
import { telephonyService } from '@/services/telephonyService';
import type { TelephonyAnalyticsDashboard, AgentCallSummary } from '@/types/telephony.types';
import { placeCall } from '@/lib/telephonyController';
import { cn } from '@/lib/utils';

// ── helpers ──────────────────────────────────────────────────────────────────

const fmtTalkTime = (secs: number) => {
  if (!secs) return '0m';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
};

const fmtDuration = (secs: number | null) => {
  if (!secs) return '—';
  if (secs < 60) return `${secs}s`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
};

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

const OUTCOME_CONFIG: Record<string, { label: string; bar: string }> = {
  interested:     { label: 'Interested',     bar: 'bg-green-500' },
  converted:      { label: 'Converted',      bar: 'bg-emerald-600' },
  follow_up:      { label: 'Follow Up',      bar: 'bg-blue-500' },
  callback:       { label: 'Callback',       bar: 'bg-amber-500' },
  not_interested: { label: 'Not Interested', bar: 'bg-orange-500' },
  dnd:            { label: 'DND',            bar: 'bg-red-500' },
};

const RANK_STYLE = ['text-amber-500', 'text-slate-400', 'text-amber-700'];

// ── Skeleton helpers ──────────────────────────────────────────────────────────

const KpiSkeleton = () => (
  <Card>
    <CardContent className="pt-4 pb-3">
      <Skeleton className="h-4 w-24 mb-2" />
      <Skeleton className="h-7 w-16 mb-1" />
      <Skeleton className="h-3 w-28" />
    </CardContent>
  </Card>
);

// ── KPI card ──────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: string | number;
  sub: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  alert?: boolean;
  tooltip?: string;
}

const KpiCard: React.FC<KpiCardProps> = ({
  label, value, sub, icon: Icon, iconBg, iconColor, alert, tooltip,
}) => (
  <Card className={alert ? 'border-red-200' : undefined}>
    <CardContent className="pt-4 pb-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <p className="text-xs text-muted-foreground truncate">{label}</p>
            {tooltip && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 text-muted-foreground/60 cursor-help shrink-0" />
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[200px] text-xs">
                  {tooltip}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <p className={cn('text-2xl font-bold mt-0.5 tabular-nums', alert && 'text-red-600')}>
            {value}
          </p>
          <p className="text-xs text-muted-foreground mt-1 truncate">{sub}</p>
        </div>
        <div className={cn('p-2 rounded-lg shrink-0', iconBg)}>
          <Icon className={cn('h-4 w-4', iconColor)} />
        </div>
      </div>
    </CardContent>
  </Card>
);

// ── Agent row ─────────────────────────────────────────────────────────────────

const AgentRow: React.FC<{ agent: AgentCallSummary; rank: number }> = ({ agent: a, rank }) => {
  const missAlert = a.miss_rate > 20;
  return (
    <TableRow>
      <TableCell className="w-[36px] pr-0">
        <span className={cn('text-xs font-bold tabular-nums', RANK_STYLE[rank] ?? 'text-muted-foreground')}>
          {rank + 1}
        </span>
      </TableCell>
      <TableCell>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{a.agent_name}</p>
          <p className="text-xs text-muted-foreground">
            {a.inbound_calls} in · {a.outbound_calls} out
          </p>
        </div>
      </TableCell>
      <TableCell className="text-right">
        <span className="text-sm font-semibold tabular-nums">{a.total_calls}</span>
      </TableCell>
      <TableCell className="text-right">
        <span className="text-xs tabular-nums">{fmtTalkTime(a.total_talk_time)}</span>
      </TableCell>
      <TableCell className="text-right hidden md:table-cell">
        <span className={cn('text-xs font-medium tabular-nums', missAlert && 'text-red-600 font-semibold')}>
          {a.miss_rate}%
        </span>
      </TableCell>
      <TableCell className="text-right hidden lg:table-cell">
        {a.converted_calls > 0 ? (
          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-xs font-medium">
            {a.converted_calls}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="text-right hidden xl:table-cell">
        <span className="text-xs text-muted-foreground tabular-nums">
          {fmtDuration(a.avg_call_duration)}
        </span>
      </TableCell>
    </TableRow>
  );
};

// ── Main dashboard ────────────────────────────────────────────────────────────

export const TelephonyDashboardPage: React.FC = () => {
  const [days, setDays] = useState(30);

  const { data, error, isLoading, mutate } = useSWR<TelephonyAnalyticsDashboard>(
    ['telephony-analytics-dashboard', days],
    () => telephonyService.getAnalyticsDashboard(days),
    { revalidateOnFocus: false, dedupingInterval: 60_000 },
  );

  const team    = data?.team_summary;
  const agents  = data?.agent_summary  || [];
  const missed  = data?.missed_unattended || [];
  const outcomes = data?.outcome_breakdown || [];
  const maxOutcomeCount = Math.max(...outcomes.map((o) => o.count), 1);
  const totalOutcomes = outcomes.reduce((s, o) => s + o.count, 0);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[320px] gap-3">
        <div className="p-3 rounded-full bg-destructive/10">
          <AlertCircle className="h-6 w-6 text-destructive" />
        </div>
        <p className="text-sm font-medium">Failed to load analytics</p>
        <p className="text-xs text-muted-foreground">
          {(error as Error)?.message || 'Check your connection and try again.'}
        </p>
        <Button variant="outline" size="sm" onClick={() => mutate()}>
          <RefreshCw className="h-3.5 w-3.5 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-7xl mx-auto">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Telephony Analytics</h1>
          {data && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {data.date_from} — {data.date_to}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="h-8 w-[110px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => mutate()}
            disabled={isLoading}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
        ) : (
          <>
            <KpiCard
              label="Total Calls"
              value={(team?.total_calls ?? 0).toLocaleString()}
              sub={`${pct(team?.answered_calls ?? 0, team?.total_calls ?? 0)}% answered`}
              icon={Phone}
              iconBg="bg-blue-50"
              iconColor="text-blue-600"
              tooltip="All inbound and outbound calls in the period (outbound Leg A excluded, no double-count)"
            />
            <KpiCard
              label="Total Talk Time"
              value={fmtTalkTime(team?.total_talk_time ?? 0)}
              sub={`avg ${fmtDuration(team?.avg_call_duration ?? null)} / call`}
              icon={Clock}
              iconBg="bg-green-50"
              iconColor="text-green-600"
            />
            <KpiCard
              label="Miss Rate"
              value={`${pct(team?.missed_calls ?? 0, team?.total_calls ?? 0)}%`}
              sub={`${team?.missed_calls ?? 0} missed calls`}
              icon={PhoneMissed}
              iconBg="bg-red-50"
              iconColor="text-red-600"
              alert={pct(team?.missed_calls ?? 0, team?.total_calls ?? 0) > 20}
              tooltip="Percentage of inbound calls that were not answered"
            />
            <KpiCard
              label="Converted"
              value={team?.converted_calls ?? 0}
              sub={`${pct(team?.calls_with_outcome ?? 0, team?.answered_calls ?? 0)}% outcomes set`}
              icon={Target}
              iconBg="bg-emerald-50"
              iconColor="text-emerald-600"
              tooltip="Calls where an agent marked the outcome as 'Converted'"
            />
          </>
        )}
      </div>

      {/* ── Inbound / Outbound split bar ─────────────────────────────────── */}
      {!isLoading && team && team.total_calls > 0 && (
        <Card>
          <CardContent className="pt-3 pb-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span className="flex items-center gap-1">
                <PhoneIncoming className="h-3.5 w-3.5 text-blue-600" />
                Inbound: {team.inbound_calls} ({pct(team.inbound_calls, team.total_calls)}%)
              </span>
              <span className="flex items-center gap-1">
                Outbound: {team.outbound_calls} ({pct(team.outbound_calls, team.total_calls)}%)
                <PhoneOutgoing className="h-3.5 w-3.5 text-green-600" />
              </span>
            </div>
            <div className="flex h-2 rounded-full overflow-hidden bg-muted gap-0.5">
              <div
                className="bg-blue-500 transition-all"
                style={{ width: `${pct(team.inbound_calls, team.total_calls)}%` }}
              />
              <div className="bg-green-500 transition-all flex-1" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Missed & Unattended Alert ────────────────────────────────────── */}
      {!isLoading && missed.length > 0 && (
        <Card className="border-red-200 bg-red-50/50">
          <CardHeader className="pb-2 pt-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2 text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              Missed Calls Needing Callback
              <Badge className="ml-auto bg-red-600 text-white hover:bg-red-600 text-xs">
                {missed.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-2">
              {missed.slice(0, 6).map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between bg-white rounded-lg px-3 py-2.5 border border-red-100 gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-1.5 rounded-full bg-red-100 shrink-0">
                      <PhoneMissed className="h-3.5 w-3.5 text-red-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium font-mono truncate">{m.from_number}</p>
                      <p className="text-xs text-muted-foreground">
                        Missed {m.hours_waiting}h ago
                        {m.is_urgent && (
                          <span className="ml-1.5 text-red-600 font-semibold">⚠ Urgent</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs gap-1 border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300 shrink-0"
                    onClick={() => placeCall({ toNumber: m.from_number })}
                  >
                    <PhoneCall className="h-3 w-3" />
                    Call Back
                  </Button>
                </div>
              ))}
              {missed.length > 6 && (
                <button className="text-xs text-red-600 hover:underline w-full text-center py-1 flex items-center justify-center gap-1">
                  +{missed.length - 6} more <ChevronRight className="h-3 w-3" />
                </button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Leaderboard + Outcomes ───────────────────────────────────────── */}
      <div className="grid lg:grid-cols-5 gap-5">

        {/* Agent Leaderboard — 3/5 width */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader className="pb-0 pt-4 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Agent Leaderboard
                </CardTitle>
                {!isLoading && agents.length > 0 && (
                  <span className="text-xs text-muted-foreground">{agents.length} agents</span>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0 mt-2">
              {isLoading ? (
                <div className="p-4 space-y-2.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : agents.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-muted-foreground">
                  <Users className="h-8 w-8 opacity-30" />
                  <p className="text-sm">No agent data for this period</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[36px] pr-0 text-center">#</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead className="text-right">Calls</TableHead>
                      <TableHead className="text-right">Talk Time</TableHead>
                      <TableHead className="text-right hidden md:table-cell">Miss%</TableHead>
                      <TableHead className="text-right hidden lg:table-cell">Converted</TableHead>
                      <TableHead className="text-right hidden xl:table-cell">Avg Duration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {agents.map((a, idx) => (
                      <AgentRow key={a.agent_user_id} agent={a} rank={idx} />
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Outcome breakdown — 2/5 width */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          <Card className="flex-1">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                Call Outcomes
                {totalOutcomes > 0 && (
                  <span className="ml-auto text-xs font-normal text-muted-foreground">
                    {totalOutcomes} total
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {isLoading ? (
                <div className="space-y-3.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-8" />
                  ))}
                </div>
              ) : outcomes.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 opacity-30" />
                  <p className="text-sm">No outcomes recorded yet</p>
                  <p className="text-xs text-center">
                    Agents can set call outcomes from the call log.
                  </p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {outcomes.map((o) => {
                    const cfg = OUTCOME_CONFIG[o.call_outcome];
                    const width = Math.max((o.count / maxOutcomeCount) * 100, 4);
                    return (
                      <div key={o.call_outcome}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-medium">
                            {cfg?.label || o.call_outcome}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {pct(o.count, totalOutcomes)}%
                            </span>
                            <span className="text-xs font-semibold tabular-nums w-6 text-right">
                              {o.count}
                            </span>
                          </div>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all duration-500', cfg?.bar || 'bg-primary')}
                            style={{ width: `${width}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick stats card */}
          {!isLoading && team && (
            <Card>
              <CardContent className="pt-4 pb-3 px-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                  Period Summary
                </p>
                <div className="space-y-2.5">
                  {[
                    { icon: PhoneIncoming, label: 'Inbound answered', value: `${team.inbound_calls}`, color: 'text-blue-600' },
                    { icon: PhoneOutgoing, label: 'Outbound answered', value: `${team.outbound_calls}`, color: 'text-green-600' },
                    { icon: XCircle,       label: 'Missed / unanswered', value: `${team.missed_calls}`, color: 'text-red-600' },
                    { icon: CheckCircle2,  label: 'With outcome set',    value: `${team.calls_with_outcome}`, color: 'text-emerald-600' },
                  ].map(({ icon: Icon, label, value, color }) => (
                    <div key={label} className="flex items-center gap-2">
                      <Icon className={cn('h-3.5 w-3.5 shrink-0', color)} />
                      <span className="text-xs text-muted-foreground flex-1">{label}</span>
                      <span className="text-xs font-semibold tabular-nums">{value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

    </div>
  );
};

export default TelephonyDashboardPage;
