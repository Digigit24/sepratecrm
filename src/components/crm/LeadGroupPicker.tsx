// src/components/crm/LeadGroupPicker.tsx
// Notion-like inline group selector with create support
import { useState, useRef, useEffect, useCallback } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Check, Plus, Search, X, Loader2, Hash, ChevronRight } from 'lucide-react';
import type { LeadGroupMinimal } from '@/types/crmTypes';

// ── Preset colour swatches (Notion-style) ──────────────────────────
const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#3b82f6', '#64748b',
];

interface LeadGroupPickerProps {
  leadId: number;
  currentGroups: LeadGroupMinimal[];
  onGroupsChanged?: () => void;
  readOnly?: boolean;
}

export function LeadGroupPicker({
  leadId,
  currentGroups,
  onGroupsChanged,
  readOnly = false,
}: LeadGroupPickerProps) {
  const { useLeadGroups, addLeadsToGroup, removeLeadsFromGroup, createLeadGroup } = useCRM();
  const { data: groupsData, mutate: mutateGroups } = useLeadGroups({ page_size: 200, ordering: 'name' });
  const allGroups = groupsData?.results || [];

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [creating, setCreating] = useState(false);

  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const newNameRef = useRef<HTMLInputElement>(null);

  const currentGroupIds = new Set(currentGroups.map(g => g.id));

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowCreate(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Focus input when open
  useEffect(() => {
    if (open && !showCreate) setTimeout(() => inputRef.current?.focus(), 50);
    if (showCreate) setTimeout(() => newNameRef.current?.focus(), 50);
  }, [open, showCreate]);

  const filtered = query
    ? allGroups.filter(g => g.name.toLowerCase().includes(query.toLowerCase()))
    : allGroups;

  const toggleGroup = useCallback(async (groupId: number, name: string, inGroup: boolean) => {
    setSaving(groupId);
    try {
      if (inGroup) {
        await removeLeadsFromGroup(groupId, [leadId]);
        toast.success(`Removed from "${name}"`);
      } else {
        await addLeadsToGroup(groupId, [leadId]);
        toast.success(`Added to "${name}"`);
      }
      onGroupsChanged?.();
    } catch {
      toast.error('Failed to update group');
    } finally {
      setSaving(null);
    }
  }, [leadId, addLeadsToGroup, removeLeadsFromGroup, onGroupsChanged]);

  const handleCreate = useCallback(async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const created = await createLeadGroup({ name, color_hex: newColor });
      await mutateGroups();
      await addLeadsToGroup(created.id, [leadId]);
      toast.success(`Created & added to "${name}"`);
      onGroupsChanged?.();
      setNewName('');
      setNewColor(PRESET_COLORS[0]);
      setShowCreate(false);
    } catch {
      toast.error('Failed to create group');
    } finally {
      setCreating(false);
    }
  }, [newName, newColor, createLeadGroup, mutateGroups, addLeadsToGroup, leadId, onGroupsChanged]);

  const removeGroup = useCallback(async (e: React.MouseEvent, group: LeadGroupMinimal) => {
    e.stopPropagation();
    await toggleGroup(group.id, group.name, true);
  }, [toggleGroup]);

  return (
    <div className="flex flex-wrap items-center gap-1.5 relative">
      {/* Current group pills */}
      {currentGroups.map(g => (
        <span
          key={g.id}
          className="inline-flex items-center gap-1 pl-1.5 pr-1 py-0.5 rounded-full text-[11px] font-medium leading-none select-none"
          style={{
            backgroundColor: g.color_hex ? `${g.color_hex}18` : '#f1f5f9',
            color: g.color_hex || '#475569',
            border: `1px solid ${g.color_hex ? `${g.color_hex}40` : '#e2e8f0'}`,
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: g.color_hex || '#6366f1' }}
          />
          {g.name}
          {!readOnly && (
            <button
              type="button"
              onClick={(e) => removeGroup(e, g)}
              disabled={saving === g.id}
              className="ml-0.5 rounded-full p-0.5 hover:bg-black/10 transition-colors"
            >
              {saving === g.id
                ? <Loader2 className="w-2.5 h-2.5 animate-spin" />
                : <X className="w-2.5 h-2.5" />
              }
            </button>
          )}
        </span>
      ))}

      {/* Add group trigger */}
      {!readOnly && (
        <div className="relative" ref={popoverRef}>
          <button
            type="button"
            onClick={() => { setOpen(o => !o); setShowCreate(false); setQuery(''); }}
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium leading-none transition-all',
              'border border-dashed border-border text-muted-foreground',
              'hover:border-primary/50 hover:text-primary hover:bg-primary/5',
              open && 'border-primary/50 text-primary bg-primary/5',
            )}
          >
            <Plus className="w-3 h-3" />
            {currentGroups.length === 0 ? 'Add group' : ''}
          </button>

          {/* Popover panel */}
          {open && (
            <div className={cn(
              'absolute top-full left-0 mt-1.5 z-50 w-60',
              'bg-popover border border-border rounded-xl shadow-xl overflow-hidden',
              'animate-in fade-in-0 zoom-in-95 slide-in-from-top-1 duration-100',
            )}>
              {showCreate ? (
                /* ─ Create new group form ─ */
                <div className="p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCreate(false)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                    </button>
                    <span className="text-xs font-medium text-foreground">New group</span>
                  </div>

                  <input
                    ref={newNameRef}
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowCreate(false); }}
                    placeholder="Group name…"
                    className="w-full text-sm bg-muted/40 rounded-lg px-3 py-1.5 outline-none border border-border focus:border-primary/50 focus:bg-background transition-colors placeholder:text-muted-foreground"
                  />

                  {/* Colour swatches */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">Colour</span>
                    <div className="flex flex-wrap gap-1.5">
                      {PRESET_COLORS.map(c => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setNewColor(c)}
                          className={cn(
                            'w-5 h-5 rounded-full transition-transform hover:scale-110 ring-offset-background',
                            newColor === c && 'ring-2 ring-offset-1 ring-foreground/30',
                          )}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={!newName.trim() || creating}
                    className={cn(
                      'w-full h-8 rounded-lg text-xs font-medium transition-all',
                      'bg-primary text-primary-foreground hover:bg-primary/90',
                      'disabled:opacity-50 disabled:cursor-not-allowed',
                      'flex items-center justify-center gap-1.5',
                    )}
                  >
                    {creating
                      ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating…</>
                      : <><Plus className="w-3.5 h-3.5" /> Create group</>
                    }
                  </button>
                </div>
              ) : (
                /* ─ Search & select panel ─ */
                <>
                  {/* Search input */}
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                    <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <input
                      ref={inputRef}
                      type="text"
                      value={query}
                      onChange={e => setQuery(e.target.value)}
                      onKeyDown={e => e.key === 'Escape' && setOpen(false)}
                      placeholder="Search groups…"
                      className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
                    />
                    {query && (
                      <button type="button" onClick={() => setQuery('')} className="text-muted-foreground hover:text-foreground">
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Group list */}
                  <div className="max-h-52 overflow-y-auto py-1">
                    {filtered.length === 0 ? (
                      <div className="px-3 py-4 text-center">
                        <Hash className="w-5 h-5 text-muted-foreground/40 mx-auto mb-1.5" />
                        <p className="text-xs text-muted-foreground">No groups found</p>
                      </div>
                    ) : (
                      filtered.map(g => {
                        const inGroup = currentGroupIds.has(g.id);
                        return (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => toggleGroup(g.id, g.name, inGroup)}
                            disabled={saving === g.id}
                            className={cn(
                              'w-full flex items-center gap-2.5 px-3 py-1.5 text-left',
                              'hover:bg-muted/60 transition-colors text-sm',
                              inGroup && 'text-foreground font-medium',
                            )}
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: g.color_hex || '#6366f1' }}
                            />
                            <span className="flex-1 truncate text-[13px]">{g.name}</span>
                            {saving === g.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground flex-shrink-0" />
                              : inGroup
                                ? <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                                : null
                            }
                          </button>
                        );
                      })
                    )}
                  </div>

                  {/* Create new group button */}
                  <div className="border-t border-border p-1">
                    <button
                      type="button"
                      onClick={() => { setShowCreate(true); setNewName(query); }}
                      className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {query ? `Create "${query}"` : 'Create new group'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
