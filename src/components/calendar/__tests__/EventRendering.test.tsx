import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import { AllDayRow } from '@/components/calendar/AllDayRow';
import { EventChip } from '@/components/calendar/EventChip';
import { MonthView } from '@/components/calendar/MonthView';
import { redactFeed } from '@/lib/calendarColors';
import type { CalendarEvent } from '@/types/calendar.types';

const TZ = 'Asia/Kolkata';

const withDnd = (ui: React.ReactNode) => render(<DndContext>{ui}</DndContext>);

const event = (overrides: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: 'meeting:1',
  source: 'meeting',
  source_id: 1,
  title: 'Pipeline review',
  start_at: '2026-09-09T04:00:00Z', // 09:30 IST
  end_at: '2026-09-09T05:00:00Z',
  all_day: false,
  timezone: TZ,
  owner_user_id: 'owner-1',
  visibility: 'DEFAULT',
  can_edit: true,
  ...overrides,
});

describe('PRIVATE events never leak their title into the grid', () => {
  const secret = event({
    id: 'meeting:99',
    source_id: 99,
    title: 'Resignation conversation',
    description: 'Handing in notice',
    location: 'HR office',
    visibility: 'PRIVATE',
    owner_user_id: 'someone-else',
  });

  it('renders "Busy" instead of the real title in a chip', () => {
    const [redacted] = redactFeed([secret], 'viewer-1');
    withDnd(<EventChip event={redacted} timezone={TZ} />);

    expect(screen.getByText('Busy')).toBeInTheDocument();
    expect(screen.queryByText('Resignation conversation')).not.toBeInTheDocument();
    expect(screen.queryByText(/Handing in notice/)).not.toBeInTheDocument();
    expect(screen.queryByText(/HR office/)).not.toBeInTheDocument();
  });

  it('leaves no trace of the private title anywhere in the rendered DOM', () => {
    const [redacted] = redactFeed([secret], 'viewer-1');
    const { container } = withDnd(<EventChip event={redacted} timezone={TZ} />);

    expect(container.innerHTML).not.toContain('Resignation');
    expect(container.innerHTML).not.toContain('HR office');
  });

  it('is not clickable, so it can never open a detail drawer', () => {
    const onOpen = vi.fn();
    const [redacted] = redactFeed([secret], 'viewer-1');
    const { container } = withDnd(
      <EventChip event={redacted} timezone={TZ} onOpen={onOpen} />
    );

    const chip = container.querySelector('[data-testid="calendar-event-chip"]');
    expect(chip).toBeTruthy();
    fireEvent.click(chip as Element);
    expect(onOpen).not.toHaveBeenCalled();
    expect(chip).toHaveAttribute('data-redacted', 'true');
  });

  it('keeps the private title out of the month grid, including team lanes', () => {
    const feed = redactFeed(
      [secret, event({ id: 'meeting:2', source_id: 2, title: 'Team standup' })],
      'viewer-1'
    );

    const { container } = withDnd(
      <MonthView
        anchorDate={new Date('2026-09-09T06:00:00Z')}
        events={feed}
        timezone={TZ}
        colorMode="person"
        colorIndexByUser={{ 'someone-else': 3, 'owner-1': 5 }}
      />
    );

    expect(screen.getByText('Team standup')).toBeInTheDocument();
    expect(screen.getAllByText('Busy').length).toBeGreaterThan(0);
    expect(container.innerHTML).not.toContain('Resignation');
  });

  it('still shows the owner their OWN private event in full', () => {
    const [own] = redactFeed([secret], 'someone-else');
    withDnd(<EventChip event={own} timezone={TZ} />);
    expect(screen.getByText('Resignation conversation')).toBeInTheDocument();
  });
});

describe('all-day rendering is a distinct mode', () => {
  const allDay = event({
    id: 'task:5',
    source: 'task',
    source_id: 5,
    title: 'Send the proposal',
    all_day: true,
    start_at: '2026-09-08T18:30:00Z', // 2026-09-09 00:00 IST
    end_at: '2026-09-09T18:30:00Z', // exclusive end
    can_edit: false,
  });

  it('shows no clock time on an all-day chip', () => {
    withDnd(<EventChip event={allDay} timezone={TZ} variant="allday" />);
    expect(screen.getByText('Send the proposal')).toBeInTheDocument();
    // A timed chip would render a "9:30am"-style prefix; an all-day one must not.
    expect(screen.queryByText(/\d{1,2}:\d{2}/)).not.toBeInTheDocument();
    expect(screen.queryByText(/am|pm/i)).not.toBeInTheDocument();
  });

  it('renders all-day events in the banner lane, not in the hour columns', () => {
    const days = [
      new Date(2026, 8, 6),
      new Date(2026, 8, 7),
      new Date(2026, 8, 8),
      new Date(2026, 8, 9),
      new Date(2026, 8, 10),
      new Date(2026, 8, 11),
      new Date(2026, 8, 12),
    ];

    withDnd(<AllDayRow days={days} events={[allDay]} timezone={TZ} />);

    expect(screen.getByText('All day')).toBeInTheDocument();
    expect(screen.getByText('Send the proposal')).toBeInTheDocument();
  });

  it('places a multi-day all-day bar across the correct span of days', () => {
    const multi = { ...allDay, id: 'task:6', end_at: '2026-09-11T18:30:00Z' }; // 9th-11th
    const days = Array.from({ length: 7 }, (_, i) => new Date(2026, 8, 6 + i));

    const { container } = withDnd(<AllDayRow days={days} events={[multi]} timezone={TZ} />);

    // Index 3 == the 9th of 7 days starting on the 6th; span 3 of 7.
    const bar = container.querySelector('[style*="left: 42.857"]');
    expect(bar).toBeTruthy();
    expect((bar as HTMLElement).style.width).toContain('42.857');
  });

  it('shows a timed event WITH its clock time, in the viewer timezone', () => {
    withDnd(<EventChip event={event()} timezone={TZ} />);
    // 04:00Z is 09:30 IST — the whole point of local bucketing.
    expect(screen.getByText('9:30am')).toBeInTheDocument();
  });
});
