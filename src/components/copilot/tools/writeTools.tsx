// src/components/copilot/tools/writeTools.tsx
//
// First-class cards for the 6 confirm-before-write tools. Each renders a
// human-readable summary of the proposed change and, while awaiting the user's
// decision, the Approve/Cancel bar. After execution it shows the result.

import type { ToolCallMessagePartProps } from '@assistant-ui/react';
import { UserPlus, PencilLine, Tag, CheckSquare, CalendarPlus, Activity, StickyNote } from 'lucide-react';
import { ToolCard, ConfirmBar, ArgRows, ResultBlock, useToolPhase } from './shared';

function WriteCard({
  icon,
  title,
  toolCallId,
  args,
  result,
  isError,
  fields,
}: {
  icon: React.ReactNode;
  title: string;
  toolCallId: string;
  args: Record<string, unknown>;
  result: unknown;
  isError?: boolean;
  fields?: string[];
}) {
  const phase = useToolPhase(toolCallId, result, isError);
  return (
    <ToolCard icon={icon} title={title} phase={phase}>
      <ArgRows args={args} only={fields} />
      {phase === 'awaiting' && <div className="mt-2"><ConfirmBar toolCallId={toolCallId} /></div>}
      <ResultBlock result={result} isError={isError} />
    </ToolCard>
  );
}

export function CreateLeadToolUI(p: ToolCallMessagePartProps) {
  return <WriteCard icon={<UserPlus className="h-3.5 w-3.5 text-primary" />} title="Create lead" toolCallId={p.toolCallId} args={(p.args ?? {}) as Record<string, unknown>} result={p.result} isError={p.isError} fields={['name', 'phone', 'email', 'company', 'source', 'status_id', 'assigned_to']} />;
}

export function UpdateLeadToolUI(p: ToolCallMessagePartProps) {
  return <WriteCard icon={<PencilLine className="h-3.5 w-3.5 text-primary" />} title="Update lead" toolCallId={p.toolCallId} args={(p.args ?? {}) as Record<string, unknown>} result={p.result} isError={p.isError} />;
}

export function UpdateLeadStatusToolUI(p: ToolCallMessagePartProps) {
  return <WriteCard icon={<Tag className="h-3.5 w-3.5 text-primary" />} title="Change lead status" toolCallId={p.toolCallId} args={(p.args ?? {}) as Record<string, unknown>} result={p.result} isError={p.isError} fields={['lead_id', 'status_id']} />;
}

export function CreateTaskToolUI(p: ToolCallMessagePartProps) {
  return <WriteCard icon={<CheckSquare className="h-3.5 w-3.5 text-primary" />} title="Create task" toolCallId={p.toolCallId} args={(p.args ?? {}) as Record<string, unknown>} result={p.result} isError={p.isError} fields={['title', 'due_date', 'lead_id', 'assigned_to', 'status']} />;
}

export function CreateMeetingToolUI(p: ToolCallMessagePartProps) {
  return <WriteCard icon={<CalendarPlus className="h-3.5 w-3.5 text-primary" />} title="Schedule meeting" toolCallId={p.toolCallId} args={(p.args ?? {}) as Record<string, unknown>} result={p.result} isError={p.isError} fields={['title', 'lead_id', 'start_time', 'end_time', 'location']} />;
}

export function CreateLeadActivityToolUI(p: ToolCallMessagePartProps) {
  return <WriteCard icon={<Activity className="h-3.5 w-3.5 text-primary" />} title="Log activity" toolCallId={p.toolCallId} args={(p.args ?? {}) as Record<string, unknown>} result={p.result} isError={p.isError} fields={['lead_id', 'type', 'content']} />;
}

export function AppendNoteToolUI(p: ToolCallMessagePartProps) {
  const args = (p.args ?? {}) as Record<string, unknown>;
  return (
    <WriteCard
      icon={<StickyNote className="h-3.5 w-3.5 text-primary" />}
      title="Append lead note"
      toolCallId={p.toolCallId}
      args={args}
      result={p.result}
      isError={p.isError}
      fields={['lead_id', 'text']}
    />
  );
}
