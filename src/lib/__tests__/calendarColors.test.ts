import { describe, expect, it } from 'vitest';
import {
  REDACTED_TITLE,
  getEventColor,
  isRedacted,
  redactEvent,
  redactFeed,
  resolveColorKey,
} from '@/lib/calendarColors';
import type { CalendarEvent } from '@/types/calendar.types';

const baseEvent = (overrides: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id: 'meeting:1',
  source: 'meeting',
  source_id: 1,
  title: 'Salary review with Asha',
  description: 'Discuss the raise',
  location: 'Room 3',
  start_at: '2026-09-09T04:00:00Z',
  end_at: '2026-09-09T05:00:00Z',
  all_day: false,
  timezone: 'Asia/Kolkata',
  owner_user_id: 'owner-1',
  visibility: 'DEFAULT',
  ...overrides,
});

describe('PRIVATE event redaction', () => {
  it('does not redact a DEFAULT event for a teammate', () => {
    const event = baseEvent();
    expect(isRedacted(event, 'someone-else')).toBe(false);
  });

  it('redacts a PRIVATE event for a non-owner, non-attendee viewer', () => {
    const event = baseEvent({ visibility: 'PRIVATE' });
    expect(isRedacted(event, 'someone-else')).toBe(true);
  });

  it('does NOT redact a PRIVATE event for its owner', () => {
    const event = baseEvent({ visibility: 'PRIVATE' });
    expect(isRedacted(event, 'owner-1')).toBe(false);
  });

  it('does NOT redact a PRIVATE event for one of its attendees', () => {
    const event = baseEvent({
      visibility: 'PRIVATE',
      attendees: [{ user_id: 'guest-1', display_name: 'Guest' }],
    });
    expect(isRedacted(event, 'guest-1')).toBe(false);
  });

  it('fails CLOSED when the viewer cannot be identified', () => {
    const event = baseEvent({ visibility: 'PRIVATE' });
    expect(isRedacted(event, null)).toBe(true);
    expect(isRedacted(event, undefined)).toBe(true);
  });

  it('honours the server-side `redacted` flag regardless of visibility', () => {
    const event = baseEvent({ redacted: true });
    expect(isRedacted(event, 'owner-1')).toBe(true);
  });

  it('strips every leakable field, keeping only free/busy information', () => {
    const stripped = redactEvent(baseEvent({ visibility: 'PRIVATE' }));

    expect(stripped.title).toBe(REDACTED_TITLE);
    expect(stripped.title).not.toContain('Salary');
    expect(stripped.description).toBeUndefined();
    expect(stripped.location).toBeUndefined();
    expect(stripped.attendees).toBeUndefined();
    expect(stripped.lead).toBeUndefined();
    expect(stripped.conference_url).toBeUndefined();
    // Free/busy data survives, because that is the whole point.
    expect(stripped.start_at).toBe('2026-09-09T04:00:00Z');
    expect(stripped.end_at).toBe('2026-09-09T05:00:00Z');
    expect(stripped.all_day).toBe(false);
  });

  it('makes a redacted event non-editable and non-deletable', () => {
    const stripped = redactEvent(baseEvent({ visibility: 'PRIVATE', can_edit: true, can_delete: true }));
    expect(stripped.can_edit).toBe(false);
    expect(stripped.can_delete).toBe(false);
  });

  it('redacts the whole feed in one pass, leaving other events untouched', () => {
    const feed = [
      baseEvent({ id: 'a', visibility: 'PRIVATE', title: 'Therapy' }),
      baseEvent({ id: 'b', title: 'Team standup' }),
      baseEvent({ id: 'c', visibility: 'PRIVATE', title: 'My own private thing', owner_user_id: 'me' }),
    ];

    const result = redactFeed(feed, 'me');
    const serialised = JSON.stringify(result);

    expect(result[0].title).toBe(REDACTED_TITLE);
    expect(result[1].title).toBe('Team standup');
    expect(result[2].title).toBe('My own private thing'); // viewer owns it
    // The private title of someone else's event is not anywhere in the payload.
    expect(serialised).not.toContain('Therapy');
  });
});

describe('colour resolution', () => {
  it('maps a cancelled meeting to the muted, struck-through token', () => {
    const event = baseEvent({ status: 'CANCELLED' });
    expect(resolveColorKey(event)).toBe('cancelled');
    expect(getEventColor(event).chip).toContain('line-through');
  });

  it('falls back to the meeting type when color_key is missing', () => {
    expect(resolveColorKey(baseEvent({ meeting_type: 'DEMO' }))).toBe('demo');
  });

  it('falls back to the source when neither color_key nor type is usable', () => {
    expect(resolveColorKey(baseEvent({ source: 'task', color_key: 'nonsense' }))).toBe('task');
    expect(resolveColorKey(baseEvent({ source: 'follow_up', color_key: null }))).toBe('follow_up');
  });

  it('switches to person colours in team mode', () => {
    const event = baseEvent({ owner_user_id: 'user-a' });
    const byType = getEventColor(event, 'type');
    const byPerson = getEventColor(event, 'person', { 'user-a': 4 });
    expect(byPerson.chip).not.toBe(byType.chip);
    // Stable: the same index always yields the same token.
    expect(getEventColor(event, 'person', { 'user-a': 4 }).chip).toBe(byPerson.chip);
  });
});

describe('redacted events use the anonymous `busy` token', () => {
  it('resolves a redacted event to `busy`, not to its type colour', () => {
    // The server stamps color_key 'busy' on redacted rows.
    const event = baseEvent({ redacted: true, color_key: 'busy', meeting_type: 'DEMO' });
    expect(resolveColorKey(event)).toBe('busy');
  });

  it('does not let a stale type/status colour survive redaction', () => {
    const event = baseEvent({ redacted: true, color_key: 'demo', status: 'CANCELLED' });
    expect(resolveColorKey(event)).toBe('busy');
  });

  it('keeps a redacted row anonymous even in person-colour team mode', () => {
    const event = baseEvent({ redacted: true, owner_user_id: 'user-a' });
    const color = getEventColor(event, 'person', { 'user-a': 4 });
    // Muted, not that person's palette colour.
    expect(color.chip).toContain('bg-muted');
    expect(color.chip).not.toContain('emerald');
  });

  it('stamps color_key `busy` when redacting locally, matching the server', () => {
    const stripped = redactEvent(baseEvent({ visibility: 'PRIVATE', color_key: 'demo' }));
    expect(stripped.color_key).toBe('busy');
  });
});
