// src/components/calendar/CalendarSidebar.tsx
import { CalendarCheck2, CheckSquare, Clock3, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { CALENDAR_COLORS, memberColor } from '@/lib/calendarColors';
import type { CalendarLayer, CalendarMember } from '@/types/calendar.types';
import { CalendarLegend } from './CalendarLegend';
import { MiniMonthPicker } from './MiniMonthPicker';

interface CalendarSidebarProps {
  anchorDate: Date;
  timezone: string;
  onSelectDate: (date: Date) => void;

  visibleLayers: CalendarLayer[];
  onToggleLayer: (layer: CalendarLayer) => void;

  members: CalendarMember[];
  visibleUserIds: string[];
  onToggleUser: (userId: string) => void;
  canViewTeam: boolean;
  membersUnavailable?: boolean;
}

const LAYERS: Array<{ key: CalendarLayer; label: string; icon: LucideIcon; colorKey: keyof typeof CALENDAR_COLORS }> = [
  { key: 'meetings', label: 'Meetings', icon: CalendarCheck2, colorKey: 'meeting' },
  { key: 'tasks', label: 'Tasks', icon: CheckSquare, colorKey: 'task' },
  { key: 'follow_ups', label: 'Follow-ups', icon: Clock3, colorKey: 'follow_up' },
];

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="px-0.5 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
    {children}
  </p>
);

/**
 * The left rail of toggleable calendars.
 *
 * Layer toggling is entirely CLIENT-side over the single merged feed the
 * backend returns — the feed already carries `source` / `owner_user_id` per
 * item, so hiding a layer costs no request. Person toggling does change the
 * request (`user_ids`), because the server must re-run permission scoping.
 */
export function CalendarSidebar({
  anchorDate,
  timezone,
  onSelectDate,
  visibleLayers,
  onToggleLayer,
  members,
  visibleUserIds,
  onToggleUser,
  canViewTeam,
  membersUnavailable,
}: CalendarSidebarProps) {
  return (
    <aside className="hidden w-56 flex-shrink-0 flex-col border-r border-border/60 bg-background lg:flex">
      <ScrollArea className="h-full">
        <div className="space-y-4 p-3">
          <MiniMonthPicker anchorDate={anchorDate} timezone={timezone} onSelect={onSelectDate} />

          <div>
            <SectionLabel>My calendars</SectionLabel>
            <div className="space-y-0.5">
              {LAYERS.map(({ key, label, icon: Icon, colorKey }) => {
                const checked = visibleLayers.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onToggleLayer(key)}
                    aria-pressed={checked}
                    className={cn(
                      'flex h-8 w-full items-center gap-2 rounded-lg px-2 text-[13px] transition-colors',
                      checked ? 'text-foreground' : 'text-muted-foreground',
                      'hover:bg-muted/60'
                    )}
                  >
                    <Checkbox
                      checked={checked}
                      className="pointer-events-none h-3.5 w-3.5"
                      tabIndex={-1}
                    />
                    <span
                      className={cn(
                        'h-2 w-2 flex-shrink-0 rounded-full',
                        CALENDAR_COLORS[colorKey].bar
                      )}
                    />
                    <Icon className="h-3.5 w-3.5 flex-shrink-0 opacity-70" />
                    <span className="truncate">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {canViewTeam ? (
            <div>
              <SectionLabel>Team</SectionLabel>
              {members.length ? (
                <div className="space-y-0.5">
                  {members.map((member) => {
                    const checked = visibleUserIds.includes(member.user_id) || !!member.is_self;
                    const swatch = memberColor(member.color_index);
                    return (
                      <button
                        key={member.user_id}
                        type="button"
                        onClick={() => onToggleUser(member.user_id)}
                        aria-pressed={checked}
                        className={cn(
                          'flex h-8 w-full items-center gap-2 rounded-lg px-2 text-[13px] transition-colors hover:bg-muted/60',
                          checked ? 'text-foreground' : 'text-muted-foreground'
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          className="pointer-events-none h-3.5 w-3.5"
                          tabIndex={-1}
                        />
                        <span className={cn('h-2 w-2 flex-shrink-0 rounded-full', swatch.bar)} />
                        <span className="truncate">
                          {member.name}
                          {member.is_self ? ' (me)' : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="px-2 text-xs text-muted-foreground">
                  {membersUnavailable
                    ? 'Team directory unavailable.'
                    : 'No teammates found.'}
                </p>
              )}
            </div>
          ) : (
            <div>
              <SectionLabel>Team</SectionLabel>
              <p className="flex items-start gap-1.5 px-2 text-xs text-muted-foreground">
                <Users className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                Visible to users with full meeting access.
              </p>
            </div>
          )}

          <div className="border-t border-border/60 pt-3">
            <SectionLabel>Legend</SectionLabel>
            <CalendarLegend className="px-0.5" />
          </div>
        </div>
      </ScrollArea>
    </aside>
  );
}

export default CalendarSidebar;
