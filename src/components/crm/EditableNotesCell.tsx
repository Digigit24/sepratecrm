// src/components/crm/EditableNotesCell.tsx
// DEBUG VERSION - Replace temporarily to debug
import { useState, useEffect, useRef } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, StickyNote } from 'lucide-react';

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
  debounceMs = 1000,
}) => {
  const [value, setValue] = useState(notes);
  const [isSaving, setIsSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const previousOpenRef = useRef(isOpen);

  // DEBUG
  useEffect(() => {
    console.log('EditableNotesCell rendered with notes:', notes);
  }, [notes]);

  // Update local value when notes prop changes
  useEffect(() => {
    setValue(notes);
  }, [notes]);

  // Save when tooltip closes
  useEffect(() => {
    const wasOpen = previousOpenRef.current;
    const isNowClosed = !isOpen;

    // If tooltip just closed and value changed, save after debounce
    if (wasOpen && isNowClosed && value !== notes && !disabled) {
      console.log('Saving notes on close:', value);
      setIsSaving(true);
      
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          await onSave(value);
          console.log('Notes saved successfully');
        } catch (error) {
          console.error('Failed to save notes:', error);
          // Revert on error
          setValue(notes);
        } finally {
          setIsSaving(false);
        }
      }, debounceMs);
    }

    previousOpenRef.current = isOpen;

    // Cleanup timeout on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [isOpen, value, notes, onSave, disabled, debounceMs]);

  const truncateText = (text: string, length: number = 30) => {
    if (!text) return '';
    return text.length > length ? text.substring(0, length) + '...' : text;
  };

  // DEBUG: Always show something
  console.log('Rendering EditableNotesCell, notes:', notes, 'disabled:', disabled);

  if (!notes && disabled) {
    return (
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        <StickyNote className="h-3 w-3" />
        No notes
      </span>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip open={isOpen} onOpenChange={setIsOpen}>
        <TooltipTrigger asChild>
          <div 
            className="flex items-center gap-1.5 cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2 -my-1 transition-colors"
            onClick={(e) => {
              console.log('Notes cell clicked');
              if (!disabled) {
                e.stopPropagation();
                setIsOpen(true);
              }
            }}
          >
            <StickyNote className="h-3 w-3 text-muted-foreground flex-shrink-0" />
            <span className="text-xs text-muted-foreground truncate max-w-[150px]">
              {truncateText(notes || 'Click to add notes', 25)}
            </span>
            {isSaving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          </div>
        </TooltipTrigger>
        <TooltipContent 
          className="w-80 p-0 bg-popover border shadow-lg" 
          side="bottom" 
          align="start"
          onPointerDownOutside={(e) => {
            // Don't close when clicking inside the textarea
            const target = e.target as HTMLElement;
            if (target.tagName === 'TEXTAREA') {
              e.preventDefault();
            }
          }}
        >
          <div className="p-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-foreground">Notes</label>
              <span className="text-xs text-muted-foreground">
                {value.length}/{maxLength}
              </span>
            </div>
            <Textarea
              value={value}
              onChange={(e) => {
                console.log('Textarea value changed:', e.target.value);
                if (e.target.value.length <= maxLength) {
                  setValue(e.target.value);
                }
              }}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                // Prevent row click when using keyboard
                e.stopPropagation();
                // Close on Escape
                if (e.key === 'Escape') {
                  setIsOpen(false);
                }
              }}
              placeholder="Add notes..."
              className="min-h-[100px] max-h-[200px] text-xs resize-none"
              disabled={disabled}
              autoFocus
            />
            {isSaving && (
              <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving...
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              Changes save when you close this tooltip
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};