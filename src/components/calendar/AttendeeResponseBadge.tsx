// src/components/calendar/AttendeeResponseBadge.tsx
import { Check, Clock, HelpCircle, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AttendeeResponse } from '@/types/calendar.types';

const RESPONSE_STYLES: Record<
  AttendeeResponse,
  { label: string; className: string; Icon: LucideIcon }
> = {
  ACCEPTED: {
    label: 'Accepted',
    className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 ring-emerald-500/20',
    Icon: Check,
  },
  DECLINED: {
    label: 'Declined',
    className: 'bg-red-500/10 text-red-700 dark:text-red-300 ring-red-500/20',
    Icon: X,
  },
  TENTATIVE: {
    label: 'Maybe',
    className: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 ring-amber-500/20',
    Icon: HelpCircle,
  },
  NEEDS_ACTION: {
    label: 'No response',
    className: 'bg-muted text-muted-foreground ring-border',
    Icon: Clock,
  },
};

interface AttendeeResponseBadgeProps {
  response?: AttendeeResponse | null;
  className?: string;
  showIcon?: boolean;
}

/**
 * Mode-badge geometry from UI_PRINCIPLES.md:
 * `rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset`.
 */
export function AttendeeResponseBadge({
  response,
  className,
  showIcon = true,
}: AttendeeResponseBadgeProps) {
  const style = RESPONSE_STYLES[response ?? 'NEEDS_ACTION'];
  const { Icon } = style;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset',
        style.className,
        className
      )}
    >
      {showIcon ? <Icon className="h-3 w-3" /> : null}
      {style.label}
    </span>
  );
}

export default AttendeeResponseBadge;
