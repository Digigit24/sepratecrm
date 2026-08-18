// src/components/calendar/RecurrenceEditor.tsx
import { useEffect, useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  WEEKDAY_LABELS,
  WEEKDAY_SHORT,
  buildRRule,
  defaultRecurrenceState,
  humanizeRRule,
  parseRRule,
  previewOccurrences,
  type RecurrenceFrequency,
  type RecurrenceState,
} from '@/utils/rruleHelpers';

interface RecurrenceEditorProps {
  /** Bare RRULE text, e.g. `FREQ=WEEKLY;BYDAY=TU;COUNT=8`. */
  value: string | null;
  onChange: (rule: string | null) => void;
  /** The event's start, as a zoned date — drives the preview and the default BYDAY. */
  startZoned: Date | null;
  timezone: string;
  disabled?: boolean;
}

const FREQUENCIES: Array<{ value: RecurrenceFrequency; label: string }> = [
  { value: 'DAILY', label: 'Day' },
  { value: 'WEEKLY', label: 'Week' },
  { value: 'MONTHLY', label: 'Month' },
  { value: 'YEARLY', label: 'Year' },
];

/**
 * Builds an RRULE string from a small state machine and shows both the
 * humanised rule and the next five occurrences, so the user can see what they
 * just described without a server round-trip.
 */
export function RecurrenceEditor({
  value,
  onChange,
  startZoned,
  timezone: _timezone,
  disabled,
}: RecurrenceEditorProps) {
  const [state, setState] = useState<RecurrenceState>(
    () => parseRRule(value) ?? defaultRecurrenceState(startZoned)
  );

  // Adopt an externally-supplied rule (e.g. when the drawer loads a meeting).
  useEffect(() => {
    const parsed = parseRRule(value);
    if (parsed) setState(parsed);
    else setState((s) => (s.enabled ? { ...s, enabled: false } : s));
  }, [value]);

  const update = (patch: Partial<RecurrenceState>) => {
    const next = { ...state, ...patch };
    setState(next);
    onChange(buildRRule(next));
  };

  const rule = useMemo(() => buildRRule(state), [state]);
  /*
   * `startZoned` is already projected into `timezone` (see calendarTime.ts), so
   * the occurrences rrule produces are ZONED dates: format them with plain
   * date-fns, not `formatInZone`, or the offset would be applied twice.
   */
  const preview = useMemo(
    () => previewOccurrences(rule, startZoned ?? null, 5),
    [rule, startZoned]
  );

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-[110px_1fr] items-center gap-3 py-2.5">
        <Label className="text-[13px] font-normal text-muted-foreground">Repeat</Label>
        <Switch
          checked={state.enabled}
          disabled={disabled}
          onCheckedChange={(enabled) => update({ enabled })}
          aria-label="Repeat this event"
        />
      </div>

      {state.enabled ? (
        <div className="space-y-2.5 rounded-md border border-border/60 p-3">
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-muted-foreground">Every</span>
            <Input
              type="number"
              min={1}
              max={99}
              disabled={disabled}
              value={state.interval}
              onChange={(e) => update({ interval: Number(e.target.value) || 1 })}
              className="h-9 w-16"
            />
            <Select
              value={state.freq}
              disabled={disabled}
              onValueChange={(freq) => update({ freq: freq as RecurrenceFrequency })}
            >
              <SelectTrigger className="h-9 w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCIES.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                    {state.interval > 1 ? 's' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {state.freq === 'WEEKLY' ? (
            <div className="flex items-center gap-1">
              {WEEKDAY_SHORT.map((short, index) => {
                const selected = state.byweekday.includes(index);
                return (
                  <button
                    key={WEEKDAY_LABELS[index]}
                    type="button"
                    disabled={disabled}
                    aria-pressed={selected}
                    aria-label={WEEKDAY_LABELS[index]}
                    onClick={() =>
                      update({
                        byweekday: selected
                          ? state.byweekday.filter((d) => d !== index)
                          : [...state.byweekday, index].sort((a, b) => a - b),
                      })
                    }
                    className={cn(
                      'h-7 w-7 rounded-full text-[11px] font-medium transition-colors',
                      selected
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground hover:bg-muted/70'
                    )}
                  >
                    {short}
                  </button>
                );
              })}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] text-muted-foreground">Ends</span>
            <Select
              value={state.endMode}
              disabled={disabled}
              onValueChange={(endMode) =>
                update({ endMode: endMode as RecurrenceState['endMode'] })
              }
            >
              <SelectTrigger className="h-9 w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="never">Never</SelectItem>
                <SelectItem value="count">After…</SelectItem>
                <SelectItem value="until">On date</SelectItem>
              </SelectContent>
            </Select>

            {state.endMode === 'count' ? (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={750}
                  disabled={disabled}
                  value={state.count ?? 10}
                  onChange={(e) => update({ count: Number(e.target.value) || 1 })}
                  className="h-9 w-20"
                />
                <span className="text-[13px] text-muted-foreground">occurrences</span>
              </div>
            ) : null}

            {state.endMode === 'until' ? (
              <Input
                type="date"
                disabled={disabled}
                value={state.until ?? ''}
                onChange={(e) => update({ until: e.target.value })}
                className="h-9 w-40"
              />
            ) : null}
          </div>

          {rule ? (
            <div className="space-y-1 border-t border-border/40 pt-2">
              <p className="text-xs font-medium text-foreground">{humanizeRRule(rule)}</p>
              {preview.length ? (
                <ul className="space-y-0.5">
                  {preview.map((date) => (
                    <li key={date.toISOString()} className="text-[11px] text-muted-foreground">
                      {format(date, 'EEE, d MMM yyyy')}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Set a start time to preview occurrences.
                </p>
              )}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default RecurrenceEditor;
