// src/pages/telephony/CallLogsPage.tsx
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  RefreshCw,
  Loader2,
  ExternalLink,
  DownloadCloud,
  ArrowUpDown,
} from 'lucide-react';
import { useTelephony } from '@/hooks/useTelephony';
import { useUsers } from '@/hooks/useUsers';
import { Pager } from '@/components/telephony/Pager';
import { formatDuration, safeRelative, safeExact, msToExact } from '@/lib/telephonyFormat';
import {
  Direction,
  CallType,
  type CallLog,
  type CallLogsQueryParams,
} from '@/types/telephony.types';

const PAGE_SIZE = 25;

const DirectionIcon: React.FC<{ call: CallLog; className?: string }> = ({ call, className }) => {
  const missed = call.call_type === CallType.MISSED || call.duration <= 0;
  const inbound = call.direction === Direction.INBOUND;
  const Icon = missed ? PhoneMissed : inbound ? PhoneIncoming : PhoneOutgoing;
  const color = missed ? 'text-red-600' : inbound ? 'text-blue-600' : 'text-green-600';
  return <Icon className={`${className ?? 'h-4 w-4'} ${color}`} />;
};

export const CallLogsPage: React.FC = () => {
  const navigate = useNavigate();
  const { useCalls, syncCalls } = useTelephony();
  const { useUsersList } = useUsers();

  // ── filters ──
  const [direction, setDirection] = useState<'all' | Direction>('all');
  const [callType, setCallType] = useState<'all' | CallType>('all');
  const [leadIdInput, setLeadIdInput] = useState('');
  const [agentUserId, setAgentUserId] = useState<'all' | string>('all');
  const [ordering, setOrdering] = useState<CallLogsQueryParams['ordering']>('-call_time');
  const [page, setPage] = useState(1);

  const params: CallLogsQueryParams = useMemo(() => {
    const leadId = leadIdInput.trim() ? parseInt(leadIdInput.trim(), 10) : undefined;
    return {
      direction: direction === 'all' ? undefined : direction,
      call_type: callType === 'all' ? undefined : callType,
      lead_id: Number.isFinite(leadId) ? leadId : undefined,
      agent_user_id: agentUserId === 'all' ? undefined : agentUserId,
      ordering,
      page,
      page_size: PAGE_SIZE,
    };
  }, [direction, callType, leadIdInput, agentUserId, ordering, page]);

  const { data, error, isLoading, isValidating, mutate } = useCalls(params);
  const { data: usersData } = useUsersList({ page_size: 100 });

  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    (usersData?.results || []).forEach((u) =>
      map.set(u.id, u.full_name || `${u.first_name} ${u.last_name}`.trim() || u.email),
    );
    return map;
  }, [usersData]);

  const rows = data?.results || [];
  const count = data?.count ?? 0;

  // ── sync modal ──
  const [syncOpen, setSyncOpen] = useState(false);
  const [hoursBack, setHoursBack] = useState('24');
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    const hb = Math.min(720, Math.max(1, parseInt(hoursBack, 10) || 24));
    setSyncing(true);
    try {
      await syncCalls({ hours_back: hb });
      setSyncOpen(false);
      await mutate();
    } catch {
      // hook toasts
    } finally {
      setSyncing(false);
    }
  };

  // ── detail drawer ──
  const [selected, setSelected] = useState<CallLog | null>(null);

  const resetPageAnd = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(1);
  };

  return (
    <div className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-semibold">Call Logs</h1>
          <span className="text-xs text-muted-foreground">{count} total</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => mutate()} disabled={isValidating} title="Refresh">
            <RefreshCw className={`h-3.5 w-3.5 ${isValidating ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" className="h-7 text-xs gap-1" onClick={() => setSyncOpen(true)}>
            <DownloadCloud className="h-3.5 w-3.5" />
            Sync
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={direction} onValueChange={resetPageAnd((v) => setDirection(v as 'all' | Direction))}>
          <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue placeholder="Direction" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All directions</SelectItem>
            <SelectItem value={Direction.INBOUND}>Inbound</SelectItem>
            <SelectItem value={Direction.OUTBOUND}>Outbound</SelectItem>
          </SelectContent>
        </Select>
        <Select value={callType} onValueChange={resetPageAnd((v) => setCallType(v as 'all' | CallType))}>
          <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value={CallType.ANSWERED}>Answered</SelectItem>
            <SelectItem value={CallType.MISSED}>Missed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={agentUserId} onValueChange={resetPageAnd((v) => setAgentUserId(v))}>
          <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue placeholder="Agent" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All agents</SelectItem>
            {(usersData?.results || []).map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.full_name || `${u.first_name} ${u.last_name}`.trim() || u.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="h-8 w-[120px] text-xs"
          placeholder="Lead ID"
          inputMode="numeric"
          value={leadIdInput}
          onChange={(e) => resetPageAnd(setLeadIdInput)(e.target.value)}
        />
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1"
          onClick={() => setOrdering((o) => (o === '-call_time' ? 'call_time' : '-call_time'))}
          title="Toggle sort by time"
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          {ordering === '-call_time' ? 'Newest' : 'Oldest'}
        </Button>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        {error ? (
          <p className="text-sm text-destructive text-center py-10">Failed to load call logs.</p>
        ) : isLoading && rows.length === 0 ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">No call logs found.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]"></TableHead>
                <TableHead>Caller</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="hidden md:table-cell">From → To</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead className="hidden lg:table-cell">Agent</TableHead>
                <TableHead className="text-right">When</TableHead>
                <TableHead className="w-[40px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((call) => {
                const inbound = call.direction === Direction.INBOUND;
                const title = call.caller_name || (inbound ? call.from_number : call.to_number) || 'Unknown';
                return (
                  <TableRow key={call.id} className="cursor-pointer" onClick={() => setSelected(call)}>
                    <TableCell><DirectionIcon call={call} /></TableCell>
                    <TableCell className="font-medium">{title}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={call.call_type === CallType.MISSED ? 'bg-red-100 text-red-700 hover:bg-red-100' : 'bg-green-100 text-green-700 hover:bg-green-100'}
                      >
                        {call.call_type === CallType.MISSED ? 'Missed' : 'Answered'}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs font-mono text-muted-foreground">
                      {call.from_number} → {call.to_number}
                    </TableCell>
                    <TableCell className={call.call_type === CallType.MISSED ? 'text-red-600' : ''}>
                      {formatDuration(call.duration, call.call_type)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                      {(call.agent_user_id && nameById.get(call.agent_user_id)) || '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-xs text-muted-foreground cursor-default">{safeRelative(call.call_time)}</span>
                        </TooltipTrigger>
                        <TooltipContent side="left"><p className="text-xs">{safeExact(call.call_time)}</p></TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {call.lead_id ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          title="View lead"
                          onClick={() => navigate(`/crm/leads/${call.lead_id}`)}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
        <div className="px-3 pb-2">
          <Pager page={page} pageSize={PAGE_SIZE} count={count} onPrev={() => setPage((p) => Math.max(1, p - 1))} onNext={() => setPage((p) => p + 1)} />
        </div>
      </div>

      {/* Sync modal */}
      <Dialog open={syncOpen} onOpenChange={setSyncOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Sync call logs</DialogTitle>
            <DialogDescription>Pull recent CDR from TeleCMI for your agent and upsert into call logs.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="hours-back">Hours back</Label>
            <Input id="hours-back" type="number" min={1} max={720} value={hoursBack} onChange={(e) => setHoursBack(e.target.value)} />
            <p className="text-xs text-muted-foreground">Default 24. Max 720 (30 days).</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSyncOpen(false)} disabled={syncing}>Cancel</Button>
            <Button onClick={handleSync} disabled={syncing}>
              {syncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <DownloadCloud className="h-4 w-4 mr-2" />}
              Sync
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail drawer */}
      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <DirectionIcon call={selected} />
                  {selected.caller_name || selected.from_number}
                </SheetTitle>
                <SheetDescription>{selected.direction_display || selected.direction} call</SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-3 text-sm">
                <DetailRow label="Type" value={selected.call_type === CallType.MISSED ? 'Missed' : 'Answered'} />
                <DetailRow label="From" value={selected.from_number} mono />
                <DetailRow label="To" value={selected.to_number} mono />
                <DetailRow label="Duration" value={formatDuration(selected.duration, selected.call_type)} />
                <DetailRow label="Billed seconds" value={String(selected.billed_sec ?? '—')} />
                <DetailRow label="Rate" value={selected.rate ?? '—'} mono />
                <DetailRow label="When" value={safeExact(selected.call_time)} />
                <DetailRow label="cmiuid" value={selected.cmiuid} mono />
                <DetailRow label="Synced via" value={selected.synced_via} />
                {selected.lead_id ? (
                  <Button variant="outline" size="sm" className="w-full" onClick={() => navigate(`/crm/leads/${selected.lead_id}`)}>
                    <ExternalLink className="h-3.5 w-3.5 mr-2" /> View Lead #{selected.lead_id}
                  </Button>
                ) : null}
                {Array.isArray(selected.telecmi_notes) && selected.telecmi_notes.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5">Notes</p>
                    <div className="space-y-1.5">
                      {selected.telecmi_notes.map((n, i) => (
                        <div key={i} className="text-xs bg-muted/60 rounded px-2 py-1.5">
                          <p className="whitespace-pre-wrap">{n.msg}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{n.agent}{n.date ? ` · ${msToExact(n.date)}` : ''}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

const DetailRow: React.FC<{ label: string; value: string; mono?: boolean }> = ({ label, value, mono }) => (
  <div className="flex items-start justify-between gap-3 border-b pb-2 last:border-b-0">
    <span className="text-muted-foreground shrink-0">{label}</span>
    <span className={`text-right break-all ${mono ? 'font-mono text-xs' : ''}`}>{value || '—'}</span>
  </div>
);

export default CallLogsPage;
