// src/components/crm/EditablePriorityCell.tsx
// Inline priority selector with optimistic UI — updates instantly like Notion
import { useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import type { PriorityEnum } from '@/types/crmTypes';
import { cn } from '@/lib/utils';

interface EditablePriorityCellProps {
  priority: PriorityEnum;
  onSave: (priority: PriorityEnum) => Promise<void>;
  disabled?: boolean;
}

const PRIORITY_CONFIG: Record<PriorityEnum, { label: string; className: string; dotClassName: string }> = {
  HIGH:   { label: 'High',   className: 'bg-red-100/80 text-red-800 dark:bg-red-950/50 dark:text-red-300', dotClassName: 'bg-red-500' },
  MEDIUM: { label: 'Medium', className: 'bg-amber-100/80 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300', dotClassName: 'bg-amber-500' },
  LOW:    { label: 'Low',    className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300', dotClassName: 'bg-slate-400' },
};

const FALLBACK: PriorityEnum = 'MEDIUM';

export const EditablePriorityCell: React.FC<EditablePriorityCellProps> = ({
  priority,
  onSave,
  disabled = false,
}) => {
  const safePriority: PriorityEnum = PRIORITY_CONFIG[priority] ? priority : FALLBACK;
  const [localPriority, setLocalPriority] = useState<PriorityEnum>(safePriority);
  const [isSaving, setIsSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  // Sync from prop when not mid-save (guard against invalid values)
  useEffect(() => {
    if (!isSaving) {
      setLocalPriority(PRIORITY_CONFIG[priority] ? priority : FALLBACK);
    }
  }, [priority]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleChange = async (newPriority: string) => {
    const p = newPriority as PriorityEnum;
    if (p === localPriority) { setIsOpen(false); return; }

    const previous = localPriority;
    // Optimistic: update immediately
    setLocalPriority(p);
    setIsOpen(false);
    setIsSaving(true);
    try {
      await onSave(p);
    } catch {
      setLocalPriority(previous);
    } finally {
      setIsSaving(false);
    }
  };

  const cfg = PRIORITY_CONFIG[localPriority] ?? PRIORITY_CONFIG[FALLBACK];

  const priorityPill = (
    <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium leading-5', cfg.className)}>
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', cfg.dotClassName)} />
      {cfg.label}
    </span>
  );

  if (disabled) {
    return priorityPill;
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Select
        value={localPriority}
        onValueChange={handleChange}
        disabled={isSaving}
        open={isOpen}
        onOpenChange={setIsOpen}
      >
        <SelectTrigger
          className={cn(
            'group/priority h-8 w-auto min-w-[104px] justify-between gap-1 rounded-lg border border-transparent bg-transparent px-1.5 py-1 shadow-none transition-all duration-150',
            'hover:border-border/60 hover:bg-muted/70 focus:ring-1 focus:ring-ring/30 focus:ring-offset-0',
            'data-[state=open]:border-border/70 data-[state=open]:bg-background data-[state=open]:shadow-sm',
            '[&>svg]:ml-0.5 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:shrink-0 [&>svg]:opacity-0 [&>svg]:transition-all [&>svg]:duration-150',
            'hover:[&>svg]:opacity-60 data-[state=open]:[&>svg]:rotate-180 data-[state=open]:[&>svg]:opacity-70',
            isSaving && '[&>svg]:hidden',
          )}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Change priority from ${cfg.label}`}
        >
          <div className="flex min-w-0 items-center gap-1.5">
            {priorityPill}
            {isSaving && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />}
          </div>
        </SelectTrigger>
        <SelectContent
          align="start"
          sideOffset={6}
          className="min-w-[156px] rounded-xl border-border/70 bg-popover/95 shadow-xl backdrop-blur-md"
        >
          {(Object.keys(PRIORITY_CONFIG) as PriorityEnum[]).map((p) => (
            <SelectItem
              key={p}
              value={p}
              className="h-9 cursor-pointer rounded-lg pr-2 focus:bg-accent/80 data-[state=checked]:bg-accent/60"
            >
              <span className={cn('inline-flex items-center gap-2 rounded-md px-2 py-0.5 text-xs font-medium leading-5', PRIORITY_CONFIG[p].className)}>
                <span className={cn('h-1.5 w-1.5 rounded-full', PRIORITY_CONFIG[p].dotClassName)} />
                {PRIORITY_CONFIG[p].label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default EditablePriorityCell;
