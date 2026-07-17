// src/components/copilot/tools/index.ts
//
// Registry of tool-call renderers, wired into <MessagePrimitive.Parts> in
// CopilotThread via `components={{ tools: { by_name, Fallback } }}`.
//
// (assistant-ui 0.14 deprecates the older makeAssistantToolUI registration in
// favor of these inline `components.tools` overrides — the same first-class
// cards, just registered declaratively on the Parts primitive.)

import type { ToolCallMessagePartComponent } from '@assistant-ui/react';
import { ToolFallback } from './ToolFallback';
import {
  CreateLeadToolUI,
  UpdateLeadToolUI,
  UpdateLeadStatusToolUI,
  CreateTaskToolUI,
  CreateMeetingToolUI,
  CreateLeadActivityToolUI,
  AppendNoteToolUI,
} from './writeTools';
import {
  ListLeadsToolUI,
  GetLeadToolUI,
  GetLeadContextToolUI,
  ListLeadStatusesToolUI,
  ListUsersToolUI,
} from './readTools';

/** Tool name → first-class renderer. Unlisted tools fall back to ToolFallback. */
export const toolComponentsByName: Record<string, ToolCallMessagePartComponent> = {
  // reads
  list_leads: ListLeadsToolUI,
  get_lead: GetLeadToolUI,
  get_lead_context: GetLeadContextToolUI,
  list_lead_statuses: ListLeadStatusesToolUI,
  list_users: ListUsersToolUI,
  // writes (confirm-before-run)
  create_lead: CreateLeadToolUI,
  update_lead: UpdateLeadToolUI,
  update_lead_status: UpdateLeadStatusToolUI,
  create_task: CreateTaskToolUI,
  create_meeting: CreateMeetingToolUI,
  create_lead_activity: CreateLeadActivityToolUI,
  append_note: AppendNoteToolUI,
};

export const toolFallbackComponent = ToolFallback;
