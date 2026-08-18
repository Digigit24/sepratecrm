import { describe, expect, it } from 'vitest';
import { buildQueryString } from '@/lib/apiConfig';
import { canonicalOccurrenceStart } from '@/services/meeting.service';

/**
 * Recurrence mutations carry `occurrence_start` as a QUERY param on PATCH and
 * DELETE. The classic failure is the `+` of an ISO offset arriving server-side
 * as a space, which makes the instant unparseable and 400s the request.
 */
describe('occurrence_start transport', () => {
  it('percent-encodes the "+" of an ISO offset so it cannot decode as a space', () => {
    const qs = buildQueryString({ occurrence_start: '2026-09-08T09:30:00+05:30' });

    expect(qs).toContain('%2B');
    // A bare "+" anywhere in the value is the bug.
    expect(qs.split('occurrence_start=')[1]).not.toContain('+');
  });

  it('percent-encodes the colons of an ISO instant too', () => {
    const qs = buildQueryString({ occurrence_start: '2026-09-08T09:30:00Z' });
    expect(qs).toBe('?occurrence_start=2026-09-08T09%3A30%3A00Z');
  });

  it('returns a Z-suffixed instant untouched, so it round-trips byte-for-byte', () => {
    // The server emitted this string; sending back anything else risks a miss.
    expect(canonicalOccurrenceStart('2026-09-08T09:30:00Z')).toBe('2026-09-08T09:30:00Z');
    expect(canonicalOccurrenceStart('2026-09-08T09:30:00.000Z')).toBe('2026-09-08T09:30:00.000Z');
  });

  it('rewrites an offset-bearing instant to UTC Z form', () => {
    // 09:30+05:30 === 04:00Z
    expect(canonicalOccurrenceStart('2026-09-08T09:30:00+05:30')).toBe('2026-09-08T04:00:00.000Z');
  });

  it('leaves an unparseable value alone rather than sending "Invalid Date"', () => {
    expect(canonicalOccurrenceStart('not-a-date')).toBe('not-a-date');
  });
});
