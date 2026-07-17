// src/lib/crmEvents.ts
//
// Lightweight app-wide pub/sub for "CRM data changed" notifications, in the
// same style as confirmationBridge. Used so a write performed OUTSIDE a list
// (e.g. the AI copilot creating a lead) can tell open lists to revalidate ONCE
// — no polling, no prop drilling.
//
// Producers: the copilot adapter emits on a successful lead/task/etc write.
// Consumers: a list page subscribes via `useCrmDataChanged` and triggers a
// one-time SWR mutate of its own keys.

import { useEffect, useRef } from 'react';

export interface CrmDataChange {
  /** Coarse resource bucket: 'leads' | 'tasks' | 'meetings' | 'activities' | 'statuses' … */
  resource: string;
  /** The backend tool/action that caused it (optional, for finer decisions). */
  tool?: string;
}

type Listener = (e: CrmDataChange) => void;

const listeners = new Set<Listener>();

/** Map a copilot backend tool name → the resource bucket it mutates. */
export const TOOL_RESOURCE: Record<string, string> = {
  create_lead: 'leads',
  update_lead: 'leads',
  update_lead_status: 'leads',
  append_note: 'leads',
  create_task: 'tasks',
  create_meeting: 'meetings',
  create_lead_activity: 'activities',
  create_lead_status: 'statuses',
  create_lead_group: 'groups',
};

export function emitCrmDataChanged(change: CrmDataChange): void {
  for (const l of listeners) {
    try {
      l(change);
    } catch {
      /* a bad subscriber must not break the others */
    }
  }
}

export function subscribeCrmDataChanged(cb: Listener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/**
 * Subscribe a component to CRM data-change events. The handler is kept in a ref
 * so the subscription is set up once (no churn / no stale closure).
 */
export function useCrmDataChanged(handler: Listener): void {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => subscribeCrmDataChanged((e) => ref.current(e)), []);
}
