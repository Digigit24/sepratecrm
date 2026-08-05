// src/components/crm/EditableStatusCell.tsx
// Component for inline status updates in the leads table — with optimistic UI
import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import type { LeadStatus } from '@/types/crmTypes';
import { cn } from '@/lib/utils';

interface EditableStatusCellProps {
  currentStatusId?: number;
  statuses: LeadStatus[];
  onSave: (newStatusId: number) => Promise<void>;
  disabled?: boolean;
}

export const EditableStatusCell: React.FC<EditableStatusCellProps> = ({
  currentStatusId,
  statuses,
  onSave,
  disabled = false,
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  // Optimistic local state — updates immediately on selection, reverts on error
  const [localStatusId, setLocalStatusId] = useState<number | undefined>(currentStatusId);

  // Sync from prop when NOT mid-save (handles external SWR revalidation)
  useEffect(() => {
    if (!isSaving) {
      setLocalStatusId(currentStatusId);
    }
  }, [currentStatusId]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentStatus = statuses.find((s) => s.id === localStatusId);

  const handleStatusChange = async (newStatusId: string) => {
    const statusId = parseInt(newStatusId, 10);
    if (statusId === localStatusId || isNaN(statusId)) {
      setIsOpen(false);
      return;
    }

    const previousId = localStatusId;
    // Optimistic: update display immediately, close dropdown
    setLocalStatusId(statusId);
    setIsOpen(false);
    setIsSaving(true);
    try {
      await onSave(statusId);
    } catch (error) {
      // Revert on failure
      setLocalStatusId(previousId);
      console.error('Failed to update status:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const getBadgeStyle = (status?: LeadStatus) => {
    if (!status) {
      return { backgroundColor: '#6B728020', borderColor: '#6B7280', color: '#6B7280' };
    }
    const bgColor = status.color_hex || '#6B7280';
    return { backgroundColor: `${bgColor}20`, borderColor: bgColor, color: bgColor };
  };

  const statusColor = currentStatus?.color_hex || '#6B7280';

  const statusPill = (
    <span
      className="inline-flex max-w-[150px] items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium leading-5"
      style={getBadgeStyle(currentStatus)}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: statusColor }}
      />
      <span className="truncate">{currentStatus?.name || 'No status'}</span>
    </span>
  );

  if (disabled) {
    return statusPill;
  }

  return (
    <div onClick={(e) => e.stopPropagation()} className="relative">
      <Select
        value={localStatusId?.toString() || ''}
        onValueChange={handleStatusChange}
        disabled={isSaving}
        open={isOpen}
        onOpenChange={setIsOpen}
      >
        <SelectTrigger
          className={cn(
            'group/status h-8 w-auto min-w-[126px] justify-between gap-1 rounded-lg border border-transparent bg-transparent px-1.5 py-1 shadow-none transition-all duration-150',
            'hover:border-border/60 hover:bg-muted/70 focus:ring-1 focus:ring-ring/30 focus:ring-offset-0',
            'data-[state=open]:border-border/70 data-[state=open]:bg-background data-[state=open]:shadow-sm',
            '[&>svg]:ml-0.5 [&>svg]:h-3.5 [&>svg]:w-3.5 [&>svg]:shrink-0 [&>svg]:opacity-0 [&>svg]:transition-all [&>svg]:duration-150',
            'hover:[&>svg]:opacity-60 data-[state=open]:[&>svg]:rotate-180 data-[state=open]:[&>svg]:opacity-70',
            isSaving && '[&>svg]:hidden',
          )}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Change status from ${currentStatus?.name || 'No status'}`}
        >
          <div className="flex min-w-0 items-center gap-1.5">
            {statusPill}
            {isSaving && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />}
          </div>
        </SelectTrigger>
        <SelectContent
          align="start"
          sideOffset={6}
          className="min-w-[220px] rounded-xl border-border/70 bg-popover/95 shadow-xl backdrop-blur-md"
        >
          {statuses.map((status) => {
            const isSelected = status.id === localStatusId;
            const bgColor = status.color_hex || '#6B7280';
            return (
              <SelectItem
                key={status.id}
                value={status.id.toString()}
                className="h-9 cursor-pointer rounded-lg pr-2 focus:bg-accent/80 data-[state=checked]:bg-accent/60"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <div
                    className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-background"
                    style={{ backgroundColor: bgColor, borderColor: bgColor }}
                  />
                  <span className={cn('truncate', isSelected && 'font-medium')}>{status.name}</span>
                  {status.is_won && (
                    <Badge variant="outline" className="ml-auto h-5 rounded-md px-1.5 text-[10px] font-medium">Won</Badge>
                  )}
                  {status.is_lost && (
                    <Badge variant="outline" className="ml-auto h-5 rounded-md border-red-200 px-1.5 text-[10px] font-medium text-red-500">Lost</Badge>
                  )}
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
};

export default EditableStatusCell;
