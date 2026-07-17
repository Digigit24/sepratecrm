// src/components/copilot/toolRegistry.ts
//
// Maps a UI-level `selectedTool` (the string passed to Create-with-AI /
// openWith) to a concrete backend tool + a human title + a system hint + a
// prefilled-args builder. Used to give the copilot panel a focused starting
// point when opened from a "Create with AI" button.
//
// The backend still decides which tool to call; this only nudges/pre-fills.

export interface ToolSpec {
  /** Backend tool name the LLM should be steered toward. */
  backendTool: string;
  /** Human-readable panel title. */
  title: string;
  /** System hint appended to the backend context to steer the model. */
  systemHint: string;
  /** Optional first user message to seed the composer with. */
  seedMessage?: (ctx?: Record<string, unknown> | null) => string;
  /** Optional prefilled args derived from the trigger context. */
  prefill?: (ctx?: Record<string, unknown> | null) => Record<string, unknown>;
}

export const TOOL_REGISTRY: Record<string, ToolSpec> = {
  'crm.lead.create': {
    backendTool: 'create_lead',
    title: 'Create a lead with AI',
    systemHint:
      'Help the user create a CRM lead. Ask for the name and phone if missing, then call create_lead.',
    seedMessage: (ctx) =>
      `Create a new lead${ctx?.name ? ` named ${ctx.name}` : ''}${ctx?.phone ? ` (${ctx.phone})` : ''}.`,
    prefill: (ctx) => ({ name: ctx?.name, phone: ctx?.phone, source: ctx?.source }),
  },
  'crm.lead.update': {
    backendTool: 'update_lead',
    title: 'Update a lead with AI',
    systemHint: 'Help the user update an existing lead. Confirm which fields to change, then call update_lead.',
    prefill: (ctx) => ({ lead_id: ctx?.leadId ?? ctx?.lead_id }),
  },
  'crm.lead.status': {
    backendTool: 'update_lead_status',
    title: 'Change lead status',
    systemHint: 'Help the user change a lead status. Use list_lead_statuses to resolve the target, then update_lead_status.',
    prefill: (ctx) => ({ lead_id: ctx?.leadId ?? ctx?.lead_id }),
  },
  'crm.status.create': {
    backendTool: 'create_lead_status',
    title: 'Create a lead status with AI',
    systemHint:
      'Help the user create a CRM lead status. Ask for the status name, color, and won/lost behavior if missing, then call create_lead_status.',
    seedMessage: () => 'Create a new lead status.',
    prefill: (ctx) => ({ source: ctx?.source, order_index: ctx?.nextOrderIndex }),
  },
  'crm.group.create': {
    backendTool: 'create_lead_group',
    title: 'Create a lead group with AI',
    systemHint:
      'Help the user create a CRM lead group. Ask for the group name, description, and color if missing, then call create_lead_group.',
    seedMessage: () => 'Create a new lead group.',
    prefill: (ctx) => ({ source: ctx?.source, color_hex: ctx?.color_hex }),
  },
  'crm.task.create': {
    backendTool: 'create_task',
    title: 'Create a task with AI',
    systemHint: 'Help the user create a CRM task. Ask for a title and due date if missing, then call create_task.',
    prefill: (ctx) => ({ lead_id: ctx?.leadId ?? ctx?.lead_id }),
  },
  'crm.meeting.create': {
    backendTool: 'create_meeting',
    title: 'Schedule a meeting with AI',
    systemHint: 'Help the user schedule a meeting for a lead. Collect title, start and end time, then call create_meeting.',
    prefill: (ctx) => ({ lead_id: ctx?.leadId ?? ctx?.lead_id }),
  },
  'crm.activity.create': {
    backendTool: 'create_lead_activity',
    title: 'Log an activity with AI',
    systemHint: 'Help the user log a lead activity (call/email/note). Collect type + content, then call create_lead_activity.',
    prefill: (ctx) => ({ lead_id: ctx?.leadId ?? ctx?.lead_id }),
  },
};

export function resolveToolSpec(selectedTool: string | null | undefined): ToolSpec | null {
  if (!selectedTool) return null;
  return TOOL_REGISTRY[selectedTool] ?? null;
}
