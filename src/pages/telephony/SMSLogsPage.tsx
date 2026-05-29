// src/pages/telephony/SMSLogsPage.tsx
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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RefreshCw, Loader2, ExternalLink, MessageSquare, Send } from 'lucide-react';
import { useTelephony } from '@/hooks/useTelephony';
import { useUsers } from '@/hooks/useUsers';
import { Pager } from '@/components/telephony/Pager';
import { SendSMSDialog } from '@/components/telephony/SendSMSDialog';
import { safeRelative, safeExact } from '@/lib/telephonyFormat';
import { SmsStatus, type SMSLogsQueryParams } from '@/types/telephony.types';

const PAGE_SIZE = 25;

export const SMSLogsPage: React.FC = () => {
  const navigate = useNavigate();
  const { useSMS } = useTelephony();
  const { useUsersList } = useUsers();

  const [status, setStatus] = useState<'all' | SmsStatus>('all');
  const [leadIdInput, setLeadIdInput] = useState('');
  const [senderId, setSenderId] = useState<'all' | string>('all');
  const [page, setPage] = useState(1);
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);

  const params: SMSLogsQueryParams = useMemo(() => {
    const leadId = leadIdInput.trim() ? parseInt(leadIdInput.trim(), 10) : undefined;
    return {
      status: status === 'all' ? undefined : status,
      lead_id: Number.isFinite(leadId) ? leadId : undefined,
      sent_by_user_id: senderId === 'all' ? undefined : senderId,
      ordering: '-created_at',
      page,
      page_size: PAGE_SIZE,
    };
  }, [status, leadIdInput, senderId, page]);

  const { data, error, isLoading, isValidating, mutate } = useSMS(params);
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

  const resetPageAnd = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(1);
  };

  return (
    <div className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-semibold">SMS Logs</h1>
          <span className="text-xs text-muted-foreground">{count} total</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => mutate()} disabled={isValidating} title="Refresh">
            <RefreshCw className={`h-3.5 w-3.5 ${isValidating ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" className="h-7 text-xs gap-1" onClick={() => setSmsDialogOpen(true)}>
            <Send className="h-3.5 w-3.5" />
            Send SMS
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={status} onValueChange={resetPageAnd((v) => setStatus(v as 'all' | SmsStatus))}>
          <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value={SmsStatus.SENT}>Sent</SelectItem>
            <SelectItem value={SmsStatus.FAILED}>Failed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={senderId} onValueChange={resetPageAnd((v) => setSenderId(v))}>
          <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue placeholder="Sender" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All senders</SelectItem>
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
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        {error ? (
          <div className="flex flex-col items-center gap-2 py-10">
            <p className="text-sm text-destructive">Failed to load SMS logs.</p>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => mutate()}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
            </Button>
          </div>
        ) : isLoading && rows.length === 0 ? (
          <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">No SMS logs found.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[90px]">Status</TableHead>
                <TableHead className="hidden md:table-cell">To</TableHead>
                <TableHead>Message</TableHead>
                <TableHead className="hidden lg:table-cell">Sender</TableHead>
                <TableHead className="text-right">When</TableHead>
                <TableHead className="w-[40px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((sms) => {
                const failed = sms.status === SmsStatus.FAILED;
                return (
                  <TableRow key={sms.id}>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={failed ? 'bg-red-100 text-red-700 hover:bg-red-100' : 'bg-green-100 text-green-700 hover:bg-green-100'}
                      >
                        {sms.status_display || (failed ? 'Failed' : 'Sent')}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-xs font-mono text-muted-foreground">{sms.to_number}</TableCell>
                    <TableCell className="max-w-[360px]">
                      <p className="text-sm line-clamp-2">{sms.message}</p>
                      {failed && sms.error_message && (
                        <p className="text-xs text-red-600 mt-0.5">⚠ {sms.error_message}</p>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                      {(sms.sent_by_user_id && nameById.get(sms.sent_by_user_id)) || '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-xs text-muted-foreground cursor-default">{safeRelative(sms.created_at)}</span>
                        </TooltipTrigger>
                        <TooltipContent side="left"><p className="text-xs">{safeExact(sms.created_at)}</p></TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      {sms.lead_id ? (
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="View lead" onClick={() => navigate(`/crm/leads/${sms.lead_id}`)}>
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

      {/* Send SMS (no pre-filled lead) — refresh on close in case one was sent */}
      <SendSMSDialog
        open={smsDialogOpen}
        onOpenChange={(o) => {
          setSmsDialogOpen(o);
          if (!o) mutate();
        }}
        target={{ phone: '' }}
      />
    </div>
  );
};

export default SMSLogsPage;
