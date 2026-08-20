// src/components/tasks/TaskRelatedPicker.tsx
//
// The "what is this task attached to" record picker.
//
// It lives in its own component ON PURPOSE. `useLeads()` and `useMeetings()`
// build their SWR key unconditionally (`['leads', params]`), so there is no way
// to call them "only when needed" from inside a bigger component -- passing
// `undefined` still fires the request. Every task drawer opened from a lead
// would therefore have fetched 200 leads it was never going to show.
// A component that is not rendered runs no hooks, so gating the *component* is
// the only way to gate the fetch.

import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCRM } from '@/hooks/useCRM';
import { useMeeting } from '@/hooks/useMeeting';
import type { TaskRelatedType } from '@/types/crmTypes';

interface PickerProps {
  relatedId: number | null;
  onChange: (id: number | null) => void;
  disabled?: boolean;
  placeholder?: string | null;
}

const LeadPicker: React.FC<PickerProps> = ({ relatedId, onChange, disabled, placeholder }) => {
  const { useLeads } = useCRM();
  const { data, isLoading } = useLeads({ page_size: 200, ordering: '-created_at' });
  const leads = data?.results ?? [];

  return (
    <Select
      value={relatedId ? String(relatedId) : ''}
      onValueChange={(v) => onChange(Number(v))}
      disabled={disabled || isLoading}
    >
      <SelectTrigger id="task-related-id" className="h-9">
        <SelectValue placeholder={isLoading ? 'Loading leads...' : placeholder || 'Pick a lead'} />
      </SelectTrigger>
      <SelectContent>
        {leads.map((lead) => (
          <SelectItem key={lead.id} value={String(lead.id)}>
            {lead.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

const MeetingPicker: React.FC<PickerProps> = ({ relatedId, onChange, disabled, placeholder }) => {
  const { useMeetings } = useMeeting();
  const { data, isLoading } = useMeetings({ page_size: 200 });
  const meetings = data?.results ?? [];

  return (
    <Select
      value={relatedId ? String(relatedId) : ''}
      onValueChange={(v) => onChange(Number(v))}
      disabled={disabled || isLoading}
    >
      <SelectTrigger id="task-related-id" className="h-9">
        <SelectValue
          placeholder={isLoading ? 'Loading meetings...' : placeholder || 'Pick a meeting'}
        />
      </SelectTrigger>
      <SelectContent>
        {meetings.map((m) => (
          <SelectItem key={m.id} value={String(m.id)}>
            {m.title}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export interface TaskRelatedPickerProps {
  relatedType: TaskRelatedType;
  relatedId: number | null;
  onChange: (id: number | null) => void;
  disabled?: boolean;
  /** Server-resolved label, used as the placeholder before the list arrives. */
  relatedLabel?: string | null;
}

export const TaskRelatedPicker: React.FC<TaskRelatedPickerProps> = ({
  relatedType,
  relatedId,
  onChange,
  disabled,
  relatedLabel,
}) => {
  if (relatedType === 'LEAD') {
    return (
      <LeadPicker
        relatedId={relatedId}
        onChange={onChange}
        disabled={disabled}
        placeholder={relatedLabel}
      />
    );
  }

  if (relatedType === 'MEETING') {
    return (
      <MeetingPicker
        relatedId={relatedId}
        onChange={onChange}
        disabled={disabled}
        placeholder={relatedLabel}
      />
    );
  }

  // Projects and Units have no list endpoint in this app yet. Rather than fake
  // a picker, take the id and show whatever label the server resolved.
  return (
    <div className="flex items-center gap-2">
      <Input
        id="task-related-id"
        type="number"
        min={1}
        value={relatedId ?? ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        disabled={disabled}
        placeholder="Record ID"
        className="h-9 w-32"
      />
      <span className="text-xs text-muted-foreground truncate">
        {relatedLabel || 'A picker arrives with the backend'}
      </span>
    </div>
  );
};

export default TaskRelatedPicker;
