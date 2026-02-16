// src/components/GroupsFiltersDrawer.tsx
import { useState, useEffect } from 'react';
import type { GroupsListQuery } from '@/types/whatsappTypes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { X } from 'lucide-react';

interface GroupsFiltersDrawerProps {
  filters: GroupsListQuery;
  onApplyFilters: (filters: GroupsListQuery) => void;
  onResetFilters: () => void;
  onClose: () => void;
}

export default function GroupsFiltersDrawer({
  filters,
  onApplyFilters,
  onResetFilters,
  onClose,
}: GroupsFiltersDrawerProps) {
  const [localFilters, setLocalFilters] = useState<GroupsListQuery>(filters);

  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const handleApply = () => {
    onApplyFilters(localFilters);
  };

  const handleReset = () => {
    onResetFilters();
  };

  return (
    <div className="flex flex-col h-full">
      <SheetHeader className="px-6 py-4 border-b">
        <div className="flex items-center justify-between">
          <div>
            <SheetTitle>Filters</SheetTitle>
            <SheetDescription>Refine your group search</SheetDescription>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </SheetHeader>

      <ScrollArea className="flex-1 px-6 py-4">
        <div className="space-y-6">
          {/* Search Filter */}
          <div className="space-y-2">
            <Label htmlFor="search">Search</Label>
            <Input
              id="search"
              placeholder="Search by group name..."
              value={localFilters.search || ''}
              onChange={(e) =>
                setLocalFilters({
                  ...localFilters,
                  search: e.target.value || undefined,
                })
              }
            />
            <p className="text-xs text-muted-foreground">
              Search groups by name or description
            </p>
          </div>

          <Separator />

          {/* Active Only Filter */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="active-only">Active Groups Only</Label>
                <p className="text-xs text-muted-foreground">
                  Show only active groups
                </p>
              </div>
              <Switch
                id="active-only"
                checked={localFilters.active_only || false}
                onCheckedChange={(checked) =>
                  setLocalFilters({
                    ...localFilters,
                    active_only: checked || undefined,
                  })
                }
              />
            </div>
          </div>

          <Separator />

          {/* Limit Filter */}
          <div className="space-y-2">
            <Label htmlFor="limit">Results Limit</Label>
            <Select
              value={localFilters.limit?.toString() || '100'}
              onValueChange={(value) =>
                setLocalFilters({
                  ...localFilters,
                  limit: parseInt(value),
                })
              }
            >
              <SelectTrigger id="limit">
                <SelectValue placeholder="Select limit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25 groups</SelectItem>
                <SelectItem value="50">50 groups</SelectItem>
                <SelectItem value="100">100 groups</SelectItem>
                <SelectItem value="200">200 groups</SelectItem>
                <SelectItem value="500">500 groups</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Maximum number of groups to display
            </p>
          </div>

          <Separator />

          {/* Offset Filter */}
          <div className="space-y-2">
            <Label htmlFor="offset">Offset</Label>
            <Input
              id="offset"
              type="number"
              min="0"
              placeholder="0"
              value={localFilters.offset?.toString() || ''}
              onChange={(e) =>
                setLocalFilters({
                  ...localFilters,
                  offset: e.target.value ? parseInt(e.target.value) : undefined,
                })
              }
            />
            <p className="text-xs text-muted-foreground">
              Number of groups to skip (for pagination)
            </p>
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