// src/components/telephony/LeadTelephonyHistory.tsx
//
// Raw telephony view for a single lead: TeleCMI call logs (CDR) + SMS logs.
// This is intentionally NOT the same as the Activities tab — it surfaces
// TeleCMI-side fields (billed_sec, rate, cmiuid, telecmi_notes, error_message)
// that the LeadActivity feed can't render.

import React, { useMemo, useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  MessageSquare,
  RefreshCw,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { useTelephony } from '@/hooks/useTelephony';
import { useUsers } from '@/hooks/useUsers';
import { placeCall } from '@/lib/telephonyController';
import { SendSMSDialog } from '@/components/telephony/SendSMSDialog';
import { Pager } from '@/components/telephony/Pager';
import { formatDuration, safeRelative, safeExact, msToExact } from '@/lib/telephonyFormat';
import {
  Direction,
  CallType,
  SmsStatus,
  type CallLog,
  type SMSLog,
  type TeleCMINote,
} from '@/types/telephony.types';

const PAGE_SIZE = 10;

interface LeadTelephonyHistoryProps {
  leadId: number;
  leadName: string;
  leadPhone?: string;
  telephonyEnabled: boolean;
  onRequireSetup: () => void;
}

// ── one call row ────────────────────────────────────────────────
const CallRow: React.FC<{ call: CallLog }> = ({ call }) => {
  const [showNotes, setShowNotes] = useState(false);
  const inbound = call.direction === Direction.INBOUND;
  const missed = call.call_type === CallType.MISSED || call.duration <= 0;
  const DirIcon = missed ? PhoneMissed : inbound ? PhoneIncoming : PhoneOutgoing;
  const title = call.caller_name || (inbound ? call.from_number : call.to_number) || 'Unknown';
  const notes: TeleCMINote[] = Array.isArray(call.telecmi_notes) ? call.telecmi_notes : [];

  return (
    <div className="py-2.5 border-b last:border-b-0">
      <div className="flex items-start gap-3">
        <DirIcon className={`h-4 w-4 mt-0.5 shrink-0 ${missed ? 'text-red-600' : inbound ? 'text-blue-600' : 'text-green-600'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium truncate">{title}</span>
            <Badge
              variant="secondary"
              className={missed ? 'bg-red-100 text-red-700 hover:bg-red-100' : 'bg-green-100 text-green-700 hover:bg-green-100'}
            >
              {missed ? 'Missed' : 'Answered'}
            </Badge>
            <span className="text-xs text-muted-foreground capitalize">{call.direction_display || call.direction}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5 font-mono truncate">
            {call.from_number} → {call.to_number}
          </div>
          {notes.length > 0 && (
            <button
              type="button"
              onClick={() => setShowNotes((v) => !v)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-1"
            >
              <ChevronDown className={`h-3 w-3 transition-transform ${showNotes ? 'rotate-180' : ''}`} />
              {notes.length} note{notes.length === 1 ? '' : 's'}
            </button>
          )}
          {showNotes && (
            <div className="mt-1.5 space-y-1">
              {notes.map((n, i) => (
                <div key={i} className="text-xs bg-muted/60 rounded px-2 py-1">
                  <p className="whitespace-pre-wrap">{n.msg}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {n.agent}
                    {n.date ? ` · ${msToExact(n.date)}` : ''}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className={`text-sm font-medium ${missed ? 'text-red-600' : ''}`}>
            {formatDuration(call.duration, call.call_type)}
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-xs text-muted-foreground cursor-default">{safeRelative(call.call_time)}</span>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p className="text-xs">{safeExact(call.call_time)}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
};

// ── one SMS row ─────────────────────────────────────────────────
const SmsRow: React.FC<{ sms: SMSLog; senderName: string }> = ({ sms, senderName }) => {
  const [expanded, setExpanded] = useState(false);
  const failed = sms.status === SmsStatus.FAILED;

  return (
    <div className="py-2.5 border-b last:border-b-0">
      <div className="flex items-start gap-3">
        <MessageSquare className={`h-4 w-4 mt-0.5 shrink-0 ${failed ? 'text-red-600' : 'text-green-600'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="secondary"
              className={failed ? 'bg-red-100 text-red-700 hover:bg-red-100' : 'bg-green-100 text-green-700 hover:bg-green-100'}
            >
              {sms.status_display || (failed ? 'Failed' : 'Sent')}
            </Badge>
            <span className="text-xs text-muted-foreground font-mono truncate">{sms.to_number}</span>
          </div>
          <p
            className={`text-sm mt-1 whitespace-pre-wrap ${expanded ? '' : 'line-clamp-2'} ${sms.message ? 'cursor-pointer' : ''}`}
            onClick={() => sms.message && setExpanded((v) => !v)}
          >
            {sms.message}
          </p>
          {failed && sms.error_message && (
            <p className="text-xs text-red-600 mt-1">⚠ {sms.error_message}</p>
          )}
          <p className="text-[11px] text-muted-foreground mt-1">
            {senderName !== '—' ? `Sent by ${senderName} · ` : ''}
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-default">{safeRelative(sms.created_at)}</span>
              </TooltipTrigger>
              <TooltipContent side="left">
                <p className="text-xs">{safeExact(sms.created_at)}</p>
              </TooltipContent>
            </Tooltip>
          </p>
        </div>
      </div>
    </div>
  );
};

// ── main component ──────────────────────────────────────────────
export const LeadTelephonyHistory: React.FC<LeadTelephonyHistoryProps> = ({
  leadId,
  leadName,
  leadPhone,
  telephonyEnabled,
  onRequireSetup,
}) => {
  const { useLeadCalls, useLeadSMS } = useTelephony();
  const { useUsersList } = useUsers();

  const [callsPage, setCallsPage] = useState(1);
  const [smsPage, setSmsPage] = useState(1);
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);

  const calls = useLeadCalls(leadId, callsPage, PAGE_SIZE);
  const sms = useLeadSMS(leadId, smsPage, PAGE_SIZE);

  // Resolve SMS sender UUIDs -> names (cheap: single cached users list).
  const { data: usersData } = useUsersList({ page_size: 100 });
  const nameById = useMemo(() => {
    const map = new Map<string, string>();
    (usersData?.results || []).forEach((u) => {
      map.set(u.id, u.full_name || `${u.first_name} ${u.last_name}`.trim() || u.email);
    });
    return map;
  }, [usersData]);

  const callRows = calls.data?.results || [];
  const smsRows = sms.data?.results || [];
  const callCount = calls.data?.count ?? 0;
  const smsCount = sms.data?.count ?? 0;

  const handleCall = () => {
    if (!leadPhone) return;
    void placeCall({ toNumber: leadPhone, leadId }, { onRequireSetup });
  };

  return (
    <div className="space-y-4">
      {/* ── Calls section ───────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Calls ({callCount})
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => calls.mutate()}
                disabled={calls.isValidating}
                aria-label="Refresh calls"
              >
                {calls.isValidating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              </Button>
              {telephonyEnabled && leadPhone && (
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleCall}>
                  <Phone className="h-3.5 w-3.5" />
                  Call
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {calls.isLoading && callRows.length === 0 ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : callRows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No calls yet for this lead.</p>
          ) : (
            <>
              {callRows.map((c) => (
                <CallRow key={c.id} call={c} />
              ))}
              <Pager
                page={callsPage}
                pageSize={PAGE_SIZE}
                count={callCount}
                onPrev={() => setCallsPage((p) => Math.max(1, p - 1))}
                onNext={() => setCallsPage((p) => p + 1)}
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* ── SMS section ─────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              SMS ({smsCount})
            </CardTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => sms.mutate()}
                disabled={sms.isValidating}
                aria-label="Refresh SMS"
              >
                {sms.isValidating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              </Button>
              {telephonyEnabled && leadPhone && (
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => setSmsDialogOpen(true)}>
                  <MessageSquare className="h-3.5 w-3.5" />
                  Send SMS
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {sms.isLoading && smsRows.length === 0 ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : smsRows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No SMS yet for this lead.</p>
          ) : (
            <>
              {smsRows.map((s) => (
                <SmsRow key={s.id} sms={s} senderName={(s.sent_by_user_id && nameById.get(s.sent_by_user_id)) || '—'} />
              ))}
              <Pager
                page={smsPage}
                pageSize={PAGE_SIZE}
                count={smsCount}
                onPrev={() => setSmsPage((p) => Math.max(1, p - 1))}
                onNext={() => setSmsPage((p) => p + 1)}
              />
            </>
          )}
        </CardContent>
      </Card>

      <SendSMSDialog
        open={smsDialogOpen}
        onOpenChange={setSmsDialogOpen}
        target={leadPhone ? { leadId, phone: leadPhone, name: leadName } : null}
      />
    </div>
  );
};

export default LeadTelephonyHistory;
