// src/components/calendar/QuickCreatePopover.tsx
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useMeeting } from '@/hooks/useMeeting';
import { emitCrmDataChanged } from '@/lib/crmEvents';
import { formatEventTimeRange, safeTimeZone } from '@/utils/calendarTime';
import type { CalendarDraftEvent } from '@/types/calendar.types';

interface QuickCreatePopoverProps {
  draft: CalendarDraftEvent | null;
  /** Screen position to anchor at, from the click that produced the draft. */
  anchor: { x: number; y: number } | null;
  timezone: string;
  timeFormat?: '12h' | '24h';
  onClose: () => void;
  onCreated: () => void;
  /** "More options…" hands the draft to the full drawer. */
  onMoreOptions: (draft: CalendarDraftEvent) => void;
}

/**
 * Inline create on an empty slot — title + the resolved time range, then
 * `Create` or `More options…`. Modelled on `FollowupScheduleDialog.tsx`'s
 * lightweight-write shape: one field, one call, one toast.
 *
 * The slot has already been snapped to 15 minutes and converted to a UTC
 * instant by the grid, so this component never does timezone maths itself.
 */
export function QuickCreatePopover({
  draft,
  anchor,
  timezone,
  timeFormat = '12h',
  onClose,
  onCreated,
  onMoreOptions,
}: QuickCreatePopoverProps) {
  const { createMeeting } = useMeeting();
  const [title, setTitle] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (draft) setTitle(draft.title ?? '');
  }, [draft]);

  if (!draft || !anchor) return null;

  const submit = async () => {
    if (!title.trim()) {
      toast.error('Give the event a title');
      return;
    }
    setSaving(true);
    try {
      await createMeeting({
        title: title.trim(),
        start_at: draft.start_at,
        end_at: draft.end_at,
        all_day: draft.all_day,
        timezone: safeTimeZone(timezone),
        lead: draft.lead ?? null,
      });
      toast.success('Event created');
      emitCrmDataChanged({ resource: 'meetings' });
      onCreated();
      onClose();
    } catch (error) {
      toast.error((error as Error)?.message || 'Failed to create event');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Popover open onOpenChange={(next) => !next && onClose()}>
      {/* Invisible anchor pinned to the click coordinates. */}
      <PopoverTrigger asChild>
        <span
          className="pointer-events-none fixed h-0 w-0"
          style={{ left: anchor.x, top: anchor.y }}
          aria-hidden="true"
        />
      </PopoverTrigger>
      <PopoverContent align="start" side="right" className="w-72 p-3">
        <div className="space-y-2.5">
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void submit();
              }
              if (e.key === 'Escape') onClose();
            }}
            placeholder="Add a title"
            className="h-9"
          />
          <p className="text-xs text-muted-foreground">
            {formatEventTimeRange(draft, timezone, timeFormat)}
          </p>
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => {
                onMoreOptions({ ...draft, title });
                onClose();
              }}
            >
              More options…
            </Button>
            <Button type="button" className="h-7 px-3 text-xs" onClick={submit} disabled={saving}>
              {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
              Create
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default QuickCreatePopover;
