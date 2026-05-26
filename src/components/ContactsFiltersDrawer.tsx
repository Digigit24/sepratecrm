// src/components/ContactsFiltersDrawer.tsx
import { useState, useEffect } from 'react';
import type { ContactsListQuery } from '@/types/whatsappTypes';
import { useLabels, useContactGroups } from '@/hooks/whatsapp/useContacts';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { X } from 'lucide-react';

interface ContactsFiltersDrawerProps {
  filters: ContactsListQuery;
  onApplyFilters: (filters: ContactsListQuery) => void;
  onResetFilters: () => void;
  onClose: () => void;
}

function uidsToSet(csv?: string): Set<string> {
  if (!csv) return new Set();
  return new Set(csv.split(',').map((s) => s.trim()).filter(Boolean));
}

function setToUids(set: Set<string>): string | undefined {
  return set.size > 0 ? [...set].join(',') : undefined;
}

export default function ContactsFiltersDrawer({
  filters,
  onApplyFilters,
  onResetFilters,
  onClose,
}: ContactsFiltersDrawerProps) {
  const { labels, isLoading: labelsLoading } = useLabels();
  const { groups, isLoading: groupsLoading } = useContactGroups();

  const [selectedLabels, setSelectedLabels] = useState<Set<string>>(uidsToSet(filters.labels));
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(uidsToSet(filters.groups));
  const [limit, setLimit] = useState<number>(filters.limit ?? 100);

  useEffect(() => {
    setSelectedLabels(uidsToSet(filters.labels));
    setSelectedGroups(uidsToSet(filters.groups));
    setLimit(filters.limit ?? 100);
  }, [filters]);

  const toggleLabel = (uid: string) => {
    setSelectedLabels((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const toggleGroup = (uid: string) => {
    setSelectedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const handleApply = () => {
    onApplyFilters({
      ...filters,
      labels: setToUids(selectedLabels),
      groups: setToUids(selectedGroups),
      limit,
      offset: 0,
    });
  };

  const handleReset = () => {
    onResetFilters();
  };

  const activeCount = selectedLabels.size + selectedGroups.size;

  return (
    <div className="flex flex-col h-full">
      <SheetHeader className="px-6 py-4 border-b">
        <div className="flex items-center justify-between">
          <div>
            <SheetTitle>
              Filters
              {activeCount > 0 && (
                <span className="ml-2 text-xs font-normal bg-primary text-primary-foreground rounded-full px-2 py-0.5">
                  {activeCount}
                </span>
              )}
            </SheetTitle>
            <SheetDescription>Refine your contact list</SheetDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </SheetHeader>

      <ScrollArea className="flex-1 px-6 py-4">
        <div className="space-y-6">

          {/* Labels */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Labels
              {selectedLabels.size > 0 && (
                <span className="ml-1 text-xs text-muted-foreground">({selectedLabels.size} selected)</span>
              )}
            </Label>
            {labelsLoading ? (
              <p className="text-xs text-muted-foreground">Loading labels...</p>
            ) : labels.length === 0 ? (
              <p className="text-xs text-muted-foreground">No labels found</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {labels.map((label) => (
                  <div key={label._uid} className="flex items-center gap-2">
                    <Checkbox
                      id={`label-${label._uid}`}
                      checked={selectedLabels.has(label._uid)}
                      onCheckedChange={() => toggleLabel(label._uid)}
                    />
                    <label
                      htmlFor={`label-${label._uid}`}
                      className="text-sm cursor-pointer flex items-center gap-1.5"
                    >
                      {label.bg_color && (
                        <span
                          className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: label.bg_color }}
                        />
                      )}
                      {label.title}
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Groups */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Groups
              {selectedGroups.size > 0 && (
                <span className="ml-1 text-xs text-muted-foreground">({selectedGroups.size} selected)</span>
              )}
            </Label>
            {groupsLoading ? (
              <p className="text-xs text-muted-foreground">Loading groups...</p>
            ) : groups.length === 0 ? (
              <p className="text-xs text-muted-foreground">No groups found</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {groups.map((group) => (
                  <div key={group._uid} className="flex items-center gap-2">
                    <Checkbox
                      id={`group-${group._uid}`}
                      checked={selectedGroups.has(group._uid)}
                      onCheckedChange={() => toggleGroup(group._uid)}
                    />
                    <label
                      htmlFor={`group-${group._uid}`}
                      className="text-sm cursor-pointer"
                    >
                      {group.title}
                      {group.contacts_count !== undefined && group.contacts_count > 0 && (
                        <span className="ml-1 text-xs text-muted-foreground">({group.contacts_count})</span>
                      )}
                    </label>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* Limit */}
          <div className="space-y-2">
            <Label htmlFor="limit" className="text-sm font-medium">Results per page</Label>
            <Select
              value={limit.toString()}
              onValueChange={(value) => setLimit(parseInt(value))}
            >
              <SelectTrigger id="limit">
                <SelectValue placeholder="Select limit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25 contacts</SelectItem>
                <SelectItem value="50">50 contacts</SelectItem>
                <SelectItem value="100">100 contacts</SelectItem>
                <SelectItem value="200">200 contacts</SelectItem>
                <SelectItem value="500">500 contacts</SelectItem>
              </SelectContent>
            </Select>
          </div>

        </div>
      </ScrollArea>

      <SheetFooter className="px-6 py-4 border-t bg-background">
        <div className="flex gap-2 w-full">
          <Button variant="outline" onClick={handleReset} className="flex-1">
            Reset
          </Button>
          <Button onClick={handleApply} className="flex-1">
            Apply Filters
          </Button>
        </div>
      </SheetFooter>
    </div>
  );
}
