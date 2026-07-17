// src/components/copilot/tools/readTools.tsx
//
// First-class cards for the read tools (auto-run, no confirmation). They render
// a friendly summary/table of the result instead of raw JSON.

import type { ToolCallMessagePartProps } from '@assistant-ui/react';
import { FileText, Search, User, Tag, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ToolCard, ResultBlock, useToolPhase, ArgRows } from './shared';

function rowsFrom(result: unknown): any[] {
  if (Array.isArray(result)) return result;
  const r = result as any;
  if (r && Array.isArray(r.results)) return r.results;
  return [];
}
function countFrom(result: unknown, rows: any[]): number {
  const r = result as any;
  return typeof r?.count === 'number' ? r.count : rows.length;
}

export function ListLeadsToolUI(p: ToolCallMessagePartProps) {
  const phase = useToolPhase(p.toolCallId, p.result, p.isError);
  const rows = rowsFrom(p.result);
  const total = countFrom(p.result, rows);
  return (
    <ToolCard icon={<Search className="h-3.5 w-3.5 text-muted-foreground" />} title="Search leads" phase={phase}>
      <ArgRows args={(p.args ?? {}) as Record<string, unknown>} />
      {phase === 'done' && (
        <div className="mt-1">
          <p className="mb-1 text-xs text-muted-foreground">{total} lead{total === 1 ? '' : 's'} found</p>
          {rows.length > 0 && (
            <div className="overflow-hidden rounded-md border border-border">
              <table className="w-full text-xs">
                <tbody>
                  {rows.slice(0, 6).map((l: any) => (
                    <tr key={l.id} className="border-b border-border/50 last:border-0">
                      <td className="px-2 py-1 font-medium text-foreground">
                        <Link to={`/crm/leads/${l.id}`} className="hover:underline">{l.name || `Lead #${l.id}`}</Link>
                      </td>
                      <td className="px-2 py-1 text-muted-foreground">{l.phone || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 6 && <p className="px-2 py-1 text-[11px] text-muted-foreground">+{rows.length - 6} more…</p>}
            </div>
          )}
        </div>
      )}
      {phase === 'error' && <ResultBlock result={p.result} isError />}
    </ToolCard>
  );
}

export function GetLeadToolUI(p: ToolCallMessagePartProps) {
  const phase = useToolPhase(p.toolCallId, p.result, p.isError);
  const lead = p.result as any;
  return (
    <ToolCard icon={<User className="h-3.5 w-3.5 text-muted-foreground" />} title="Lead details" phase={phase}>
      {phase === 'done' && lead && typeof lead === 'object' ? (
        <div className="text-xs">
          <p className="font-medium text-foreground">
            <Link to={`/crm/leads/${lead.id}`} className="hover:underline">{lead.name || `Lead #${lead.id}`}</Link>
          </p>
          <p className="text-muted-foreground">{[lead.phone, lead.email, lead.company].filter(Boolean).join(' · ') || '—'}</p>
        </div>
      ) : (
        <ResultBlock result={p.result} isError={p.isError} />
      )}
    </ToolCard>
  );
}

export function GetLeadContextToolUI(p: ToolCallMessagePartProps) {
  const phase = useToolPhase(p.toolCallId, p.result, p.isError);
  const result = (p.result ?? {}) as any;
  const lead = result.lead ?? {};
  const activities = Array.isArray(result.recent_activities) ? result.recent_activities : [];
  const tasks = Array.isArray(result.open_tasks) ? result.open_tasks : [];
  const notes = typeof result.notes === 'string' ? result.notes.trim() : '';

  return (
    <ToolCard icon={<FileText className="h-3.5 w-3.5 text-muted-foreground" />} title="Lead context" phase={phase}>
      {phase === 'done' && result && typeof result === 'object' ? (
        <div className="space-y-2 text-xs">
          <div>
            <p className="font-medium text-foreground">
              {lead.id ? (
                <Link to={`/crm/leads/${lead.id}`} className="hover:underline">{lead.name || `Lead #${lead.id}`}</Link>
              ) : (
                lead.name || 'Lead'
              )}
            </p>
            <p className="text-muted-foreground">
              {[lead.phone, lead.email, lead.company, lead.status_name || lead.priority].filter(Boolean).join(' · ') || 'No contact summary'}
            </p>
          </div>
          {notes && <p className="line-clamp-3 whitespace-pre-wrap rounded-md bg-muted/40 p-2 text-muted-foreground">{notes}</p>}
          <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
            <span className="rounded-full border px-2 py-0.5">{activities.length} recent activit{activities.length === 1 ? 'y' : 'ies'}</span>
            <span className="rounded-full border px-2 py-0.5">{tasks.length} open task{tasks.length === 1 ? '' : 's'}</span>
          </div>
        </div>
      ) : (
        <ResultBlock result={p.result} isError={p.isError} />
      )}
    </ToolCard>
  );
}

export function ListLeadStatusesToolUI(p: ToolCallMessagePartProps) {
  const phase = useToolPhase(p.toolCallId, p.result, p.isError);
  const rows = rowsFrom(p.result);
  return (
    <ToolCard icon={<Tag className="h-3.5 w-3.5 text-muted-foreground" />} title="Lead statuses" phase={phase}>
      {phase === 'done' && rows.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {rows.map((s: any) => (
            <span key={s.id} className="rounded-full border px-2 py-0.5 text-[11px]" style={{ borderColor: s.color_hex || undefined, color: s.color_hex || undefined }}>
              {s.name}
            </span>
          ))}
        </div>
      ) : (
        <ResultBlock result={p.result} isError={p.isError} />
      )}
    </ToolCard>
  );
}

export function ListUsersToolUI(p: ToolCallMessagePartProps) {
  const phase = useToolPhase(p.toolCallId, p.result, p.isError);
  const rows = rowsFrom(p.result);
  return (
    <ToolCard icon={<Users className="h-3.5 w-3.5 text-muted-foreground" />} title="Team members" phase={phase}>
      {phase === 'done' && rows.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {rows.slice(0, 8).map((u: any) => u.name || u.email || u.first_name || `User ${u.id}`).join(', ')}
          {rows.length > 8 ? `, +${rows.length - 8} more` : ''}
        </p>
      ) : (
        <ResultBlock result={p.result} isError={p.isError} />
      )}
    </ToolCard>
  );
}
