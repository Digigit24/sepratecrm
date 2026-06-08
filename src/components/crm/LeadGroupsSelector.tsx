// src/components/crm/LeadGroupsSelector.tsx
// Shows a lead's current groups and lets the user add/remove them.
import { useState, useCallback } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown, X, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { LeadGroupMinimal } from '@/types/crmTypes';

interface LeadGroupsSelectorProps {
  leadId: number;
  currentGroups: LeadGroupMinimal[];
  readOnly?: boolean;
  onGroupsChanged?: () => void;
}

export function LeadGroupsSelector({
  leadId,
  currentGroups,
  readOnly = false,
  onGroupsChanged,
}: LeadGroupsSelectorProps) {
  const { useLeadGroups, addLeadsToGroup, removeLeadsFromGroup } = useCRM();
  const { data: groupsData } = useLeadGroups({ page_size: 200, ordering: 'name' });
  const allGroups = groupsData?.results || [];

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState<number | null>(null);

  const currentGroupIds = new Set(currentGroups.map(g => g.id));

  const toggleGroup = useCallback(async (groupId: number, groupName: string, isCurrentlyIn: boolean) => {
    setSaving(groupId);
    try {
      if (isCurrentlyIn) {
        await removeLeadsFromGroup(groupId, [leadId]);
        toast.success(`Removed from "${groupName}"`);
      } else {
        await addLeadsToGroup(groupId, [leadId]);
        toast.success(`Added to "${groupName}"`);
      }
      onGroupsChanged?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update group');
    } finally {
      setSaving(null);
    }
  }, [leadId, addLeadsToGroup, removeLeadsFromGroup, onGroupsChanged]);

  const handleRemoveBadge = useCallback(async (e: React.MouseEvent, group: LeadGroupMinimal) => {
    e.stopPropagation();
    await toggleGroup(group.id, group.name, true);
  }, [toggleGroup]);

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground font-normal flex items-center gap-1">
        <Layers className="w-3 h-3" />
        Groups
      </Label>

      <div className="flex flex-wrap gap-1 min-h-[28px]">
        {currentGroups.length === 0 && readOnly && (
          <span className="text-xs text-muted-foreground">No groups</span>
        )}
        {currentGroups.map(g => (
          <Badge
            key={g.id}
            variant="secondary"
            className="text-xs gap-1 pr-1"
            style={{
              backgroundColor: g.color_hex ? `${g.color_hex}22` : undefined,
              borderColor: g.color_hex || undefined,
              color: g.color_hex || undefined,
              border: '1px solid',
            }}
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: g.color_hex || '#6366F1' }}
            />
            {g.name}
            {!readOnly && (
              <button
                type="button"
                onClick={(e) => handleRemoveBadge(e, g)}
                disabled={saving === g.id}
                className="ml-0.5 hover:text-destructive"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </Badge>
        ))}

        {!readOnly && (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs px-2 gap-1"
                type="button"
              >
                <ChevronsUpDown className="w-3 h-3" />
                {currentGroups.length === 0 ? 'Add to group' : 'Manage'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-0" align="start">
              <Command>
                <CommandInput placeholder="Search groups…" className="h-8" />
                <CommandList>
                  <CommandEmpty>No groups found.</CommandEmpty>
                  <CommandGroup>
                    {allGroups.map(g => {
                      const inGroup = currentGroupIds.has(g.id);
                      return (
                        <CommandItem
                          key={g.id}
                          value={g.name}
                          onSelect={() => toggleGroup(g.id, g.name, inGroup)}
                          disabled={saving === g.id}
                          className="gap-2 cursor-pointer"
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: g.color_hex || '#6366F1' }}
                          />
                          <span className="flex-1 text-sm">{g.name}</span>
                          <Check className={cn('w-3 h-3 flex-shrink-0', inGroup ? 'opacity-100' : 'opacity-0')} />
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )}
      </div>
    </div>
  );
}
