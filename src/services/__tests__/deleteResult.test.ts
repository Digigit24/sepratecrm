import { describe, expect, it } from 'vitest';
import { describeDeleteResult } from '@/services/meeting.service';

/**
 * `DELETE /api/meetings/{id}/` answers **200 with a body**, not 204, and the body
 * SHAPE depends on the recurrence scope (there is no occurrence count anywhere):
 *
 *   non-recurring / `all` -> { deleted, edit_scope }
 *   `this`                -> { deleted_occurrence, series_id, edit_scope }
 *   `this_and_following`  -> { series_id, truncated_at, edit_scope }
 */
describe('describeDeleteResult', () => {
  it('reads the `this` shape (an EXDATE was appended)', () => {
    const body = {
      deleted_occurrence: '2026-09-08T09:30:00Z',
      series_id: 1234,
      edit_scope: 'this' as const,
    };
    expect(describeDeleteResult(body, 'this', true)).toBe('Deleted this occurrence');
  });

  it('reads the `this_and_following` shape (the RRULE was clipped)', () => {
    const body = {
      series_id: 1234,
      truncated_at: '2026-09-08T09:30:00Z',
      edit_scope: 'this_and_following' as const,
    };
    expect(describeDeleteResult(body, 'this_and_following', true)).toBe(
      'Deleted this and all following occurrences'
    );
  });

  it('distinguishes a whole series from a one-off on the identical `deleted` shape', () => {
    const body = { deleted: 1234, edit_scope: 'all' as const };
    // Same body both times — only the caller knows whether it recurred.
    expect(describeDeleteResult(body, 'all', true)).toBe('Deleted the whole series');
    expect(describeDeleteResult(body, 'all', false)).toBe('Event deleted');
  });

  it('reports a plain one-off delete', () => {
    // A non-recurring delete echoes back whichever scope was parsed, e.g. 'this'.
    expect(describeDeleteResult({ deleted: 7, edit_scope: 'this' }, 'this', false)).toBe(
      'Event deleted'
    );
  });

  it('prefers an explicit server `detail` over anything derived', () => {
    expect(
      describeDeleteResult({ deleted: 1, detail: 'Removed 1 of 8 occurrences' }, 'this', true)
    ).toBe('Removed 1 of 8 occurrences');
  });

  it('falls back to the scope when the body is empty or absent (204-style)', () => {
    expect(describeDeleteResult({}, 'all', true)).toBe('Deleted the whole series');
    expect(describeDeleteResult({}, 'this', true)).toBe('Deleted this occurrence');
    expect(describeDeleteResult(undefined)).toBe('Event deleted');
  });

  it('uses the scope echoed in the body when the caller passed none', () => {
    expect(describeDeleteResult({ edit_scope: 'this_and_following' })).toBe(
      'Deleted this and all following occurrences'
    );
  });
});
