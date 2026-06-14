// src/components/crm/EditableStatusCell.tsx
// Component for inline status updates in the leads table — with optimistic UI
import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import type { LeadStatus } from '@/types/crmTypes';

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

  if (disabled) {
    return (
      <Badge variant="outline" style={getBadgeStyle(currentStatus)}>
        {currentStatus?.name || 'No Status'}
      </Badge>
    );
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
          className="h-auto p-0 border-0 bg-transparent shadow-none focus:ring-0 min-w-[100px]"
          onClick={(e) => e.stopPropagation()}
        >
          <SelectValue>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" style={getBadgeStyle(currentStatus)}>
                {currentStatus?.name || 'No Status'}
              </Badge>
              {isSaving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent align="start" className="min-w-[180px]">
          {statuses.map((status) => {
            const isSelected = status.id === localStatusId;
            const bgColor = status.color_hex || '#6B7280';
            return (
              <SelectItem key={status.id} value={status.id.toString()} className="cursor-pointer">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full border"
                    style={{ backgroundColor: bgColor, borderColor: bgColor }}
                  />
                  <span className={isSelected ? 'font-medium' : ''}>{status.name}</span>
                  {status.is_won && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0 ml-auto">Won</Badge>
                  )}
                  {status.is_lost && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0 ml-auto text-red-500 border-red-200">Lost</Badge>
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
