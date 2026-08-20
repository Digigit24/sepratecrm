import { describe, expect, it } from 'vitest';
import {
  TASK_BUCKETS,
  bucketForTask,
  compareWithinBucket,
  dueDateForBucket,
  dueDateFromInput,
  dueDateInputValue,
  formatDueLabel,
  groupTasks,
  groupsFromMyDay,
  isTaskDone,
  overdueCount,
  taskDueDayKey,
} from '@/utils/taskGrouping';
import { PriorityEnum, TaskStatusEnum, type Task } from '@/types/crmTypes';

// Deliberately NOT UTC. Kolkata is +05:30 (a half-hour offset, which catches
// naive hour-only maths) and New York is negative and observes DST.
const IST = 'Asia/Kolkata';
const NY = 'America/New_York';

/** 2026-09-09, 12:00 IST == 06:30Z. Mid-week (a Wednesday). */
const NOW = new Date('2026-09-09T06:30:00Z');

const task = (overrides: Partial<Task> = {}): Task => ({
  id: 1,
  tenant_id: 't1',
  title: 'Call the architect',
  status: TaskStatusEnum.TODO,
  priority: PriorityEnum.MEDIUM,
  attachments_count: 0,
  created_at: '2026-09-01T00:00:00Z',
  updated_at: '2026-09-01T00:00:00Z',
  ...overrides,
});

describe('bucketing happens in the viewer timezone, not UTC', () => {
  it('files a late-evening IST deadline under Today, not Tomorrow', () => {
    // 2026-09-09T20:00Z is already the 10th in IST (01:30 on the 10th).
    // ...so pick 18:00Z == 23:30 IST on the 9th: still "today" for the viewer.
    const t = task({ due_date: '2026-09-09T18:00:00Z' });
    expect(bucketForTask(t, { now: NOW, timeZone: IST })).toBe('today');
  });

  it('the SAME instant buckets differently for a UTC-negative viewer', () => {
    // 2026-09-10T02:00Z -> 07:30 on the 10th in IST (tomorrow => this_week),
    //                   -> 22:00 on the  9th in New York (today).
    const t = task({ due_date: '2026-09-10T02:00:00Z' });
    expect(bucketForTask(t, { now: NOW, timeZone: IST })).toBe('this_week');
    expect(bucketForTask(t, { now: NOW, timeZone: NY })).toBe('today');
  });

  it('does not call something overdue that is still today locally', () => {
    // 04:00Z on the 9th == 09:30 IST the same morning. Already past "now"
    // (06:30Z) as an instant, but the same calendar day, so NOT overdue.
    const t = task({ due_date: '2026-09-09T04:00:00Z' });
    expect(bucketForTask(t, { now: NOW, timeZone: IST })).toBe('today');
  });

  it('marks a genuinely earlier day as overdue', () => {
    const t = task({ due_date: '2026-09-07T10:00:00Z' });
    expect(bucketForTask(t, { now: NOW, timeZone: IST })).toBe('overdue');
  });

  it('splits this-week from later at the end of the week', () => {
    // Week starts Monday by default; NOW is Wed 9 Sep 2026, week ends Sun 13th.
    expect(bucketForTask(task({ due_date: '2026-09-13T06:00:00Z' }), { now: NOW, timeZone: IST }))
      .toBe('this_week');
    expect(bucketForTask(task({ due_date: '2026-09-14T06:00:00Z' }), { now: NOW, timeZone: IST }))
      .toBe('later');
  });

  it('parks undated work in Later rather than inventing a sixth group', () => {
    expect(bucketForTask(task({ due_date: undefined }), { now: NOW, timeZone: IST })).toBe('later');
  });

  it('treats DONE and CANCELLED alike, regardless of how overdue they are', () => {
    const done = task({ status: TaskStatusEnum.DONE, due_date: '2026-01-01T00:00:00Z' });
    const cancelled = task({ status: TaskStatusEnum.CANCELLED, due_date: '2026-01-01T00:00:00Z' });
    expect(bucketForTask(done, { now: NOW, timeZone: IST })).toBe('done');
    expect(bucketForTask(cancelled, { now: NOW, timeZone: IST })).toBe('done');
    expect(isTaskDone(done)).toBe(true);
  });

  it('keys an all-day task in its OWN zone so the date never slides', () => {
    // An all-day task for "10 September" stored as midnight IST.
    const allDay = task({
      due_date: '2026-09-09T18:30:00Z', // 2026-09-10 00:00 IST
      is_all_day: true,
      timezone: IST,
    });
    // Floating: the 10th for everybody, even a New York viewer for whom that
    // instant is still 14:30 on the 9th.
    expect(taskDueDayKey(allDay, NY)).toBe('2026-09-10');
    expect(taskDueDayKey(allDay, IST)).toBe('2026-09-10');
  });

  it('falls back to UTC for a nonsense timezone instead of throwing', () => {
    const t = task({ due_date: '2026-09-09T12:00:00Z' });
    expect(() => bucketForTask(t, { now: NOW, timeZone: 'Mars/Olympus_Mons' })).not.toThrow();
    expect(bucketForTask(t, { now: NOW, timeZone: 'Mars/Olympus_Mons' })).toBe('today');
  });
});

describe('groupTasks', () => {
  const tasks = [
    task({ id: 1, due_date: '2026-09-07T10:00:00Z' }), // overdue
    task({ id: 2, due_date: '2026-09-09T04:00:00Z' }), // today
    task({ id: 3, due_date: '2026-09-12T04:00:00Z' }), // this week
    task({ id: 4, due_date: '2026-10-01T04:00:00Z' }), // later
    task({ id: 5 }), // undated -> later
    task({ id: 6, status: TaskStatusEnum.DONE }), // done
  ];

  it('places every task in exactly one group', () => {
    const g = groupTasks(tasks, { now: NOW, timeZone: IST });
    expect(g.overdue.map((t) => t.id)).toEqual([1]);
    expect(g.today.map((t) => t.id)).toEqual([2]);
    expect(g.this_week.map((t) => t.id)).toEqual([3]);
    expect(g.later.map((t) => t.id)).toEqual([4, 5]);
    expect(g.done.map((t) => t.id)).toEqual([6]);

    const total = Object.values(g).reduce((n, list) => n + list.length, 0);
    expect(total).toBe(tasks.length);
  });

  it('counts overdue work for the group header', () => {
    expect(overdueCount(tasks, { now: NOW, timeZone: IST })).toBe(1);
  });

  it('exposes the five product-specified groups in order', () => {
    expect(TASK_BUCKETS.map((b) => b.id)).toEqual([
      'overdue',
      'today',
      'this_week',
      'later',
      'done',
    ]);
  });

  it('never offers Overdue as a drop target', () => {
    expect(TASK_BUCKETS.find((b) => b.id === 'overdue')?.droppable).toBe(false);
  });
});

describe('ordering within a group', () => {
  it('honours an explicit order_index above everything else', () => {
    const a = task({ id: 10, order_index: 2, due_date: '2026-01-01T00:00:00Z' });
    const b = task({ id: 11, order_index: 1, due_date: '2026-12-01T00:00:00Z' });
    expect([a, b].sort(compareWithinBucket).map((t) => t.id)).toEqual([11, 10]);
  });

  it('falls back to soonest deadline, then id, for a total order', () => {
    const a = task({ id: 20, due_date: '2026-09-20T00:00:00Z' });
    const b = task({ id: 21, due_date: '2026-09-10T00:00:00Z' });
    const c = task({ id: 22 }); // undated sinks
    expect([a, b, c].sort(compareWithinBucket).map((t) => t.id)).toEqual([21, 20, 22]);
  });
});

describe('dueDateForBucket (drag between groups re-dates the task)', () => {
  it('preserves the existing wall-clock time when re-dating', () => {
    // 15:00 IST on some later day, dragged into Today.
    const t = task({ due_date: '2026-10-01T09:30:00Z' }); // 15:00 IST
    const next = dueDateForBucket('today', t, { now: NOW, timeZone: IST });
    expect(next).toBeTruthy();
    expect(taskDueDayKey({ due_date: next as string }, IST)).toBe('2026-09-09');
    // Still 15:00 IST == 09:30Z.
    expect(next).toContain('T09:30');
  });

  it('lands an undated task on a sane default hour', () => {
    const next = dueDateForBucket('today', task(), { now: NOW, timeZone: IST });
    expect(taskDueDayKey({ due_date: next as string }, IST)).toBe('2026-09-09');
  });

  it('moves a task past the end of the week when dropped into Later', () => {
    const next = dueDateForBucket('later', task(), { now: NOW, timeZone: IST });
    // Week ends Sunday 13th, so Later starts the 14th.
    expect(taskDueDayKey({ due_date: next as string }, IST)).toBe('2026-09-14');
    // ...and re-bucketing it agrees, i.e. the drop is stable.
    expect(bucketForTask(task({ due_date: next as string }), { now: NOW, timeZone: IST }))
      .toBe('later');
  });

  it('is a no-op for Done and Overdue, which are not date drops', () => {
    expect(dueDateForBucket('done', task(), { now: NOW, timeZone: IST })).toBeUndefined();
    expect(dueDateForBucket('overdue', task(), { now: NOW, timeZone: IST })).toBeUndefined();
  });

  it('re-bucketing after any drop returns the bucket that was dropped into', () => {
    for (const bucket of ['today', 'this_week', 'later'] as const) {
      const next = dueDateForBucket(bucket, task(), { now: NOW, timeZone: IST });
      expect(bucketForTask(task({ due_date: next as string }), { now: NOW, timeZone: IST }))
        .toBe(bucket);
    }
  });
});

describe('inline date editing round-trips without drifting a day', () => {
  it('renders and re-parses the same local day', () => {
    const t = task({ due_date: '2026-09-09T18:00:00Z' }); // 23:30 IST on the 9th
    const input = dueDateInputValue(t, IST);
    expect(input).toBe('2026-09-09');

    const back = dueDateFromInput(input, '23:30', IST);
    expect(dueDateInputValue(task({ due_date: back as string }), IST)).toBe('2026-09-09');
  });

  it('survives a New York viewer too', () => {
    const t = task({ due_date: '2026-09-10T02:00:00Z' }); // 22:00 on the 9th in NY
    expect(dueDateInputValue(t, NY)).toBe('2026-09-09');
    const back = dueDateFromInput('2026-09-09', '22:00', NY);
    expect(dueDateInputValue(task({ due_date: back as string }), NY)).toBe('2026-09-09');
  });

  it('returns null for empty input rather than an invalid date', () => {
    expect(dueDateFromInput('', null, IST)).toBeNull();
  });
});

describe('formatDueLabel', () => {
  it('uses relative words for the days either side of today', () => {
    expect(formatDueLabel({ due_date: '2026-09-09T04:00:00Z' }, { now: NOW, timeZone: IST }))
      .toBe('Today');
    expect(formatDueLabel({ due_date: '2026-09-10T04:00:00Z' }, { now: NOW, timeZone: IST }))
      .toBe('Tomorrow');
    expect(formatDueLabel({ due_date: '2026-09-08T04:00:00Z' }, { now: NOW, timeZone: IST }))
      .toBe('Yesterday');
  });

  it('says "No date" instead of rendering an invalid date', () => {
    expect(formatDueLabel({ due_date: undefined }, { now: NOW, timeZone: IST })).toBe('No date');
  });
});

describe('groupsFromMyDay', () => {
  it('maps done_today onto the done group and tolerates missing keys', () => {
    const g = groupsFromMyDay({ overdue: [task({ id: 1 })], done_today: [task({ id: 2 })] });
    expect(g.overdue.map((t) => t.id)).toEqual([1]);
    expect(g.done.map((t) => t.id)).toEqual([2]);
    expect(g.today).toEqual([]);
    expect(g.this_week).toEqual([]);
    expect(g.later).toEqual([]);
  });
});
