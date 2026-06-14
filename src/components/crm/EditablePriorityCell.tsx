// src/components/crm/EditablePriorityCell.tsx
// Inline priority selector with optimistic UI — updates instantly like Notion
import { useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import type { PriorityEnum } from '@/types/crmTypes';

interface EditablePriorityCellProps {
  priority: PriorityEnum;
  onSave: (priority: PriorityEnum) => Promise<void>;
  disabled?: boolean;
}

const PRIORITY_CONFIG: Record<PriorityEnum, { label: string; className: string }> = {
  HIGH:   { label: 'High',   className: 'bg-red-100 text-red-800 border-red-200' },
  MEDIUM: { label: 'Medium', className: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  LOW:    { label: 'Low',    className: 'bg-gray-100 text-gray-800 border-gray-200' },
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

  if (disabled) {
    return <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>;
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
          className="h-auto p-0 border-0 bg-transparent shadow-none focus:ring-0 w-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <SelectValue>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>
              {isSaving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="start" className="min-w-[120px]">
          {(Object.keys(PRIORITY_CONFIG) as PriorityEnum[]).map((p) => (
            <SelectItem key={p} value={p} className="cursor-pointer">
              <Badge variant="outline" className={PRIORITY_CONFIG[p].className}>
                {PRIORITY_CONFIG[p].label}
              </Badge>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default EditablePriorityCell;
