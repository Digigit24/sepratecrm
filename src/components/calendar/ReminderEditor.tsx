// src/components/calendar/ReminderEditor.tsx
import { Bell, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { MeetingReminderRule } from '@/types/meeting.types';

interface ReminderEditorProps {
  value: MeetingReminderRule[];
  onChange: (rules: MeetingReminderRule[]) => void;
  disabled?: boolean;
}

const PRESETS = [
  { minutes: 5, label: '5 minutes before' },
  { minutes: 10, label: '10 minutes before' },
  { minutes: 30, label: '30 minutes before' },
  { minutes: 60, label: '1 hour before' },
  { minutes: 1440, label: '1 day before' },
];

const METHODS: Array<{ value: NonNullable<MeetingReminderRule['method']>; label: string }> = [
  { value: 'IN_APP', label: 'In app' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
];

/**
 * Reminder rules for a meeting. These map to `MeetingReminder` rows server-side
 * and are materialised into the existing `notifications.Reminder` delivery
 * pipeline, so a meeting can legitimately carry several (1 day before AND
 * 10 minutes before) — which is why this is a list, not a single value.
 */
export function ReminderEditor({ value, onChange, disabled }: ReminderEditorProps) {
  const add = (minutes: number) => {
    if (value.some((r) => r.minutes_before === minutes)) return;
    onChange([...value, { minutes_before: minutes, method: 'IN_APP' }]);
  };

  const remove = (index: number) => onChange(value.filter((_, i) => i !== index));

  const patch = (index: number, changes: Partial<MeetingReminderRule>) =>
    onChange(value.map((rule, i) => (i === index ? { ...rule, ...changes } : rule)));

  return (
    <div className="space-y-2">
      {value.length ? (
        <ul className="space-y-1.5">
          {value.map((rule, index) => (
            <li key={`${rule.minutes_before}-${index}`} className="flex items-center gap-2">
              <Bell className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
              <Input
                type="number"
                min={0}
                max={40320}
                disabled={disabled}
                value={rule.minutes_before}
                onChange={(e) => patch(index, { minutes_before: Number(e.target.value) || 0 })}
                className="h-9 w-20"
                aria-label="Minutes before"
              />
              <span className="text-xs text-muted-foreground">min before</span>
              <Select
                value={rule.method ?? 'IN_APP'}
                disabled={disabled}
                onValueChange={(method) =>
                  patch(index, { method: method as MeetingReminderRule['method'] })
                }
              >
                <SelectTrigger className="h-9 w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!disabled ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 flex-shrink-0"
                  onClick={() => remove(index)}
                  aria-label="Remove reminder"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">No reminders.</p>
      )}

      {!disabled ? (
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => (
            <Button
              key={preset.minutes}
              type="button"
              variant="outline"
              className="h-7 px-2 text-xs"
              disabled={value.some((r) => r.minutes_before === preset.minutes)}
              onClick={() => add(preset.minutes)}
            >
              <Plus className="mr-1 h-3 w-3" />
              {preset.label}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default ReminderEditor;
