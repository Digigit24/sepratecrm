// src/components/crm/EditableNotesCell.tsx
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface EditableNotesCellProps {
  /** May be null — the API models `notes` as a nullable TextField. */
  notes?: string | null;
  onSave: (notes: string) => Promise<void>;
  disabled?: boolean;
  maxLength?: number;
  /** @deprecated kept for API compatibility — saving is now commit-on-close, not debounced */
  debounceMs?: number;
}

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const MIN_H = 76;
const MAX_H = 260;

export const EditableNotesCell: React.FC<EditableNotesCellProps> = ({
  notes: notesProp,
  onSave,
  disabled = false,
  maxLength = 2000,
}) => {
  // The default-parameter trick only covers `undefined`; the API sends an
  // explicit `null` for an unset note, so normalise once and use `notes` below.
  const notes = notesProp ?? '';

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(notes);
  /** Optimistic value shown in the cell — updates the instant the editor closes. */
  const [committed, setCommitted] = useState(notes);
  const [state, setState] = useState<SaveState>('idle');

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inFlightRef = useRef(0);
  const cancelRef = useRef(false);
  const latestNotesRef = useRef(notes);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout>>();
  /**
   * What we last wrote locally. Any incoming prop that disagrees with this is a
   * stale read (list GET that raced the PATCH, replica lag, a page refetched
   * from before the write) and is ignored rather than blanking the cell. Bounded
   * by `until` so we can never be permanently out of sync with the server.
   */
  const localWriteRef = useRef<{ value: string; until: number } | null>(null);

  latestNotesRef.current = notes;

  // Accept server truth only when we're not editing, nothing is in flight, and
  // the incoming value isn't a known-stale read. This is what stops a
  // background revalidation from eating keystrokes or wiping a saved note.
  useEffect(() => {
    if (open || inFlightRef.current > 0) return;

    const local = localWriteRef.current;
    if (local) {
      if (notes === local.value || Date.now() > local.until) {
        localWriteRef.current = null; // server caught up (or we gave up waiting)
      } else {
        return; // stale — keep showing what the user actually saved
      }
    }

    setCommitted(notes);
    setDraft(notes);
  }, [notes, open]);

  useEffect(() => () => clearTimeout(savedTimerRef.current), []);

  const autoGrow = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(Math.max(el.scrollHeight, MIN_H), MAX_H)}px`;
  }, []);

  useLayoutEffect(() => {
    if (open) autoGrow();
  }, [open, draft, autoGrow]);

  const commit = useCallback(
    async (next: string) => {
      const trimmed = next.replace(/\s+$/, '');
      if (trimmed === committed) return;

      // Optimistic: the cell shows the new text immediately, no spinner gate.
      // The network call runs entirely in the background from here.
      setCommitted(trimmed);
      setState('saving');
      inFlightRef.current += 1;
      localWriteRef.current = { value: trimmed, until: Date.now() + 30_000 };
      try {
        await onSave(trimmed);
        setState('saved');
        // Re-arm the window from save time so a slow list refetch that lands
        // after this can't roll the cell back.
        localWriteRef.current = { value: trimmed, until: Date.now() + 30_000 };
        clearTimeout(savedTimerRef.current);
        savedTimerRef.current = setTimeout(() => setState('idle'), 1400);
      } catch {
        // Roll back to whatever the server last told us.
        localWriteRef.current = null;
        setCommitted(latestNotesRef.current);
        setDraft(latestNotesRef.current);
        setState('error');
        clearTimeout(savedTimerRef.current);
        savedTimerRef.current = setTimeout(() => setState('idle'), 2200);
      } finally {
        inFlightRef.current -= 1;
      }
    },
    [committed, onSave]
  );

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (disabled) return;
      if (next) {
        cancelRef.current = false;
        setDraft(committed);
        setOpen(true);
        return;
      }
      setOpen(false);
      if (cancelRef.current) {
        cancelRef.current = false;
        setDraft(committed);
        return;
      }
      void commit(draft);
    },
    [commit, committed, disabled, draft]
  );

  const isEmpty = !committed;

  if (isEmpty && disabled) {
    return <span className="text-sm text-muted-foreground/60">—</span>;
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'group/notes -mx-1.5 flex w-full max-w-[220px] items-center gap-1.5 rounded-md px-1.5 py-1 text-left',
            'transition-colors duration-150 outline-none',
            'hover:bg-foreground/[0.045] focus-visible:bg-foreground/[0.045]',
            'focus-visible:ring-1 focus-visible:ring-ring/40',
            open && 'bg-foreground/[0.06]',
            disabled && 'pointer-events-none opacity-60'
          )}
        >
          <span
            className={cn(
              'truncate text-sm leading-5',
              isEmpty
                ? 'text-muted-foreground/70 opacity-40 transition-opacity duration-150 group-hover/notes:opacity-100 group-focus-visible/notes:opacity-100'
                : 'text-foreground/80'
            )}
          >
            {isEmpty ? 'Add note' : committed.replace(/\s+/g, ' ')}
          </span>

          {state === 'saving' && (
            <span className="ml-auto h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-muted-foreground/50" />
          )}
          {state === 'saved' && (
            <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500/70 transition-opacity duration-300" />
          )}
          {state === 'error' && (
            <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-destructive/80" />
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={6}
        collisionPadding={12}
        className={cn(
          'w-[340px] overflow-hidden rounded-xl border border-border/60 p-0',
          'bg-popover shadow-[0_10px_38px_-10px_rgba(22,23,24,0.28),0_6px_14px_-6px_rgba(22,23,24,0.14)]'
        )}
        onClick={(e) => e.stopPropagation()}
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          const el = textareaRef.current;
          if (!el) return;
          el.focus();
          el.setSelectionRange(el.value.length, el.value.length);
          autoGrow();
        }}
      >
        <textarea
          ref={textareaRef}
          value={draft}
          rows={1}
          spellCheck
          placeholder="Write a note…"
          onChange={(e) => {
            const v = e.target.value;
            setDraft(v.length > maxLength ? v.slice(0, maxLength) : v);
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Escape') {
              e.preventDefault();
              cancelRef.current = true;
              setOpen(false);
              setDraft(committed);
              return;
            }
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              setOpen(false);
              void commit(draft);
            }
          }}
          style={{ minHeight: MIN_H, maxHeight: MAX_H }}
          className={cn(
            'w-full resize-none border-0 bg-transparent px-3.5 pb-2 pt-3 text-sm leading-6',
            'text-foreground placeholder:text-muted-foreground/50',
            'outline-none ring-0 focus:outline-none focus:ring-0',
            'overflow-y-auto [scrollbar-width:thin]'
          )}
        />

        <div className="flex items-center justify-between gap-3 px-3.5 pb-2.5 pt-0.5">
          <span className="select-none text-[11px] leading-none text-muted-foreground/55">
            <kbd className="font-sans font-medium">Esc</kbd> to discard ·{' '}
            <kbd className="font-sans font-medium">⌘↵</kbd> to save
          </span>
          {draft.length > maxLength * 0.8 && (
            <span
              className={cn(
                'tabular-nums text-[11px] leading-none',
                draft.length >= maxLength ? 'text-destructive/80' : 'text-muted-foreground/55'
              )}
            >
              {draft.length}/{maxLength}
            </span>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
