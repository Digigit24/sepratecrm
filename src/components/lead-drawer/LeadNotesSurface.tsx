// src/components/lead-drawer/LeadNotesSurface.tsx
//
// Notion-style page body for a lead: a borderless, auto-growing notes textarea
// (Lead.notes, autosaved by the parent) followed by an inline activity feed
// rendered as lightweight Notion blocks (not heavy cards). Reuses the existing
// activities API + ActivityFormDrawer add flow. Refreshes live when the AI
// copilot logs an activity (useCrmDataChanged).
//
// Data model note (Phase 3 D-1a): Lead.notes stays the human freeform body;
// discrete/timestamped notes live as LeadActivity(type=NOTE) shown inline here.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { useCrmDataChanged } from '@/lib/crmEvents';
import { Loader2, Plus, Phone, Mail, CalendarClock, MessageSquare, StickyNote, CircleDot } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ActivityTypeEnum } from '@/types/crmTypes';
import type { LeadActivity } from '@/types/crmTypes';
import ActivityFormDrawer from '@/components/ActivityFormDrawer';
import { cn } from '@/lib/utils';

/** Auto-grow a textarea to fit its content (no rich-text library). */
function useAutosizeTextarea(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return ref;
}

function typeIcon(type: ActivityTypeEnum) {
  switch (type) {
    case 'CALL': return <Phone className="h-3.5 w-3.5" />;
    case 'EMAIL': return <Mail className="h-3.5 w-3.5" />;
    case 'MEETING': return <CalendarClock className="h-3.5 w-3.5" />;
    case 'SMS': return <MessageSquare className="h-3.5 w-3.5" />;
    case 'NOTE': return <StickyNote className="h-3.5 w-3.5" />;
    default: return <CircleDot className="h-3.5 w-3.5" />;
  }
}

function ActivityBlock({ activity }: { activity: LeadActivity }) {
  const isNote = activity.type === 'NOTE';
  const when = activity.happened_at ? formatDistanceToNow(new Date(activity.happened_at), { addSuffix: true }) : '';
  return (
    <div className="group flex gap-2.5 py-1.5">
      <div
        className={cn(
          'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
          isNote ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary',
        )}
      >
        {typeIcon(activity.type)}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {!isNote && <span className="font-medium capitalize text-foreground/70">{activity.type.toLowerCase()}</span>}
          {when && <span>{when}</span>}
        </div>
        {activity.content && (
          <p className="whitespace-pre-wrap break-words text-[13px] leading-6 text-foreground/90">{activity.content}</p>
        )}
      </div>
    </div>
  );
}

interface LeadNotesSurfaceProps {
  leadId: number;
  notes: string;
  onNotesChange: (value: string) => void;
  saving?: boolean;
  canEdit?: boolean;
}

export function LeadNotesSurface({ leadId, notes, onNotesChange, saving, canEdit = true }: LeadNotesSurfaceProps) {
  const { useLeadActivities } = useCRM();
  const { data, isLoading, mutate } = useLeadActivities({ lead: leadId, ordering: '-happened_at', page_size: 20 });
  const [showAll, setShowAll] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const notesRef = useAutosizeTextarea(notes);

  // Live-refresh the inline feed when the AI copilot logs an activity/note.
  useCrmDataChanged((e) => {
    if (e.resource === 'activities' || e.resource === 'leads') mutate();
  });

  const activities = data?.results ?? [];
  const visible = showAll ? activities : activities.slice(0, 6);

  return (
    <div className="space-y-3">
      {/* ── Notes body (borderless, auto-grow) ── */}
      <div>
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Notes</span>
          {saving ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <Loader2 className="h-2.5 w-2.5 animate-spin" />Saving…
            </span>
          ) : notes ? (
            <span className="text-[10px] text-muted-foreground/40">Saved</span>
          ) : null}
        </div>
        <textarea
          ref={notesRef}
          value={notes}
          disabled={!canEdit}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="Write notes… type to start"
          rows={1}
          className="w-full resize-none overflow-hidden border-0 bg-transparent px-0 text-[15px] leading-7 text-foreground outline-none placeholder:text-muted-foreground/40 focus-visible:ring-0"
        />
      </div>

      {/* ── Inline activity feed (Notion blocks) ── */}
      <div className="border-t border-border/30 pt-2">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Activity</span>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Plus className="h-3 w-3" /> Add note
          </button>
        </div>

        {isLoading ? (
          <p className="py-2 text-[12px] text-muted-foreground/60">Loading activity…</p>
        ) : activities.length === 0 ? (
          <p className="py-2 text-[12px] text-muted-foreground/50">No activity yet. Add a note or log a call.</p>
        ) : (
          <div className="divide-y divide-border/20">
            {visible.map((a) => (
              <ActivityBlock key={a.id} activity={a} />
            ))}
            {activities.length > 6 && (
              <button
                type="button"
                onClick={() => setShowAll((s) => !s)}
                className="w-full py-1.5 text-left text-[11px] text-muted-foreground hover:text-foreground"
              >
                {showAll ? 'Show less' : `Show ${activities.length - 6} more`}
              </button>
            )}
          </div>
        )}
      </div>

      <ActivityFormDrawer
        open={addOpen}
        onOpenChange={setAddOpen}
        leadId={leadId}
        defaultType={ActivityTypeEnum.NOTE}
        onSuccess={() => mutate()}
      />
    </div>
  );
}

export default LeadNotesSurface;
