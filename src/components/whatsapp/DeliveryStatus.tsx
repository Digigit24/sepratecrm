// src/components/whatsapp/DeliveryStatus.tsx
//
// WhatsApp delivery ticks, driven by the real `status` field.
//
//   pending    clock      the row is a local echo, not yet acknowledged
//   sent       ✓          Meta accepted it
//   delivered  ✓✓         it reached the handset
//   read       ✓✓ blue    the recipient opened it
//   failed     ⚠ + reason  with a retry affordance
//
// Outbound only. Inbound messages carry no meaningful status and the normaliser
// already nulls it out, but we defend here too — a stray tick on a received
// message reads as a bug.

import React from 'react';
import { Check, CheckCheck, Clock, AlertCircle, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { WhatsAppMessageStatus } from '@/types/whatsapp/message';

export interface DeliveryStatusProps {
  status: WhatsAppMessageStatus | null;
  /** Only 'out' renders anything. */
  direction: 'in' | 'out';
  /** Failure reason from the backend, shown next to the retry control. */
  error?: string | null;
  /** Supplied when the message can be resent. */
  onRetry?: () => void;
  className?: string;
}

const LABEL: Record<WhatsAppMessageStatus, string> = {
  pending: 'Sending',
  sent: 'Sent',
  delivered: 'Delivered',
  read: 'Read',
  failed: 'Failed to send',
};

export const DeliveryStatus: React.FC<DeliveryStatusProps> = ({
  status,
  direction,
  error,
  onRetry,
  className,
}) => {
  if (direction !== 'out' || !status) return null;

  if (status === 'failed') {
    return (
      <span
        className={cn('inline-flex items-center gap-1 text-destructive', className)}
        data-testid="delivery-status"
        data-status="failed"
      >
        <AlertCircle className="h-3 w-3 shrink-0" aria-hidden="true" />
        <span className="sr-only">{LABEL.failed}</span>
        {error ? (
          <span className="text-[11px] leading-none max-w-[180px] truncate" title={error}>
            {error}
          </span>
        ) : null}
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-0.5 text-[11px] font-medium underline underline-offset-2 hover:no-underline"
            aria-label="Retry sending this message"
          >
            <RotateCw className="h-3 w-3" aria-hidden="true" />
            Retry
          </button>
        ) : null}
      </span>
    );
  }

  const icon =
    status === 'pending' ? (
      <Clock className="h-3 w-3 opacity-70" aria-hidden="true" />
    ) : status === 'sent' ? (
      <Check className="h-3 w-3" aria-hidden="true" />
    ) : status === 'delivered' ? (
      <CheckCheck className="h-3 w-3" aria-hidden="true" />
    ) : (
      <CheckCheck className="h-3 w-3 text-[#53bdeb]" aria-hidden="true" />
    );

  return (
    <span
      className={cn('inline-flex items-center', className)}
      title={LABEL[status]}
      data-testid="delivery-status"
      data-status={status}
    >
      {icon}
      <span className="sr-only">{LABEL[status]}</span>
    </span>
  );
};

export default DeliveryStatus;
