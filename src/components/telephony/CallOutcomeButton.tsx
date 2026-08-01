// src/components/telephony/CallOutcomeButton.tsx
// Disposition badge / dropdown for a call's outcome. Used in CallLogsPage's
// table and in LeadTelephonyHistory's call rows.
import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Phone,
  TrendingUp,
  Ban,
  ChevronDown,
  Loader2,
  Tag,
} from 'lucide-react';
import { toast } from 'sonner';
import { telephonyService } from '@/services/telephonyService';
import { CallOutcome } from '@/types/telephony.types';
import { cn } from '@/lib/utils';

// ── Outcome config ────────────────────────────────────────────────────────────

const OUTCOMES = [
  {
    value: CallOutcome.INTERESTED,
    label: 'Interested',
    icon: CheckCircle2,
    iconColor: 'text-green-600',
    badgeClass: 'bg-green-100 text-green-700 border-green-200',
  },
  {
    value: CallOutcome.CONVERTED,
    label: 'Converted',
    icon: TrendingUp,
    iconColor: 'text-emerald-600',
    badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  },
  {
    value: CallOutcome.FOLLOW_UP,
    label: 'Follow Up',
    icon: Clock,
    iconColor: 'text-blue-600',
    badgeClass: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  {
    value: CallOutcome.CALLBACK,
    label: 'Callback',
    icon: Phone,
    iconColor: 'text-amber-600',
    badgeClass: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  {
    value: CallOutcome.NOT_INTERESTED,
    label: 'Not Interested',
    icon: XCircle,
    iconColor: 'text-orange-600',
    badgeClass: 'bg-orange-100 text-orange-700 border-orange-200',
  },
  {
    value: CallOutcome.DND,
    label: 'DND',
    icon: Ban,
    iconColor: 'text-red-600',
    badgeClass: 'bg-red-100 text-red-700 border-red-200',
  },
] as const;

const OUTCOME_MAP = Object.fromEntries(OUTCOMES.map((o) => [o.value, o])) as Record<
  CallOutcome,
  (typeof OUTCOMES)[number]
>;

// ── Props ─────────────────────────────────────────────────────────────────────

interface CallOutcomeButtonProps {
  callId: number;
  currentOutcome?: CallOutcome | string | null;
  onOutcomeSet?: (outcome: string) => void;
  /** 'sm' = standard button height (h-7); 'xs' = compact (h-6, smaller text) */
  size?: 'sm' | 'xs';
}

// ── Component ─────────────────────────────────────────────────────────────────

export const CallOutcomeButton: React.FC<CallOutcomeButtonProps> = ({
  callId,
  currentOutcome,
  onOutcomeSet,
  size = 'sm',
}) => {
  const [loading, setLoading] = useState(false);
  const [localOutcome, setLocalOutcome] = useState<string | null | undefined>(currentOutcome);

  // Keep local state in sync if the prop changes (e.g. after SWR revalidation)
  useEffect(() => {
    setLocalOutcome(currentOutcome);
  }, [currentOutcome]);

  const handleSelect = async (value: string) => {
    if (loading) return;
    setLoading(true);
    const previous = localOutcome;
    // Optimistic update
    setLocalOutcome(value);
    try {
      await telephonyService.setCallOutcome(callId, { outcome: value });
      onOutcomeSet?.(value);
      const label = OUTCOME_MAP[value as CallOutcome]?.label ?? value;
      toast.success(`Outcome: ${label}`);
    } catch {
      // Roll back on failure
      setLocalOutcome(previous ?? null);
      toast.error('Failed to save outcome');
    } finally {
      setLoading(false);
    }
  };

  const cfg = localOutcome ? OUTCOME_MAP[localOutcome as CallOutcome] : null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {cfg ? (
          // Filled badge — outcome already set
          <button
            type="button"
            aria-label={`Outcome: ${cfg.label}. Click to change.`}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2 py-0.5',
              'text-xs font-medium transition-opacity focus-visible:outline-none',
              'hover:opacity-75 disabled:opacity-50 disabled:cursor-not-allowed',
              cfg.badgeClass,
            )}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>
                <cfg.icon className="h-3 w-3" />
                {cfg.label}
                <ChevronDown className="h-2.5 w-2.5 opacity-60" />
              </>
            )}
          </button>
        ) : (
          // Empty button
          <Button
            type="button"
            variant="outline"
            className={cn(
              'gap-1 text-muted-foreground hover:text-foreground font-normal',
              size === 'xs' ? 'h-6 px-2 text-[10px] rounded-full' : 'h-7 px-2.5 text-xs',
            )}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>
                <Tag className="h-3 w-3" />
                Set Outcome
                <ChevronDown className="h-2.5 w-2.5" />
              </>
            )}
          </Button>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-[168px]">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          {cfg ? 'Change outcome' : 'Set call outcome'}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {OUTCOMES.map((o) => {
          const Icon = o.icon;
          const isCurrent = localOutcome === o.value;
          return (
            <DropdownMenuItem
              key={o.value}
              onClick={() => handleSelect(o.value)}
              className={cn('gap-2 text-xs cursor-pointer', isCurrent && 'font-semibold')}
            >
              <Icon className={cn('h-3.5 w-3.5 shrink-0', o.iconColor)} />
              {o.label}
              {isCurrent && <CheckCircle2 className="h-3 w-3 ml-auto text-muted-foreground" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default CallOutcomeButton;
