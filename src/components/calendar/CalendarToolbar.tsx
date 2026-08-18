// src/components/calendar/CalendarToolbar.tsx
import { useMemo } from 'react';
import { ChevronLeft, ChevronRight, Globe, Plus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  buildWeekDays,
  formatInZone,
  fromZoned,
  timeZoneLabel,
  toZoned,
  type WeekStartsOn,
} from '@/utils/calendarTime';
import type { CalendarView, TeamMode } from '@/types/calendar.types';

interface CalendarToolbarProps {
  view: CalendarView;
  anchorDate: Date;
  timezone: string;
  weekStartsOn: WeekStartsOn;
  teamMode: TeamMode;
  /** Both the client permission check AND the server's `can_view_team`. */
  canViewTeam: boolean;
  onViewChange: (view: CalendarView) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onTeamModeChange: (mode: TeamMode) => void;
  onCreate: () => void;
}

const VIEWS: Array<{ key: CalendarView; label: string; hint: string }> = [
  { key: 'month', label: 'Month', hint: 'M' },
  { key: 'week', label: 'Week', hint: 'W' },
  { key: 'day', label: 'Day', hint: 'D' },
  { key: 'agenda', label: 'Agenda', hint: 'A' },
];

const TEAM_MODES: Array<{ key: TeamMode; label: string }> = [
  { key: 'off', label: 'Mine' },
  { key: 'lanes', label: 'Lanes' },
  { key: 'overlay', label: 'Overlay' },
];

/**
 * Toolbar: navigation, the view switcher, the timezone badge and the
 * admin-gated team toggle.
 *
 * The team toggle is rendered only when the caller's own permissions say `all`
 * (or admin) AND the server's `can_view_team` agrees — fail closed on both
 * sides. The client half only exists to avoid a flash of a control the server
 * would then refuse.
 */
export function CalendarToolbar({
  view,
  anchorDate,
  timezone,
  weekStartsOn,
  teamMode,
  canViewTeam,
  onViewChange,
  onPrev,
  onNext,
  onToday,
  onTeamModeChange,
  onCreate,
}: CalendarToolbarProps) {
  /** Range label, always formatted in the calendar's timezone. */
  const rangeLabel = useMemo(() => {
    const zoned = toZoned(anchorDate, timezone);
    const asInstant = (d: Date) => fromZoned(d, timezone);

    if (view === 'month') return formatInZone(asInstant(zoned), timezone, 'MMMM yyyy');
    if (view === 'day') return formatInZone(asInstant(zoned), timezone, 'EEEE, d MMMM yyyy');
    if (view === 'agenda') return `From ${formatInZone(asInstant(zoned), timezone, 'd MMM yyyy')}`;

    const days = buildWeekDays(zoned, weekStartsOn);
    const first = days[0];
    const last = days[6];
    const sameMonth = first.getMonth() === last.getMonth();
    return sameMonth
      ? `${formatInZone(asInstant(first), timezone, 'd')} – ${formatInZone(asInstant(last), timezone, 'd MMM yyyy')}`
      : `${formatInZone(asInstant(first), timezone, 'd MMM')} – ${formatInZone(asInstant(last), timezone, 'd MMM yyyy')}`;
  }, [view, anchorDate, timezone, weekStartsOn]);

  return (
    <div className="flex flex-shrink-0 flex-wrap items-center gap-2 border-b border-border/60 px-4 py-2">
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={onPrev}
          aria-label="Previous"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={onNext}
          aria-label="Next"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
        <Button variant="outline" className="h-7 px-2.5 text-xs" onClick={onToday}>
          Today
        </Button>
      </div>

      <h1 className="ml-1 min-w-0 truncate text-base font-semibold">{rangeLabel}</h1>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {/* View switcher — segmented control */}
        <div className="flex items-center rounded-md border border-border/60 p-0.5">
          {VIEWS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => onViewChange(item.key)}
              aria-pressed={view === item.key}
              title={`${item.label} (${item.hint})`}
              className={cn(
                'h-6 rounded px-2 text-xs transition-colors',
                view === item.key
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {canViewTeam ? (
          <div className="flex items-center rounded-md border border-border/60 p-0.5">
            <Users className="mx-1 h-3.5 w-3.5 text-muted-foreground" />
            {TEAM_MODES.map((mode) => (
              <button
                key={mode.key}
                type="button"
                onClick={() => onTeamModeChange(mode.key)}
                aria-pressed={teamMode === mode.key}
                className={cn(
                  'h-6 rounded px-2 text-xs transition-colors',
                  teamMode === mode.key
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {mode.label}
              </button>
            ))}
          </div>
        ) : null}

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex h-7 items-center gap-1 rounded-md bg-muted px-2 text-[11px] font-medium text-muted-foreground ring-1 ring-inset ring-border">
                <Globe className="h-3 w-3" />
                {timeZoneLabel(timezone)}
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">Showing times in {timezone}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Button className="h-7 px-2.5 text-xs" onClick={onCreate}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          New event
        </Button>
      </div>
    </div>
  );
}

export default CalendarToolbar;
