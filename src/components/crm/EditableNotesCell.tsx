// src/components/crm/EditableNotesCell.tsx
import { useState, useEffect, useRef } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';

interface EditableNotesCellProps {
  notes?: string;
  onSave: (notes: string) => Promise<void>;
  disabled?: boolean;
  maxLength?: number;
  debounceMs?: number;
}

export const EditableNotesCell: React.FC<EditableNotesCellProps> = ({
  notes = '',
  onSave,
  disabled = false,
  maxLength = 2000,
  debounceMs = 800,
}) => {
  const [value, setValue] = useState(notes);
  const [isSaving, setIsSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  // Optimistic display: tracks the last successfully committed value
  const [displayValue, setDisplayValue] = useState(notes);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const previousOpenRef = useRef(isOpen);

  // Sync from external prop only when not mid-save
  useEffect(() => {
    if (!isSaving) {
      setValue(notes);
      setDisplayValue(notes);
    }
  }, [notes]); // eslint-disable-line react-hooks/exhaustive-deps

  // Save when tooltip closes (if value changed)
  useEffect(() => {
    const wasOpen = previousOpenRef.current;
    const isNowClosed = !isOpen;

    if (wasOpen && isNowClosed && value !== displayValue && !disabled) {
      const pendingValue = value;
      // Optimistic: update display immediately
      setDisplayValue(pendingValue);
      setIsSaving(true);

      saveTimeoutRef.current = setTimeout(async () => {
        try {
          await onSave(pendingValue);
        } catch (error) {
          console.error('Failed to save notes:', error);
          // Revert display on error
          setDisplayValue(notes);
          setValue(notes);
        } finally {
          setIsSaving(false);
        }
      }, 0);
    }

    previousOpenRef.current = isOpen;

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const truncateText = (text: string, length: number = 30) => {
    if (!text) return '';
    return text.length > length ? text.substring(0, length) + '...' : text;
  };

  if (!notes && disabled) {
    return <span className="text-xs text-muted-foreground">-</span>;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip open={isOpen} onOpenChange={setIsOpen}>
        <TooltipTrigger asChild>
          <div
            className="cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 -mx-1 transition-colors flex items-center gap-1"
            onClick={(e) => {
              if (!disabled) {
                e.stopPropagation();
                setIsOpen(true);
              }
            }}
          >
            {/* Show displayValue (optimistic) so it updates instantly after closing */}
            <span className="text-sm text-muted-foreground truncate max-w-[160px]">
              {truncateText(displayValue || 'Add notes', 30)}
            </span>
            {isSaving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          </div>
        </TooltipTrigger>
        <TooltipContent
          className="w-72 p-0 bg-popover border shadow-lg"
          side="bottom"
          align="start"
          onPointerDownOutside={(e) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'TEXTAREA') e.preventDefault();
          }}
        >
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-foreground">Notes</label>
              <span className="text-xs text-muted-foreground">{value.length}/{maxLength}</span>
            </div>
            <Textarea
              value={value}
              onChange={(e) => {
                if (e.target.value.length <= maxLength) setValue(e.target.value);
              }}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Escape') setIsOpen(false);
              }}
              placeholder="Add notes..."
              className="min-h-[80px] max-h-[160px] text-xs resize-none"
              disabled={disabled}
              autoFocus
            />
            {isSaving && (
              <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving...
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2">Changes save when you close this tooltip</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
