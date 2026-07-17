// src/components/copilot/tools/shared.tsx
//
// Shared building blocks for the copilot tool cards: a card shell, the
// Approve/Cancel confirm bar (driven by the confirmationBridge), a result
// block, and small helpers. Used by ToolFallback and the first-class tool UIs.

import type { ReactNode } from 'react';
import { Check, X, Loader2, AlertTriangle, ShieldQuestion, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAwaitingConfirmation, resolveConfirmation } from '@/lib/confirmationBridge';

export type ToolPhase = 'awaiting' | 'running' | 'done' | 'error' | 'cancelled';

/** Derive the visual phase of a tool call from its result + pending state. */
export function useToolPhase(toolCallId: string, result: unknown, isError?: boolean): ToolPhase {
  const awaiting = useAwaitingConfirmation(toolCallId);
  if (awaiting) return 'awaiting';
  if (result === undefined || result === null) return 'running';
  const r = result as any;
  if (r && typeof r === 'object' && (r.cancelled || r.declined_by_user)) return 'cancelled';
  if (isError) return 'error';
  return 'done';
}

export function ToolCard({
  icon,
  title,
  phase,
  children,
}: {
  icon: ReactNode;
  title: string;
  phase: ToolPhase;
  children?: ReactNode;
}) {
  const ring =
    phase === 'awaiting'
      ? 'border-amber-300/70 bg-amber-50/50 dark:bg-amber-950/20'
      : phase === 'error'
      ? 'border-destructive/40 bg-destructive/5'
      : phase === 'cancelled'
      ? 'border-border bg-muted/40'
      : 'border-border bg-card';

  return (
    <div className={cn('my-1.5 rounded-xl border px-3 py-2.5 text-sm', ring)}>
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-background/70 border border-border/60">
          {icon}
        </span>
        <span className="font-medium text-foreground">{title}</span>
        <span className="ml-auto">
          <PhaseBadge phase={phase} />
        </span>
      </div>
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}

function PhaseBadge({ phase }: { phase: ToolPhase }) {
  switch (phase) {
    case 'awaiting':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600">
          <ShieldQuestion className="h-3.5 w-3.5" /> Needs approval
        </span>
      );
    case 'running':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Running
        </span>
      );
    case 'error':
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-destructive">
          <AlertTriangle className="h-3.5 w-3.5" /> Failed
        </span>
      );
    case 'cancelled':
      return <span className="text-[11px] text-muted-foreground">Cancelled</span>;
    default:
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-green-600">
          <Check className="h-3.5 w-3.5" /> Done
        </span>
      );
  }
}

/** Approve / Cancel bar shown for write tools awaiting confirmation. */
export function ConfirmBar({ toolCallId }: { toolCallId: string }) {
  return (
    <div className="flex items-center gap-2 border-t border-amber-300/40 pt-2">
      <p className="mr-auto text-xs text-muted-foreground">Review the details, then approve to run.</p>
      <Button
        size="sm"
        variant="outline"
        className="h-7 gap-1 text-xs"
        onClick={() => resolveConfirmation(toolCallId, 'cancel')}
      >
        <X className="h-3.5 w-3.5" /> Cancel
      </Button>
      <Button
        size="sm"
        className="h-7 gap-1 text-xs"
        onClick={() => resolveConfirmation(toolCallId, 'approve')}
      >
        <Check className="h-3.5 w-3.5" /> Approve
      </Button>
    </div>
  );
}

/** Key/value rows for tool args. */
export function ArgRows({ args, only }: { args: Record<string, unknown>; only?: string[] }) {
  const entries = Object.entries(args ?? {}).filter(
    ([k, v]) => (!only || only.includes(k)) && v !== undefined && v !== null && v !== '',
  );
  if (!entries.length) return null;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
      {entries.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground capitalize">{k.replace(/_/g, ' ')}</dt>
          <dd className="truncate text-foreground">{String(typeof v === 'object' ? JSON.stringify(v) : v)}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Collapsible raw result / error block. */
export function ResultBlock({ result, isError }: { result: unknown; isError?: boolean }) {
  const [open, setOpen] = useState(false);
  if (result === undefined || result === null) return null;
  const text = typeof result === 'string' ? result : safeStringify(result);
  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
      >
        <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
        {isError ? 'Error details' : 'Result'}
      </button>
      {open && (
        <pre
          className={cn(
            'mt-1 max-h-48 overflow-auto rounded-md border p-2 text-[11px] leading-relaxed',
            isError ? 'border-destructive/30 bg-destructive/5 text-destructive' : 'border-border bg-muted/40',
          )}
        >
          {text}
        </pre>
      )}
    </div>
  );
}

export function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}
