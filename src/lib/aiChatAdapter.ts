// src/lib/aiChatAdapter.ts
//
// assistant-ui ChatModelAdapter for the Celiyo copilot — Phase 2a.
//
// Accumulates ORDERED CONTENT PARTS (text + tool-call) so assistant-ui renders
// text → tool card → result → more text in order.
//
// SSE contract — matches the digicrm backend (AI_COPILOT_PHASE2_PLAN.md §1.5 +
// digicrm/ai/providers.stream_agent):
//   data: {"type":"text-delta","delta":"..."}
//   data: {"type":"tool-call","id","name","args","requires_confirmation":bool,"status":"awaiting_confirmation"|"running"}
//   data: {"type":"tool-result","id","name","result","is_error":bool[,"declined":true]}
//   data: {"type":"error","message":"..."}
//   data: [DONE]
//
// Confirm-before-write handshake (backend pauses when a batch contains a write):
//   1. Backend emits every tool-call of the batch (writes carry
//      requires_confirmation:true, status:"awaiting_confirmation"), executes
//      NOTHING, ends the stream.
//   2. Frontend shows Approve/Cancel per write (confirmationBridge), then
//      re-POSTs with:
//        pending_tool_calls: [{id,name,args}, ...]   (the whole paused batch)
//        confirmations:      { [id]: { approved: boolean } }
//   3. Backend replays: executes approved calls (+ reads), emits
//      tool-result{declined:true} for rejected writes, then continues the turn.

import type { ChatModelAdapter, ChatModelRunOptions, ThreadMessage } from '@assistant-ui/react';
import { API_CONFIG } from '@/lib/apiConfig';
import { requestConfirmation } from '@/lib/confirmationBridge';
import { refreshAccessToken } from '@/lib/client';
import { emitCrmDataChanged, TOOL_RESOURCE } from '@/lib/crmEvents';

export interface ChatAdapterDeps {
  getToken: () => string | null;
  getTool: () => string | null;
  getContext: () => Record<string, unknown> | null;
}

interface TextPart {
  type: 'text';
  text: string;
}
interface ToolCallPart {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  // `any`-valued so the part is assignable to assistant-ui's
  // ToolCallMessagePart (args: ReadonlyJSONObject).
  args: Record<string, any>;
  argsText: string;
  result?: unknown;
  isError?: boolean;
}
type Part = TextPart | ToolCallPart;

const AI_CHAT_URL = `${API_CONFIG.CRM_BASE_URL}/ai/chat/`;
const MAX_CONTINUATIONS = 12;

function messageText(message: ThreadMessage): string {
  if (typeof (message as any).content === 'string') return (message as any).content;
  const parts = (message.content ?? []) as Array<{ type: string; text?: string }>;
  return parts
    .filter((p) => p.type === 'text' && typeof p.text === 'string')
    .map((p) => p.text as string)
    .join('');
}

function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v ?? {}, null, 2);
  } catch {
    return String(v);
  }
}

function postChat(
  body: unknown,
  token: string | null,
  abortSignal: AbortSignal,
): Promise<Response> {
  return fetch(AI_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
    signal: abortSignal,
  });
}

/** Safe, user-facing message for a non-OK HTTP status (no raw body text). */
function friendlyHttpError(status: number): string {
  switch (status) {
    case 401:
      return '\n\n⚠️ Your session has expired. Please sign in again to use the AI assistant.';
    case 403:
      return "\n\n⚠️ You don't have permission to use the AI assistant.";
    case 404:
      return '\n\n⚠️ The AI assistant endpoint is not available yet.';
    default:
      if (status >= 500) {
        return '\n\n⚠️ The AI assistant is temporarily unavailable. Please try again in a moment.';
      }
      return '\n\n⚠️ The AI assistant returned an unexpected error. Please try again.';
  }
}

export function createChatModelAdapter(deps: ChatAdapterDeps): ChatModelAdapter {
  return {
    async *run({ messages, abortSignal }: ChatModelRunOptions) {
      const parts: Part[] = [];
      const byId = new Map<string, ToolCallPart>();
      const requiresConfirm = new Map<string, boolean>();

      const snapshot = () => ({ content: parts.map((p) => ({ ...p })) });

      const appendText = (delta: string) => {
        const last = parts[parts.length - 1];
        if (last && last.type === 'text') last.text += delta;
        else parts.push({ type: 'text', text: delta });
      };

      const baseBody: Record<string, unknown> = {
        messages: messages.map((m) => ({ role: m.role, content: messageText(m) })),
        tool: deps.getTool() ?? undefined,
        context: deps.getContext() ?? undefined,
      };

      // On a confirm continuation, these are set for the next POST.
      let resumePendingCalls: Array<{ id: string; name: string; args: Record<string, unknown> }> | null = null;
      let resumeConfirmations: Record<string, { approved: boolean }> | null = null;

      for (let iter = 0; iter < MAX_CONTINUATIONS; iter++) {
        const body: Record<string, unknown> = { ...baseBody };
        if (resumePendingCalls) {
          body.pending_tool_calls = resumePendingCalls;
          body.confirmations = resumeConfirmations ?? {};
        }
        resumePendingCalls = null;
        resumeConfirmations = null;

        let response: Response | null = null;
        try {
          response = await postChat(body, deps.getToken(), abortSignal);
          // If the access token is stale, do the SAME single-flight refresh +
          // retry that src/lib/client.ts uses (this raw fetch bypasses the
          // axios interceptor), so a valid refresh token silently recovers.
          if (response.status === 401) {
            try {
              await refreshAccessToken();
              response = await postChat(body, deps.getToken(), abortSignal);
            } catch {
              // refresh failed → fall through to the friendly 401 message.
            }
          }
        } catch {
          appendText(
            "\n\n⚠️ The AI assistant isn't reachable right now. Please make sure the backend is running and try again.",
          );
          yield snapshot();
          return;
        }

        if (!response || !response.ok || !response.body) {
          // Map known statuses to safe messages — never surface raw backend
          // or proxy response bodies into the visible conversation.
          appendText(friendlyHttpError(response?.status ?? 0));
          yield snapshot();
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let doneSeen = false;

        try {
          while (!doneSeen) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let nl: number;
            while ((nl = buffer.indexOf('\n')) !== -1) {
              const rawLine = buffer.slice(0, nl).replace(/\r$/, '');
              buffer = buffer.slice(nl + 1);
              const line = rawLine.trim();
              if (!line || !line.startsWith('data:')) continue;

              const data = line.slice('data:'.length).trim();
              if (data === '[DONE]') {
                doneSeen = true;
                break;
              }

              let evt: any;
              try {
                evt = JSON.parse(data);
              } catch {
                continue;
              }

              switch (evt.type) {
                case 'text-delta':
                  if (typeof evt.delta === 'string') {
                    appendText(evt.delta);
                    yield snapshot();
                  }
                  break;

                case 'tool-call': {
                  const id = String(evt.id ?? `call_${parts.length}`);
                  const args = (evt.args ?? {}) as Record<string, unknown>;
                  let part = byId.get(id);
                  if (!part) {
                    part = {
                      type: 'tool-call',
                      toolCallId: id,
                      toolName: String(evt.name ?? 'tool'),
                      args,
                      argsText: safeJson(args),
                    };
                    parts.push(part);
                    byId.set(id, part);
                  } else {
                    part.args = args;
                    part.argsText = safeJson(args);
                  }
                  requiresConfirm.set(id, !!evt.requires_confirmation);
                  yield snapshot();
                  break;
                }

                case 'tool-result': {
                  const id = String(evt.id ?? '');
                  const part = byId.get(id);
                  if (part) {
                    part.result = evt.result;
                    // `declined` is a user choice, not a failure — keep isError false.
                    part.isError = !!evt.is_error;
                    yield snapshot();
                  }
                  // A successful write → tell open lists to revalidate once, so
                  // AI-made changes reflect instantly (no reload, no polling).
                  if (!evt.is_error && !evt.declined) {
                    const resource = TOOL_RESOURCE[String(evt.name ?? '')];
                    if (resource) emitCrmDataChanged({ resource, tool: String(evt.name) });
                  }
                  break;
                }

                case 'error':
                case 'not-configured':
                  appendText(String(evt.message ?? evt.delta ?? 'AI error'));
                  yield snapshot();
                  break;

                default:
                  break; // forward-compat: ignore unknown events
              }
            }
          }
        } finally {
          reader.releaseLock();
        }

        // Detect a confirm pause: tool-calls with no result yet. The backend
        // only pauses when the batch contains a write, so if any un-resulted
        // call requires confirmation we drive the Approve/Cancel handshake.
        const unresolved = parts.filter(
          (p): p is ToolCallPart => p.type === 'tool-call' && p.result === undefined,
        );
        const writes = unresolved.filter((p) => requiresConfirm.get(p.toolCallId));

        if (writes.length > 0) {
          // Ask the user per write; reads in the same batch auto-approve.
          const confirmations: Record<string, { approved: boolean }> = {};
          for (const p of unresolved) {
            if (requiresConfirm.get(p.toolCallId)) {
              const decision = await requestConfirmation({
                id: p.toolCallId,
                name: p.toolName,
                args: p.args,
              });
              confirmations[p.toolCallId] = { approved: decision === 'approve' };
            } else {
              confirmations[p.toolCallId] = { approved: true };
            }
          }

          resumePendingCalls = unresolved.map((p) => ({
            id: p.toolCallId,
            name: p.toolName,
            args: p.args,
          }));
          resumeConfirmations = confirmations;
          continue; // re-POST with the decisions → backend executes + continues
        }

        // Normal completion.
        if (!parts.length) {
          appendText('ℹ️ No response received from the assistant.');
          yield snapshot();
        }
        return;
      }

      appendText('\n\n_(Reached the confirmation-continuation limit for this turn.)_');
      yield snapshot();
    },
  };
}
