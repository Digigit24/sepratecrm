// src/components/calendar/CalendarShell.tsx
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DndContext, DragOverlay, closestCorners } from '@dnd-kit/core';
import { restrictToWindowEdges } from '@dnd-kit/modifiers';
import { AlertTriangle } from 'lucide-react';
import { addMinutes, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { CalendarDndContext, useCalendarDnd } from '@/hooks/useCalendarDnd';
import { useCalendarStore } from '@/store/calendarStore';
import {
  DEFAULT_PX_PER_HOUR,
  fromZoned,
  parseClock,
  setMinutesOfDay,
} from '@/utils/calendarTime';
import type {
  CalendarDraftEvent,
  CalendarEvent,
  CalendarMember,
} from '@/types/calendar.types';
import { AgendaView } from './AgendaView';
import { CalendarEmptyState } from './CalendarEmptyState';
import { CalendarSidebar } from './CalendarSidebar';
import { CalendarSkeleton } from './CalendarSkeleton';
import { CalendarToolbar } from './CalendarToolbar';
import { DayView } from './DayView';
import { EventChip } from './EventChip';
import { MonthView } from './MonthView';
import { QuickCreatePopover } from './QuickCreatePopover';
import { RecurrenceScopeDialog } from './RecurrenceScopeDialog';
import { TeamLaneView } from './TeamLaneView';
import { MAX_LANES } from './TeamLaneView';
import { WeekView } from './WeekView';

interface CalendarShellProps {
  events: CalendarEvent[];
  isLoading: boolean;
  /** The `/api/calendar/` routes are not deployed yet. */
  unavailable?: boolean;
  loadError?: Error | null;
  members: CalendarMember[];
  colorIndexByUser: Record<string, number>;
  canViewTeam: boolean;
  membersUnavailable?: boolean;
  onRefresh: () => void;
}

/**
 * `flex h-full min-h-0`: the left rail, then a column of toolbar + view body.
 * Only the body scrolls, matching the app-wide layout rule.
 *
 * This is also where the single `DndContext` lives, so a chip can be dragged
 * from a month cell into any other cell, or across person lanes, without each
 * view owning its own drag session.
 */
export function CalendarShell({
  events,
  isLoading,
  unavailable,
  loadError,
  members,
  colorIndexByUser,
  canViewTeam,
  membersUnavailable,
  onRefresh,
}: CalendarShellProps) {
  const {
    view,
    anchorDate,
    timezone,
    weekStartsOn,
    timeFormat,
    pxPerHour,
    visibleLayers,
    visibleUserIds,
    teamMode,
    workingHoursStart,
    workingHoursEnd,
    workingDays,
    defaultDurationMinutes,
    setView,
    setAnchorDate,
    goToday,
    goPrev,
    goNext,
    toggleLayer,
    toggleUser,
    setTeamMode,
    startDraft,
    openEvent,
  } = useCalendarStore();

  const [quickDraft, setQuickDraft] = useState<CalendarDraftEvent | null>(null);
  const [quickAnchor, setQuickAnchor] = useState<{ x: number; y: number } | null>(null);

  const dnd = useCalendarDnd({
    timezone,
    pxPerHour: pxPerHour || DEFAULT_PX_PER_HOUR,
    conflictUserIds: visibleUserIds,
  });

  /** Person colouring in both team modes; type colouring otherwise. */
  const colorMode: 'type' | 'person' = teamMode === 'off' ? 'type' : 'person';

  /** Layer visibility is a pure client-side filter over the merged feed. */
  const visibleEvents = useMemo(() => {
    const allowedSources = new Set(
      visibleLayers.flatMap((layer) =>
        layer === 'meetings'
          ? ['meeting']
          : layer === 'tasks'
            ? ['task']
            : layer === 'follow_ups'
              ? ['follow_up']
              : ['activity']
      )
    );
    return events.filter((e) => allowedSources.has(e.source));
  }, [events, visibleLayers]);

  /** Beyond 8 lanes the columns are unreadable — force Overlay (§C.5). */
  const selectedMembers = useMemo(
    () => members.filter((m) => visibleUserIds.includes(m.user_id) || m.is_self),
    [members, visibleUserIds]
  );
  const laneMode = teamMode === 'lanes' && selectedMembers.length > MAX_LANES ? 'overlay' : teamMode;

  useEffect(() => {
    if (teamMode === 'lanes' && selectedMembers.length > MAX_LANES) setTeamMode('overlay');
  }, [teamMode, selectedMembers.length, setTeamMode]);

  const openEventFromGrid = useCallback(
    (event: CalendarEvent) => {
      // Redacted rows are never openable: there is nothing to show.
      if (event.redacted) return;
      if (event.source !== 'meeting') return;
      openEvent(event.id, event.source_id, event.occurrence_start ?? null, 'view');
    },
    [openEvent]
  );

  const createAtSlot = useCallback(
    (zonedDay: Date, minutesOfDay: number) => {
      const start = setMinutesOfDay(zonedDay, minutesOfDay, timezone);
      const end = addMinutes(new Date(start), defaultDurationMinutes).toISOString();
      setQuickDraft({ start_at: start, end_at: end, all_day: false });
    },
    [timezone, defaultDurationMinutes]
  );

  /** Month view has no minute resolution — open at the start of working hours. */
  const createOnDay = useCallback(
    (zonedDay: Date) => {
      const minutes = parseClock(workingHoursStart, 9 * 60);
      const start = fromZoned(addMinutes(startOfDay(zonedDay), minutes), timezone).toISOString();
      const end = addMinutes(new Date(start), defaultDurationMinutes).toISOString();
      setQuickDraft({ start_at: start, end_at: end, all_day: false });
    },
    [workingHoursStart, timezone, defaultDurationMinutes]
  );

  /** Keyboard: T today, M/W/D/A views, ←/→ navigate, N new event. */
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable
      ) {
        return;
      }
      switch (e.key.toLowerCase()) {
        case 't':
          goToday();
          break;
        case 'm':
          setView('month');
          break;
        case 'w':
          setView('week');
          break;
        case 'd':
          setView('day');
          break;
        case 'a':
          setView('agenda');
          break;
        case 'n':
          startDraft({
            start_at: new Date().toISOString(),
            end_at: addMinutes(new Date(), defaultDurationMinutes).toISOString(),
            all_day: false,
          });
          break;
        case 'arrowleft':
          goPrev();
          break;
        case 'arrowright':
          goNext();
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goToday, setView, goPrev, goNext, startDraft, defaultDurationMinutes]);

  const sharedGridProps = {
    events: visibleEvents,
    timezone,
    timeFormat,
    colorMode,
    colorIndexByUser,
    onOpenEvent: openEventFromGrid,
  };

  const body = () => {
    if (isLoading && !events.length) return <CalendarSkeleton view={view} />;

    if (loadError && !events.length) {
      return (
        <CalendarEmptyState
          title="Could not load the calendar"
          description={loadError.message || 'Something went wrong fetching your events.'}
        />
      );
    }

    if (laneMode === 'lanes' && view !== 'agenda') {
      return (
        <TeamLaneView
          anchorDate={anchorDate}
          events={visibleEvents}
          members={selectedMembers}
          timezone={timezone}
          timeFormat={timeFormat}
          pxPerHour={pxPerHour}
          workingHoursStart={workingHoursStart}
          workingHoursEnd={workingHoursEnd}
          workingDays={workingDays}
          colorIndexByUser={colorIndexByUser}
          onOpenEvent={openEventFromGrid}
          onCreateAt={(zonedDay, minutes) => createAtSlot(zonedDay, minutes)}
        />
      );
    }

    switch (view) {
      case 'week':
        return (
          <WeekView
            anchorDate={anchorDate}
            weekStartsOn={weekStartsOn}
            pxPerHour={pxPerHour}
            workingHoursStart={workingHoursStart}
            workingHoursEnd={workingHoursEnd}
            workingDays={workingDays}
            onCreateAt={createAtSlot}
            {...sharedGridProps}
          />
        );
      case 'day':
        return (
          <DayView
            anchorDate={anchorDate}
            pxPerHour={pxPerHour}
            workingHoursStart={workingHoursStart}
            workingHoursEnd={workingHoursEnd}
            workingDays={workingDays}
            onCreateAt={createAtSlot}
            {...sharedGridProps}
          />
        );
      case 'agenda':
        return <AgendaView {...sharedGridProps} />;
      case 'month':
      default:
        return (
          <MonthView
            anchorDate={anchorDate}
            weekStartsOn={weekStartsOn}
            onCreateOnDay={createOnDay}
            {...sharedGridProps}
          />
        );
    }
  };

  return (
    <CalendarDndContext.Provider value={dnd}>
      <DndContext
        sensors={dnd.sensors}
        collisionDetection={closestCorners}
        modifiers={[restrictToWindowEdges]}
        onDragStart={dnd.handleDragStart}
        onDragEnd={dnd.handleDragEnd}
        onDragCancel={dnd.handleDragCancel}
      >
        <div className="flex h-full min-h-0 overflow-hidden rounded-lg border border-border/60 bg-background">
          <CalendarSidebar
            anchorDate={anchorDate}
            timezone={timezone}
            onSelectDate={setAnchorDate}
            visibleLayers={visibleLayers}
            onToggleLayer={toggleLayer}
            members={members}
            visibleUserIds={visibleUserIds}
            onToggleUser={toggleUser}
            canViewTeam={canViewTeam}
            membersUnavailable={membersUnavailable}
          />

          <div className="flex min-w-0 flex-1 flex-col">
            <CalendarToolbar
              view={view}
              anchorDate={anchorDate}
              timezone={timezone}
              weekStartsOn={weekStartsOn}
              teamMode={teamMode}
              canViewTeam={canViewTeam}
              onViewChange={setView}
              onPrev={goPrev}
              onNext={goNext}
              onToday={goToday}
              onTeamModeChange={setTeamMode}
              onCreate={() =>
                startDraft({
                  start_at: new Date().toISOString(),
                  end_at: addMinutes(new Date(), defaultDurationMinutes).toISOString(),
                  all_day: false,
                })
              }
            />

            {unavailable ? (
              <div className="flex flex-shrink-0 items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-1.5">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  The calendar service is not available yet — showing an empty calendar. Creating
                  and editing events still works.
                </p>
              </div>
            ) : null}

            <div
              className={cn(
                'min-h-0 flex-1',
                view === 'month' || view === 'agenda' ? 'overflow-auto' : 'overflow-hidden'
              )}
              onDoubleClick={(e) => setQuickAnchor({ x: e.clientX, y: e.clientY })}
              onClickCapture={(e) => setQuickAnchor({ x: e.clientX, y: e.clientY })}
            >
              {body()}
            </div>
          </div>
        </div>

        {/* The chip follows the cursor rather than the grid re-flowing. */}
        <DragOverlay dropAnimation={null}>
          {dnd.activeEvent ? (
            <EventChip
              event={dnd.activeEvent}
              timezone={timezone}
              timeFormat={timeFormat}
              colorMode={colorMode}
              colorIndexByUser={colorIndexByUser}
              variant="month"
              className="shadow-lg"
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      <QuickCreatePopover
        draft={quickDraft}
        anchor={quickAnchor}
        timezone={timezone}
        timeFormat={timeFormat}
        onClose={() => setQuickDraft(null)}
        onCreated={onRefresh}
        onMoreOptions={(draft) => startDraft(draft)}
      />

      {/* Drag/resize on a recurring meeting must pick a scope first. */}
      <RecurrenceScopeDialog
        open={!!dnd.pendingChange}
        intent="edit"
        eventTitle={dnd.pendingChange?.event.title}
        onConfirm={dnd.resolveScope}
        onCancel={dnd.cancelScope}
      />
    </CalendarDndContext.Provider>
  );
}

export default CalendarShell;
