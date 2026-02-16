// src/components/workflow-editor/step-templates/stepTemplates.ts
import {
  Zap,
  RefreshCw,
  Webhook,
  Clock,
  Hand,
  UserPlus,
  UserCog,
  Users,
  Mail,
  MessageSquare,
  Link,
  Code,
} from 'lucide-react';
import type { StepTemplate } from '../types/workflowEditor.types';

export const STEP_TEMPLATES: StepTemplate[] = [
  // TRIGGERS
  {
    id: 'google-sheets-new-row',
    category: 'trigger',
    name: 'New Row in Google Sheets',
    description: 'Triggers when a new row is added to a spreadsheet',
    icon: Zap,
    integrations: ['GOOGLE_SHEETS'],
    defaultConfig: { trigger_type: 'NEW_ROW' },
  },
  {
    id: 'google-sheets-updated-row',
    category: 'trigger',
    name: 'Updated Row in Google Sheets',
    description: 'Triggers when a row is updated in a spreadsheet',
    icon: RefreshCw,
    integrations: ['GOOGLE_SHEETS'],
    defaultConfig: { trigger_type: 'UPDATED_ROW' },
  },
  {
    id: 'webhook-trigger',
    category: 'trigger',
    name: 'Webhook',
    description: 'Triggers when a webhook is received',
    icon: Webhook,
    integrations: [],
    defaultConfig: { trigger_type: 'WEBHOOK' },
  },
  {
    id: 'schedule-trigger',
    category: 'trigger',
    name: 'Schedule',
    description: 'Triggers at specified time intervals',
    icon: Clock,
    integrations: [],
    defaultConfig: { trigger_type: 'SCHEDULE' },
  },
  {
    id: 'manual-trigger',
    category: 'trigger',
    name: 'Manual',
    description: 'Triggers manually via button click',
    icon: Hand,
    integrations: [],
    defaultConfig: { trigger_type: 'MANUAL' },
  },

  // ACTIONS
  {
    id: 'create-lead',
    category: 'action',
    name: 'Create Lead in CRM',
    description: 'Creates a new lead in your CRM system',
    icon: UserPlus,
    integrations: [],
    defaultConfig: { action_type: 'CREATE_LEAD' },
  },
  {
    id: 'update-lead',
    category: 'action',
    name: 'Update Lead in CRM',
    description: 'Updates an existing lead in your CRM',
    icon: UserCog,
    integrations: [],
    defaultConfig: { action_type: 'UPDATE_LEAD' },
  },
  {
    id: 'create-contact',
    category: 'action',
    name: 'Create Contact',
    description: 'Creates a new contact record',
    icon: Users,
    integrations: [],
    defaultConfig: { action_type: 'CREATE_CONTACT' },
  },
  {
    id: 'send-email',
    category: 'action',
    name: 'Send Email',
    description: 'Sends an email notification',
    icon: Mail,
    integrations: [],
    defaultConfig: { action_type: 'SEND_EMAIL' },
  },
  {
    id: 'send-sms',
    category: 'action',
    name: 'Send SMS',
    description: 'Sends an SMS message',
    icon: MessageSquare,
    integrations: [],
    defaultConfig: { action_type: 'SEND_SMS' },
  },
  {
    id: 'webhook-action',
    category: 'action',
    name: 'Webhook',
    description: 'Calls an external webhook URL',
    icon: Link,
    integrations: [],
    defaultConfig: { action_type: 'WEBHOOK' },
  },
  {
    id: 'custom-action',
    category: 'action',
    name: 'Custom Action',
    description: 'Execute custom code or logic',
    icon: Code,
    integrations: [],
    defaultConfig: { action_type: 'CUSTOM' },
  },
];

// Helper functions
export const getTriggerTemplates = () =>
  STEP_TEMPLATES.filter((t) => t.category === 'trigger');

export const getActionTemplates = () =>
  STEP_TEMPLATES.filter((t) => t.category === 'action');

export const getTemplateById = (id: string) =>
  STEP_TEMPLATES.find((t) => t.id === id);

export const searchTemplates = (query: string, category?: 'trigger' | 'action') => {
  let templates = STEP_TEMPLATES;

  if (category) {
    templates = templates.filter((t) => t.category === category);
  }

  if (!query.trim()) {
    return templates;
  }

  const lowerQuery = query.toLowerCase();
  return templates.filter(
    (t) =>
      t.name.toLowerCase().includes(lowerQuery) ||
      t.description.toLowerCase().includes(lowerQuery)
  );
};
