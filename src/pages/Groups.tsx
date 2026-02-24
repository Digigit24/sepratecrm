// src/pages/Groups.tsx
import { useState } from 'react';
import { useGroups, useGroupMutations } from '@/hooks/whatsapp/useGroups';
import type { GroupsListQuery, Group } from '@/types/whatsappTypes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Filter, Plus, Search, X, RefreshCw } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { toast } from 'sonner';

import GroupsFiltersDrawer from '@/components/GroupsFiltersDrawer';
import GroupsTable from '@/components/GroupsTable';
import GroupsFormDrawer from '@/components/GroupsFormDrawer';

export default function Groups() {
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<GroupsListQuery>({
    limit: 100,
    offset: 0,
  });
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  // Group Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit' | 'view'>('view');

  const { groups, total, isLoading, error, revalidate } = useGroups(filters);
  const { deleteGroup } = useGroupMutations();

  // Handle search
  const handleSearch = () => {
    setFilters({ ...filters, search: searchQuery, offset: 0 });
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setFilters({ ...filters, search: undefined, offset: 0 });
  };

  const handleApplyFilters = (newFilters: GroupsListQuery) => {
    setFilters(newFilters);
    setIsFiltersOpen(false);
  };

  const handleResetFilters = () => {
    const resetFilters: GroupsListQuery = {
      limit: 100,
      offset: 0,
      search: searchQuery || undefined,
    };
    setFilters(resetFilters);
    setIsFiltersOpen(false);
  };

  // Group Drawer handlers
  const handleCreateGroup = () => {
    setSelectedGroupId(null);
    setDrawerMode('create');
    setDrawerOpen(true);
  };

  const handleEditGroup = (group: Group) => {
    setSelectedGroupId(group.group_id);
    setDrawerMode('edit');
    setDrawerOpen(true);
  };

  const handleViewGroup = (group: Group) => {
    setSelectedGroupId(group.group_id);
    setDrawerMode('view');
    setDrawerOpen(true);
  };

  const handleDeleteGroup = async (group: Group) => {
    try {
      await deleteGroup(group.group_id);
      toast.success('Group deleted successfully');
      revalidate();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete group');
      throw error; // Re-throw to let DataTable handle the error state
    }
  };

  const handleDrawerSuccess = () => {
    revalidate(); // Refresh the list
  };

  const handleRefresh = () => {
    revalidate();
    toast.success('Groups refreshed');
  };

  if (isLoading && groups.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading groups...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 max-w-md">
          <h3 className="text-lg font-semibold text-destructive mb-2">Error Loading Groups</h3>
          <p className="text-sm text-destructive/80">{error.message || 'Failed to fetch group data'}</p>
          <Button 
            onClick={handleRefresh} 
            variant="outline" 
            className="mt-4 w-full"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-semibold">Groups</h1>
          <span className="text-xs text-muted-foreground">{total} total</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            onClick={handleRefresh}
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={isLoading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={handleCreateGroup} size="sm" className="h-7 text-xs">
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Group
          </Button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search groups by name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7"
              onClick={handleClearSearch}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <Sheet open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-xs">
              <Filter className="h-3.5 w-3.5" />
              {!isMobile && <span className="ml-1">Filters</span>}
            </Button>
          </SheetTrigger>
          <SheetContent
            side={isMobile ? 'bottom' : 'right'}
            className={isMobile ? 'h-[90vh]' : 'w-full sm:max-w-md'}
          >
            <GroupsFiltersDrawer
              filters={filters}
              onApplyFilters={handleApplyFilters}
              onResetFilters={handleResetFilters}
              onClose={() => setIsFiltersOpen(false)}
            />
          </SheetContent>
        </Sheet>
      </div>

      {/* Active Filter Tags */}
      {(filters.search || filters.active_only || (filters.limit && filters.limit !== 100) || (filters.offset && filters.offset > 0)) && (
        <div className="flex flex-wrap gap-2">
          {filters.search && (
            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary">
              Search: {filters.search}
            </span>
          )}
          {filters.active_only && (
            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
              Active Only
            </span>
          )}
          {filters.limit && filters.limit !== 100 && (
            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400">
              Limit: {filters.limit}
            </span>
          )}
          {filters.offset && filters.offset > 0 && (
            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400">
              Offset: {filters.offset}
            </span>
          )}
        </div>
      )}

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <GroupsTable
          groups={groups}
          isLoading={isLoading}
          onView={handleViewGroup}
          onEdit={handleEditGroup}
          onDelete={handleDeleteGroup}
          onRefresh={handleRefresh}
        />
      </div>

      {/* Group Drawer */}
      <GroupsFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        groupId={selectedGroupId}
        mode={drawerMode}
        onSuccess={handleDrawerSuccess}
        onDelete={(group_id) => {
          // Handle delete from drawer
          const group = groups.find(g => g.group_id === group_id);
          if (group) {
            handleDeleteGroup(group);
          }
        }}
        onModeChange={setDrawerMode}
      />
    </div>
  );
}