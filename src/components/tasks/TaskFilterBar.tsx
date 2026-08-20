// src/components/tasks/TaskFilterBar.tsx
//
// The filter chips. Every change is written to the URL by the page, so a
// filtered view is a shareable link and Back is a real undo.

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, X } from 'lucide-react';
import { useUserDirectory } from '@/hooks/useUserDirectory';
import { PriorityEnum, TASK_RELATED_TYPE_OPTIONS, type TaskRelatedType } from '@/types/crmTypes';
import {
  ASSIGNEE_ME,
  EMPTY_FILTERS,
  activeFilterCount,
  hasActiveFilters,
  type TaskFilters,
} from './taskFilters';

const ANY = '__any__';

export interface TaskFilterBarProps {
  filters: TaskFilters;
  onChange: (next: TaskFilters) => void;
  /** Distinct labels present in the loaded tasks. */
  labels: string[];
}

export const TaskFilterBar: React.FC<TaskFilterBarProps> = ({ filters, onChange, labels }) => {
  const { users, getName } = useUserDirectory();
  const active = users.filter((u) => u.isActive);

  const set = (patch: Partial<TaskFilters>) => onChange({ ...filters, ...patch });

  const assigneeLabel =
    filters.assignee === ASSIGNEE_ME
      ? 'Me'
      : filters.assignee === 'unassigned'
      ? 'Unassigned'
      : filters.assignee
      ? getName(filters.assignee)
      : 'Anyone';

  return (
    <div className="flex flex-wrap items-center gap-1.5" data-testid="task-filter-bar">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.search}
          onChange={(e) => set({ search: e.target.value })}
          placeholder="Search tasks..."
          aria-label="Search tasks"
          className="h-7 w-[180px] pl-7 text-xs"
        />
      </div>

      <Select
        value={filters.assignee ?? ANY}
        onValueChange={(v) => set({ assignee: v === ANY ? null : v })}
      >
        <SelectTrigger className="h-7 w-auto gap-1 text-xs" aria-label="Filter by assignee">
          <SelectValue>{assigneeLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Anyone</SelectItem>
          <SelectItem value={ASSIGNEE_ME}>Me</SelectItem>
          <SelectItem value="unassigned">Unassigned</SelectItem>
          {active.map((u) => (
            <SelectItem key={u.id} value={u.id}>
              {u.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.priority ?? ANY}
        onValueChange={(v) => set({ priority: v === ANY ? null : (v as PriorityEnum) })}
      >
        <SelectTrigger className="h-7 w-auto gap-1 text-xs" aria-label="Filter by priority">
          <SelectValue>{filters.priority ?? 'Any priority'}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Any priority</SelectItem>
          {Object.values(PriorityEnum).map((p) => (
            <SelectItem key={p} value={p}>
              {p}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.relatedType ?? ANY}
        onValueChange={(v) => set({ relatedType: v === ANY ? null : (v as TaskRelatedType) })}
      >
        <SelectTrigger className="h-7 w-auto gap-1 text-xs" aria-label="Filter by linked record">
          <SelectValue>
            {filters.relatedType
              ? TASK_RELATED_TYPE_OPTIONS.find((o) => o.value === filters.relatedType)?.label
              : 'Any link'}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Any link</SelectItem>
          {TASK_RELATED_TYPE_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {labels.length > 0 && (
        <Select
          value={filters.label ?? ANY}
          onValueChange={(v) => set({ label: v === ANY ? null : v })}
        >
          <SelectTrigger className="h-7 w-auto gap-1 text-xs" aria-label="Filter by label">
            <SelectValue>{filters.label ?? 'Any label'}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>Any label</SelectItem>
            {labels.map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {hasActiveFilters(filters) && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => onChange(EMPTY_FILTERS)}
          data-testid="task-filters-clear"
        >
          <X className="h-3 w-3" />
          Clear
          <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[10px]">
            {activeFilterCount(filters)}
          </Badge>
        </Button>
      )}
    </div>
  );
};

export default TaskFilterBar;
