import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { RecurrenceScopeDialog } from '@/components/calendar/RecurrenceScopeDialog';
import { buildRRule, humanizeRRule, parseRRule } from '@/utils/rruleHelpers';

/**
 * §B.3: every mutation on a recurring meeting must choose between
 * `this` / `this_and_following` / `all`, and the default must be the SAFE one
 * so a stray Enter never rewrites a whole series.
 */
describe('recurrence edit-mode selection', () => {
  it('offers all three edit modes', () => {
    render(
      <RecurrenceScopeDialog open intent="edit" onConfirm={vi.fn()} onCancel={vi.fn()} />
    );

    expect(screen.getByText('This event')).toBeInTheDocument();
    expect(screen.getByText('This and following events')).toBeInTheDocument();
    expect(screen.getByText('All events')).toBeInTheDocument();
  });

  it('defaults to `this` — the narrowest, safest scope', () => {
    const onConfirm = vi.fn();

    render(<RecurrenceScopeDialog open onConfirm={onConfirm} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(onConfirm).toHaveBeenCalledWith('this');
  });

  it('reports `this_and_following` when that option is chosen', () => {
    const onConfirm = vi.fn();

    render(<RecurrenceScopeDialog open onConfirm={onConfirm} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole('radio', { name: /This and following events/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(onConfirm).toHaveBeenCalledWith('this_and_following');
  });

  it('reports `all` when the whole series is chosen', () => {
    const onConfirm = vi.fn();

    render(<RecurrenceScopeDialog open onConfirm={onConfirm} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole('radio', { name: /All events/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    expect(onConfirm).toHaveBeenCalledWith('all');
  });

  it('cancels without reporting a scope', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(<RecurrenceScopeDialog open onConfirm={onConfirm} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('adapts its wording to a delete', () => {
    render(
      <RecurrenceScopeDialog open intent="delete" onConfirm={vi.fn()} onCancel={vi.fn()} />
    );
    expect(screen.getByText('Delete recurring event')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });
});

describe('RRULE round-tripping', () => {
  it('builds a weekly rule with a count', () => {
    const rule = buildRRule({
      enabled: true,
      freq: 'WEEKLY',
      interval: 1,
      byweekday: [1], // Tuesday, in rrule's MO=0 ordering
      endMode: 'count',
      count: 8,
    });
    expect(rule).toContain('FREQ=WEEKLY');
    expect(rule).toContain('BYDAY=TU');
    expect(rule).toContain('COUNT=8');
  });

  it('returns null when recurrence is switched off', () => {
    expect(
      buildRRule({ enabled: false, freq: 'WEEKLY', interval: 1, byweekday: [], endMode: 'never' })
    ).toBeNull();
  });

  it('parses a rule back into editor state', () => {
    const parsed = parseRRule('FREQ=WEEKLY;BYDAY=TU;COUNT=8');
    expect(parsed).not.toBeNull();
    expect(parsed?.freq).toBe('WEEKLY');
    expect(parsed?.byweekday).toEqual([1]);
    expect(parsed?.endMode).toBe('count');
    expect(parsed?.count).toBe(8);
  });

  it('never throws on a malformed rule', () => {
    expect(parseRRule('NOT-A-RULE')).toBeNull();
    expect(parseRRule(null)).toBeNull();
    expect(humanizeRRule('NOT-A-RULE')).toBe('NOT-A-RULE');
  });

  it('humanises a rule for the editor caption', () => {
    expect(humanizeRRule('FREQ=WEEKLY;BYDAY=TU')).toMatch(/week/i);
  });
});
