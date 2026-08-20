// src/components/tasks/TaskFormFields.tsx
//
// The single canonical task field editor.
//
// Both surfaces render THIS component: the modal-style `TaskFormDrawer` (used
// by the tasks page's "New task" and by the two lead-drawer call sites) and the
// persistent `TaskSidePanel` on /crm/tasks. That is what stops a third variant
// of the same form appearing the next time someone needs to edit a task.
//
// It is fully controlled: `draft` in, `onChange` out. It owns no server state
// and performs no saving, so the drawer can save on a footer button while the
// panel saves field-by-field.

import { useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X } from 'lucide-react';
import { UserAvatar } from '@/components/user';
import { useUserDirectory } from '@/hooks/useUserDirectory';
import { TaskRelatedPicker } from './TaskRelatedPicker';
import {
  PriorityEnum,
  TASK_RELATED_TYPE_OPTIONS,
  TASK_STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  TaskStatusEnum,
  type TaskRelatedType,
} from '@/types/crmTypes';
import { REMINDER_OFFSET_OPTIONS, type TaskDraft } from './taskDraft';

const UNASSIGNED = '__unassigned__';

export interface TaskFormFieldsProps {
  draft: TaskDraft;
  onChange: (patch: Partial<TaskDraft>) => void;
  readOnly?: boolean;
  disabled?: boolean;
  /**
   * Pins the task to one lead and hides the link picker. Used by the lead
   * drawer, where "which record is this for" is already answered.
   */
  lockedToLeadId?: number | null;
  /** Server-resolved name of the linked record, when the backend sent one. */
  relatedLabel?: string | null;
  /** Hides status; the side panel renders status as its own header control. */
  hideStatus?: boolean;
  layout?: 'rows' | 'stacked';
}

const Row: React.FC<{ label: string; htmlFor?: string; children: React.ReactNode }> = ({
  label,
  htmlFor,
  children,
}) => (
  <div className="grid grid-cols-[110px_1fr] items-center gap-3 py-2.5">
    <Label htmlFor={htmlFor} className="text-[13px] text-muted-foreground font-normal">
      {label}
    </Label>
    {children}
  </div>
);

export const TaskFormFields: React.FC<TaskFormFieldsProps> = ({
  draft,
  onChange,
  readOnly = false,
  disabled = false,
  lockedToLeadId = null,
  relatedLabel,
  hideStatus = false,
}) => {
  // The one canonical user directory. Never add a second user-fetching path.
  const { users: directoryUsers, isLoading: usersLoading, getName } = useUserDirectory();
  const assignableUsers = useMemo(() => directoryUsers.filter((u) => u.isActive), [directoryUsers]);

  const isLocked = disabled || readOnly;

  const setRelatedType = (value: TaskRelatedType) => {
    // Changing the kind of link invalidates the id that went with it.
    onChange({ relatedType: value, relatedId: null });
  };

  const removeLabel = (label: string) =>
    onChange({ labels: draft.labels.filter((l) => l !== label) });

  const addLabelFromInput = (raw: string) => {
    const next = raw.trim();
    if (!next || draft.labels.includes(next)) return;
    onChange({ labels: [...draft.labels, next] });
  };

  return (
    <div className="space-y-5" data-testid="task-form-fields">
      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-0.5 mb-2">
          Task
        </h3>
        <div className="divide-y divide-border/40">
          <Row label="Title" htmlFor="task-title">
            {readOnly ? (
              <span className="text-sm font-medium">{draft.title || 'Untitled'}</span>
            ) : (
              <Input
                id="task-title"
                value={draft.title}
                onChange={(e) => onChange({ title: e.target.value })}
                disabled={disabled}
                placeholder="What needs doing?"
                className="h-9"
              />
            )}
          </Row>

          {!hideStatus && (
            <Row label="Status" htmlFor="task-status">
              {readOnly ? (
                <span className="text-sm font-medium">{draft.status}</span>
              ) : (
                <Select
                  value={draft.status}
                  onValueChange={(v) => onChange({ status: v as TaskStatusEnum })}
                  disabled={disabled}
                >
                  <SelectTrigger id="task-status" className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_STATUS_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Row>
          )}

          <Row label="Priority" htmlFor="task-priority">
            {readOnly ? (
              <span className="text-sm font-medium">{draft.priority}</span>
            ) : (
              <Select
                value={draft.priority}
                onValueChange={(v) => onChange({ priority: v as PriorityEnum })}
                disabled={disabled}
              >
                <SelectTrigger id="task-priority" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Row>
        </div>
      </div>

      {/* ---- Scheduling: the follow-up deadline, with a time ---- */}
      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-0.5 mb-2">
          Follow-up
        </h3>
        <div className="divide-y divide-border/40">
          <Row label="All day" htmlFor="task-allday">
            <div className="flex items-center gap-2">
              <Switch
                id="task-allday"
                checked={draft.isAllDay}
                onCheckedChange={(checked) => onChange({ isAllDay: checked })}
                disabled={isLocked}
              />
              <span className="text-xs text-muted-foreground">
                {draft.isAllDay ? 'A date, no clock time' : 'Deadline has a time'}
              </span>
            </div>
          </Row>

          <Row label="Due" htmlFor="task-due-day">
            {readOnly ? (
              <span className="text-sm font-medium">
                {draft.dueDay
                  ? `${draft.dueDay}${draft.isAllDay ? '' : ` at ${draft.dueTime}`}`
                  : 'No deadline'}
              </span>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  id="task-due-day"
                  type="date"
                  value={draft.dueDay}
                  onChange={(e) => onChange({ dueDay: e.target.value })}
                  disabled={disabled}
                  className="h-9"
                />
                {!draft.isAllDay && (
                  <Input
                    aria-label="Due time"
                    type="time"
                    value={draft.dueTime}
                    onChange={(e) => onChange({ dueTime: e.target.value })}
                    disabled={disabled || !draft.dueDay}
                    className="h-9 w-[110px]"
                  />
                )}
              </div>
            )}
          </Row>

          <Row label="Start" htmlFor="task-start-day">
            {readOnly ? (
              <span className="text-sm font-medium">{draft.startDay || 'Not set'}</span>
            ) : (
              <Input
                id="task-start-day"
                type="date"
                value={draft.startDay}
                onChange={(e) => onChange({ startDay: e.target.value })}
                disabled={disabled}
                className="h-9"
              />
            )}
          </Row>

          <Row label="Repeats" htmlFor="task-rrule">
            {readOnly ? (
              <span className="text-sm font-medium">{draft.rrule || 'Does not repeat'}</span>
            ) : (
              <Select
                value={draft.rrule || 'none'}
                onValueChange={(v) => onChange({ rrule: v === 'none' ? '' : v })}
                disabled={disabled}
              >
                <SelectTrigger id="task-rrule" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Does not repeat</SelectItem>
                  <SelectItem value="FREQ=DAILY">Every day</SelectItem>
                  <SelectItem value="FREQ=WEEKLY">Every week</SelectItem>
                  <SelectItem value="FREQ=MONTHLY">Every month</SelectItem>
                  <SelectItem value="FREQ=YEARLY">Every year</SelectItem>
                </SelectContent>
              </Select>
            )}
          </Row>

          <Row label="Remind" htmlFor="task-reminder">
            {readOnly ? (
              <span className="text-sm font-medium">
                {REMINDER_OFFSET_OPTIONS.find((o) => o.value === draft.reminderOffsetMinutes)
                  ?.label ?? 'No reminder'}
              </span>
            ) : (
              <Select
                value={String(draft.reminderOffsetMinutes ?? 'null')}
                onValueChange={(v) =>
                  onChange({ reminderOffsetMinutes: v === 'null' ? null : Number(v) })
                }
                disabled={disabled || !draft.dueDay}
              >
                <SelectTrigger id="task-reminder" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REMINDER_OFFSET_OPTIONS.map((o) => (
                    <SelectItem key={String(o.value)} value={String(o.value ?? 'null')}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Row>
        </div>
      </div>

      {/* ---- Assignment ---- */}
      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-0.5 mb-2">
          Assignment
        </h3>
        <div className="divide-y divide-border/40">
          <Row label="Assignee" htmlFor="task-assignee">
            {readOnly ? (
              <span className="text-sm font-medium">
                <UserAvatar id={draft.assigneeUserId || null} size="xs" showName fallback="Unassigned" />
              </span>
            ) : (
              <Select
                value={draft.assigneeUserId || UNASSIGNED}
                onValueChange={(v) => onChange({ assigneeUserId: v === UNASSIGNED ? '' : v })}
                disabled={disabled || usersLoading}
              >
                <SelectTrigger id="task-assignee" className="h-9">
                  <SelectValue placeholder={usersLoading ? 'Loading people...' : 'Assign to...'}>
                    {draft.assigneeUserId ? getName(draft.assigneeUserId) : 'Unassigned'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                  {assignableUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      <UserAvatar id={u.id} size="xs" showName />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Row>

          <Row label="Reporter" htmlFor="task-reporter">
            {readOnly ? (
              <span className="text-sm font-medium">
                <UserAvatar id={draft.reporterUserId || null} size="xs" showName fallback="Not set" />
              </span>
            ) : (
              <Select
                value={draft.reporterUserId || UNASSIGNED}
                onValueChange={(v) => onChange({ reporterUserId: v === UNASSIGNED ? '' : v })}
                disabled={disabled || usersLoading}
              >
                <SelectTrigger id="task-reporter" className="h-9">
                  <SelectValue placeholder="Not set">
                    {draft.reporterUserId ? getName(draft.reporterUserId) : 'Not set'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>Not set</SelectItem>
                  {assignableUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      <UserAvatar id={u.id} size="xs" showName />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </Row>
        </div>
      </div>

      {/* ---- The linked CRM record ---- */}
      {!lockedToLeadId && (
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-0.5 mb-2">
            Linked record
          </h3>
          <div className="divide-y divide-border/40">
            <Row label="Type" htmlFor="task-related-type">
              {readOnly ? (
                <span className="text-sm font-medium">
                  {TASK_RELATED_TYPE_OPTIONS.find((o) => o.value === draft.relatedType)?.label ??
                    'No link'}
                </span>
              ) : (
                <Select
                  value={draft.relatedType}
                  onValueChange={(v) => setRelatedType(v as TaskRelatedType)}
                  disabled={disabled}
                >
                  <SelectTrigger id="task-related-type" className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_RELATED_TYPE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </Row>

            {draft.relatedType !== 'NONE' && (
              <Row label="Record" htmlFor="task-related-id">
                {readOnly ? (
                  <span className="text-sm font-medium">
                    {relatedLabel || (draft.relatedId ? `#${draft.relatedId}` : 'Not linked')}
                  </span>
                ) : (
                  <TaskRelatedPicker
                    relatedType={draft.relatedType}
                    relatedId={draft.relatedId}
                    onChange={(relatedId) => onChange({ relatedId })}
                    disabled={disabled}
                    relatedLabel={relatedLabel}
                  />
                )}
              </Row>
            )}
          </div>
        </div>
      )}

      {/* ---- Labels ---- */}
      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-0.5 mb-2">
          Labels
        </h3>
        <div className="flex flex-wrap items-center gap-1.5">
          {draft.labels.map((label) => (
            <Badge key={label} variant="secondary" className="text-[11px] gap-1">
              {label}
              {!readOnly && (
                <button
                  type="button"
                  aria-label={`Remove label ${label}`}
                  onClick={() => removeLabel(label)}
                  disabled={disabled}
                  className="hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
          {draft.labels.length === 0 && (
            <span className="text-xs text-muted-foreground">No labels</span>
          )}
        </div>
        {!readOnly && (
          <div className="flex items-center gap-2 mt-2">
            <Input
              aria-label="Add label"
              placeholder="Add a label and press Enter"
              disabled={disabled}
              className="h-8 text-xs"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addLabelFromInput((e.target as HTMLInputElement).value);
                  (e.target as HTMLInputElement).value = '';
                }
              }}
            />
          </div>
        )}
      </div>

      {/* ---- Description ---- */}
      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-0.5 mb-2">
          Description
        </h3>
        {readOnly ? (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {draft.description || 'No description'}
          </p>
        ) : (
          <Textarea
            id="task-description"
            value={draft.description}
            onChange={(e) => onChange({ description: e.target.value })}
            disabled={disabled}
            placeholder="Add any detail the assignee will need..."
            rows={4}
          />
        )}
      </div>
    </div>
  );
};

export default TaskFormFields;
