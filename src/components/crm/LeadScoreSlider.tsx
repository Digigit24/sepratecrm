// src/components/crm/LeadScoreSlider.tsx
// Minimal sleek score pill — opens a horizontal slider popover
import { useState, useCallback, useEffect, useRef } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface LeadScoreSliderProps {
  score: number;
  onSave: (score: number) => Promise<void>;
  leadName: string;
  size?: 'sm' | 'md' | 'lg'; // kept for compat — we ignore it, always render slim
  showLabel?: boolean;
}

// ── Colour ramp ─────────────────────────────────────────────────────
function scoreColor(s: number) {
  if (s === 0)  return { dot: '#94a3b8', bar: '#e2e8f0', text: 'text-slate-400' };
  if (s <= 25)  return { dot: '#3b82f6', bar: '#bfdbfe', text: 'text-blue-500' };
  if (s <= 50)  return { dot: '#f59e0b', bar: '#fde68a', text: 'text-amber-500' };
  if (s <= 75)  return { dot: '#f97316', bar: '#fed7aa', text: 'text-orange-500' };
  return         { dot: '#ef4444', bar: '#fecaca', text: 'text-red-500' };
}

function scoreLabel(s: number) {
  if (s === 0)  return 'Unset';
  if (s <= 25)  return 'Cold';
  if (s <= 50)  return 'Warm';
  if (s <= 75)  return 'Hot';
  return         'On fire';
}

export const LeadScoreSlider: React.FC<LeadScoreSliderProps> = ({
  score = 0,
  onSave,
  leadName,
}) => {
  const [open, setOpen]         = useState(false);
  const [local, setLocal]       = useState(score);
  const [saving, setSaving]     = useState(false);
  const committed               = useRef(score);
  const saveTimer               = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLocal(score);
    committed.current = score;
  }, [score]);

  // Debounced auto-save after dragging stops
  const handleChange = useCallback((val: number) => {
    setLocal(val);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      if (val === committed.current) return;
      setSaving(true);
      try {
        await onSave(val);
        committed.current = val;
        toast.success(`Score updated · ${leadName}`);
      } catch {
        setLocal(committed.current);
        toast.error('Failed to update score');
      } finally {
        setSaving(false);
      }
    }, 500);
  }, [onSave, leadName]);

  const { dot, bar, text } = scoreColor(local);
  const label = scoreLabel(local);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {/* ── Pill trigger ─── */}
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1.5 h-6 px-2 rounded-full transition-all',
            'border border-border/50 hover:border-border bg-muted/40 hover:bg-muted/70',
            'text-xs font-medium select-none cursor-pointer',
            saving && 'opacity-60 pointer-events-none',
          )}
        >
          {/* Colour dot */}
          <span
            className="w-2 h-2 rounded-full flex-shrink-0 transition-colors"
            style={{ backgroundColor: dot }}
          />
          {/* Number */}
          <span className={cn('tabular-nums leading-none', text)}>
            {local > 0 ? local : '—'}
          </span>
        </button>
      </PopoverTrigger>

      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={6}
        className="w-56 p-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-muted-foreground">Lead score</p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className={cn('text-2xl font-bold tabular-nums leading-none', text)}>
                {local}
              </span>
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          </div>
          {saving && (
            <span className="text-[10px] text-muted-foreground animate-pulse">Saving…</span>
          )}
        </div>

        {/* Horizontal slider */}
        <div className="relative">
          {/* Track fill */}
          <div className="relative h-1.5 rounded-full bg-muted overflow-hidden mb-1">
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all duration-75"
              style={{
                width: `${local}%`,
                backgroundColor: dot,
              }}
            />
          </div>

          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={local}
            onChange={e => handleChange(Number(e.target.value))}
            className="absolute inset-0 w-full opacity-0 cursor-pointer h-1.5"
            style={{ margin: 0 }}
          />
        </div>

        {/* Tick marks */}
        <div className="flex justify-between mt-2 mb-3">
          {[0, 25, 50, 75, 100].map(v => (
            <button
              key={v}
              type="button"
              onClick={() => handleChange(v)}
              className={cn(
                'text-[10px] tabular-nums transition-colors hover:text-foreground',
                local === v ? 'text-foreground font-semibold' : 'text-muted-foreground',
              )}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Mini colour bar showing the range */}
        <div
          className="h-1 rounded-full w-full"
          style={{
            background: 'linear-gradient(to right, #94a3b8 0%, #3b82f6 25%, #f59e0b 50%, #f97316 75%, #ef4444 100%)',
          }}
        />
      </PopoverContent>
    </Popover>
  );
};

export default LeadScoreSlider;
