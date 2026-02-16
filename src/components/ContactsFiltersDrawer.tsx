// src/components/ContactsFiltersDrawer.tsx
import { useState, useEffect } from 'react';
import type { ContactsListQuery } from '@/types/whatsappTypes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

export default function ContactsFiltersDrawer({
  filters,
  onApplyFilters,
  onResetFilters,
  onClose,
}: ContactsFiltersDrawerProps) {
  const [localFilters, setLocalFilters] = useState<ContactsListQuery>(filters);

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
            <SheetDescription>Refine your contact search</SheetDescription>
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
              placeholder="Search by name or phone..."
              value={localFilters.search || ''}
              onChange={(e) =>
                setLocalFilters({
                  ...localFilters,
                  search: e.target.value || undefined,
                })
              }
            />
            <p className="text-xs text-muted-foreground">
              Search contacts by name or phone number
            </p>
          </div>

          <Separator />

          {/* Labels Filter */}
          <div className="space-y-2">
            <Label htmlFor="labels">Labels</Label>
            <Input
              id="labels"
              placeholder="Filter by labels (comma-separated)..."
              value={localFilters.labels || ''}
              onChange={(e) =>
                setLocalFilters({
                  ...localFilters,
                  labels: e.target.value || undefined,
                })
              }
            />
            <p className="text-xs text-muted-foreground">
              Enter comma-separated labels to filter contacts
            </p>
          </div>

          <Separator />

          {/* Groups Filter */}
          <div className="space-y-2">
            <Label htmlFor="groups">Groups</Label>
            <Input
              id="groups"
              placeholder="Filter by groups (comma-separated)..."
              value={localFilters.groups || ''}
              onChange={(e) =>
                setLocalFilters({
                  ...localFilters,
                  groups: e.target.value || undefined,
                })
              }
            />
            <p className="text-xs text-muted-foreground">
              Enter comma-separated groups to filter contacts
            </p>
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