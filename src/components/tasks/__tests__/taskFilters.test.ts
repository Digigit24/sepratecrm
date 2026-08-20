import { describe, expect, it } from 'vitest';
import {
  ASSIGNEE_ME,
  EMPTY_FILTERS,
  activeFilterCount,
  collectLabels,
  filterTasks,
  hasActiveFilters,
} from '@/components/tasks/taskFilters';
import { PriorityEnum, TaskStatusEnum, type Task } from '@/types/crmTypes';

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

describe('filterTasks', () => {
  const tasks = [
    task({ id: 1, assignee_user_id: 'user-1', priority: PriorityEnum.HIGH, labels: ['roofing'] }),
    task({ id: 2, assignee_user_id: 'user-2', priority: PriorityEnum.LOW }),
    task({ id: 3 }), // unassigned
  ];

  it('passes everything through when nothing is set', () => {
    expect(filterTasks(tasks, EMPTY_FILTERS)).toHaveLength(3);
  });

  it('resolves "me" against the signed-in user', () => {
    const got = filterTasks(tasks, { ...EMPTY_FILTERS, assignee: ASSIGNEE_ME }, 'user-2');
    expect(got.map((t) => t.id)).toEqual([2]);
  });

  it('matches NOTHING for "me" when nobody is signed in', () => {
    // The dangerous failure mode is matching everything, or matching the
    // unassigned rows because both sides are falsy.
    expect(filterTasks(tasks, { ...EMPTY_FILTERS, assignee: ASSIGNEE_ME }, null)).toEqual([]);
    expect(filterTasks(tasks, { ...EMPTY_FILTERS, assignee: ASSIGNEE_ME }, '')).toEqual([]);
    expect(filterTasks(tasks, { ...EMPTY_FILTERS, assignee: ASSIGNEE_ME }, undefined)).toEqual([]);
  });

  it('finds the genuinely unassigned rows', () => {
    const got = filterTasks(tasks, { ...EMPTY_FILTERS, assignee: 'unassigned' });
    expect(got.map((t) => t.id)).toEqual([3]);
  });

  it('filters by a specific person', () => {
    expect(filterTasks(tasks, { ...EMPTY_FILTERS, assignee: 'user-1' }).map((t) => t.id)).toEqual([1]);
  });

  it('filters by priority and label', () => {
    expect(
      filterTasks(tasks, { ...EMPTY_FILTERS, priority: PriorityEnum.HIGH }).map((t) => t.id)
    ).toEqual([1]);
    expect(filterTasks(tasks, { ...EMPTY_FILTERS, label: 'roofing' }).map((t) => t.id)).toEqual([1]);
    expect(filterTasks(tasks, { ...EMPTY_FILTERS, label: 'nope' })).toEqual([]);
  });

  it('searches title, description and the linked record name', () => {
    const searchable = [
      task({ id: 10, title: 'Chase the survey' }),
      task({ id: 11, title: 'Other', description: 'survey pending' }),
      task({ id: 12, title: 'Other', related_label: 'Survey Ltd' }),
      task({ id: 13, title: 'Unrelated' }),
    ];
    const got = filterTasks(searchable, { ...EMPTY_FILTERS, search: 'survey' });
    expect(got.map((t) => t.id)).toEqual([10, 11, 12]);
  });

  it('treats a legacy lead-linked task as related_type LEAD', () => {
    const legacy = [task({ id: 20, lead: 5, lead_name: 'Acme' }), task({ id: 21 })];
    expect(filterTasks(legacy, { ...EMPTY_FILTERS, relatedType: 'LEAD' }).map((t) => t.id)).toEqual([20]);
    expect(filterTasks(legacy, { ...EMPTY_FILTERS, relatedType: 'NONE' }).map((t) => t.id)).toEqual([21]);
  });

  it('combines filters with AND', () => {
    const got = filterTasks(tasks, {
      ...EMPTY_FILTERS,
      assignee: 'user-1',
      priority: PriorityEnum.LOW,
    });
    expect(got).toEqual([]);
  });
});

describe('filter bookkeeping', () => {
  it('knows when anything is active', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, search: '   ' })).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, search: 'x' })).toBe(true);
    expect(activeFilterCount({ ...EMPTY_FILTERS, label: 'a', priority: PriorityEnum.LOW })).toBe(2);
  });
});

describe('collectLabels', () => {
  it('returns distinct labels, sorted', () => {
    expect(
      collectLabels([
        task({ id: 1, labels: ['b', 'a'] }),
        task({ id: 2, labels: ['a', 'c'] }),
        task({ id: 3 }),
      ])
    ).toEqual(['a', 'b', 'c']);
  });
});
