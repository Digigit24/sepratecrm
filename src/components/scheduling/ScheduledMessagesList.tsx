// ==================== SCHEDULED MESSAGES LIST ====================
// Component to view and manage scheduled messages

import React, { useEffect, useState, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useScheduling } from '@/hooks/useScheduling';
import {
  MESSAGE_STATUS,
  MESSAGE_STATUS_LABELS,
  MESSAGE_TYPES,
} from '@/constants/scheduling';
import {
  formatScheduleDate,
  getRelativeTime,
  getMessageStatusLabel,
  canCancelMessage,
  formatPhoneNumber,
} from '@/utils/scheduleHelpers';
import type { ScheduledMessage, MessageStatusFilter } from '@/types/scheduling.types';
import { RefreshCw, X, Clock, MessageSquare, Image, FileText } from 'lucide-react';

// ==================== STATUS BADGE ====================

function StatusBadge({ status }: { status: number }) {
  const label = getMessageStatusLabel(status);

  const variants: Record<number, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    [MESSAGE_STATUS.SCHEDULED]: 'default',
    [MESSAGE_STATUS.SENT]: 'secondary',
    [MESSAGE_STATUS.FAILED]: 'destructive',
    [MESSAGE_STATUS.CANCELLED]: 'outline',
  };

  return <Badge variant={variants[status] || 'outline'}>{label}</Badge>;
}

// ==================== MESSAGE TYPE ICON ====================

function MessageTypeIcon({ type }: { type: string }) {
  switch (type) {
    case MESSAGE_TYPES.TEMPLATE:
      return <FileText className="h-4 w-4 text-blue-500" />;
    case MESSAGE_TYPES.TEXT:
      return <MessageSquare className="h-4 w-4 text-green-500" />;
    case MESSAGE_TYPES.MEDIA:
      return <Image className="h-4 w-4 text-purple-500" />;
    default:
      return <MessageSquare className="h-4 w-4 text-gray-500" />;
  }
}

// ==================== LOADING SKELETON ====================

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center space-x-4">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-[250px]" />
            <Skeleton className="h-4 w-[200px]" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ==================== EMPTY STATE ====================

function EmptyState({ status }: { status: MessageStatusFilter }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Clock className="h-12 w-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold mb-2">No messages found</h3>
      <p className="text-muted-foreground">
        {status === 'scheduled'
          ? 'No messages are currently scheduled.'
          : `No ${status} messages to display.`}
      </p>
    </div>
  );
}

// ==================== MESSAGE ROW ====================

interface MessageRowProps {
  message: ScheduledMessage;
  onCancel: (uid: string) => void;
  cancelling: string | null;
}

function MessageRow({ message, onCancel, cancelling }: MessageRowProps) {
  const isCancelling = cancelling === message._uid;
  const canCancel = canCancelMessage(message.status);

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-2">
          <MessageTypeIcon type={message.message_type} />
          <span className="capitalize">{message.message_type}</span>
        </div>
      </TableCell>
      <TableCell>
        <div>
          <div className="font-medium">{formatPhoneNumber(message.contact_phone)}</div>
          {message.contact_name && (
            <div className="text-sm text-muted-foreground">{message.contact_name}</div>
          )}
        </div>
      </TableCell>
      <TableCell>
        {message.template_name ? (
          <code className="text-sm bg-muted px-2 py-1 rounded">{message.template_name}</code>
        ) : message.message_content ? (
          <span className="text-sm truncate max-w-[200px] block">
            {message.message_content.slice(0, 50)}
            {message.message_content.length > 50 && '...'}
          </span>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
      <TableCell>
        <div>
          <div className="font-medium">{formatScheduleDate(message.send_at)}</div>
          <div className="text-sm text-muted-foreground">
            {message.formatted_send_time || getRelativeTime(message.send_at)}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <StatusBadge status={message.status} />
      </TableCell>
      <TableCell>
        {canCancel ? (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                disabled={isCancelling}
                className="text-destructive hover:text-destructive"
              >
                {isCancelling ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <X className="h-4 w-4" />
                )}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel Scheduled Message</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to cancel this scheduled message to{' '}
                  {message.contact_name || message.contact_phone}? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep Message</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onCancel(message._uid)}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Cancel Message
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <span className="text-muted-foreground">-</span>
        )}
      </TableCell>
    </TableRow>
  );
}

// ==================== MAIN COMPONENT ====================

interface ScheduledMessagesListProps {
  initialStatus?: MessageStatusFilter;
  showHeader?: boolean;
  className?: string;
}

export function ScheduledMessagesList({
  initialStatus = 'scheduled',
  showHeader = true,
  className,
}: ScheduledMessagesListProps) {
  const {
    getScheduledMessages,
    cancelMessage,
    scheduledMessages,
    loading,
    error,
  } = useScheduling();

  const [statusFilter, setStatusFilter] = useState<MessageStatusFilter>(initialStatus);
  const [cancelling, setCancelling] = useState<string | null>(null);

  // Fetch messages on mount and when status changes
  useEffect(() => {
    getScheduledMessages(statusFilter);
  }, [statusFilter, getScheduledMessages]);

  // Handle cancel message
  const handleCancel = useCallback(async (messageUid: string) => {
    setCancelling(messageUid);
    await cancelMessage(messageUid);
    setCancelling(null);
  }, [cancelMessage]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    getScheduledMessages(statusFilter);
  }, [getScheduledMessages, statusFilter]);

  return (
    <Card className={className}>
      {showHeader && (
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Scheduled Messages</CardTitle>
              <CardDescription>View and manage your scheduled WhatsApp messages</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={statusFilter}
                onValueChange={(value) => setStatusFilter(value as MessageStatusFilter)}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Messages</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={handleRefresh} disabled={loading}>
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
      )}
      <CardContent>
        {error && (
          <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {loading && scheduledMessages.length === 0 ? (
          <LoadingSkeleton />
        ) : scheduledMessages.length === 0 ? (
          <EmptyState status={statusFilter} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Content</TableHead>
                <TableHead>Scheduled For</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scheduledMessages.map((message) => (
                <MessageRow
                  key={message._uid}
                  message={message}
                  onCancel={handleCancel}
                  cancelling={cancelling}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export default ScheduledMessagesList;
