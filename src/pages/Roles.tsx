// src/pages/Roles.tsx
import React, { useState } from 'react';
import { useRoles } from '@/hooks/useRoles';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DataTable, DataTableColumn } from '@/components/DataTable';
import RolesFormDrawer from '@/components/RolesFormDrawer';
import {
  Loader2,
  Plus,
  Search,
  Shield,
  ShieldCheck,
  ShieldX,
  Users
} from 'lucide-react';
import { RoleListParams, Role } from '@/types/user.types';

export const Roles: React.FC = () => {
  const { user: currentUser } = useAuth();
  const {
    useRolesList,
    deleteRole,
  } = useRoles();

  // State for search and filters
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<boolean | ''>('');
  const [currentPage, setCurrentPage] = useState(1);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [drawerMode, setDrawerMode] = useState<'view' | 'edit' | 'create'>('view');

  // Build query params
  const queryParams: RoleListParams = {
    page: currentPage,
    search: searchTerm || undefined,
    is_active: activeFilter === '' ? undefined : activeFilter,
  };

  // Fetch roles
  const {
    data: rolesData,
    error: rolesError,
    isLoading: rolesLoading,
    mutate: mutateRoles
  } = useRolesList(queryParams);

  const roles = rolesData?.results || [];
  const totalCount = rolesData?.count || 0;
  const hasNext = !!rolesData?.next;
  const hasPrevious = !!rolesData?.previous;

  // Handlers
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); // Reset to first page
  };

  const handleActiveFilter = (active: boolean | '') => {
    setActiveFilter(active);
    setCurrentPage(1);
  };

  const handleView = (role: Role) => {
    setSelectedRoleId(role.id);
    setDrawerMode('view');
    setDrawerOpen(true);
  };

  const handleEdit = (role: Role) => {
    setSelectedRoleId(role.id);
    setDrawerMode('edit');
    setDrawerOpen(true);
  };

  const handleCreate = () => {
    setSelectedRoleId(null);
    setDrawerMode('create');
    setDrawerOpen(true);
  };

  const handleDelete = async (role: Role) => {
    try {
      await deleteRole(role.id);
      mutateRoles();
    } catch (error: any) {
      console.error('Delete failed:', error);
    }
  };

  const handleDrawerSuccess = () => {
    mutateRoles();
  };

  const handleDrawerDelete = () => {
    mutateRoles();
  };

  // DataTable columns configuration
  const columns: DataTableColumn<Role>[] = [
    {
      header: 'Role',
      key: 'name',
      cell: (role) => (
        <div className="flex flex-col">
          <span className="font-medium">{role.name}</span>
          <span className="text-sm text-muted-foreground line-clamp-1">
            {role.description || 'No description'}
          </span>
        </div>
      ),
    },
    {
      header: 'Members',
      key: 'members',
      cell: (role) => (
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{role.member_count || 0}</span>
        </div>
      ),
    },
    {
      header: 'Created By',
      key: 'created_by',
      cell: (role) => (
        <span className="text-sm">{role.created_by_email || 'N/A'}</span>
      ),
    },
    {
      header: 'Status',
      key: 'status',
      cell: (role) => {
        return (
          <Badge variant="default" className={role.is_active ? 'bg-green-600' : 'bg-gray-600'}>
            {role.is_active ? 'Active' : 'Inactive'}
          </Badge>
        );
      },
    },
  ];

  // Mobile card renderer
  const renderMobileCard = (role: Role, actions: any) => {
    return (
      <>
        {/* Header Row */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base truncate flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              {role.name}
            </h3>
            <p className="text-sm text-muted-foreground line-clamp-2">
              {role.description || 'No description'}
            </p>
          </div>
          <Badge
            variant="default"
            className={role.is_active ? 'bg-green-600' : 'bg-gray-600'}
          >
            {role.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Members</p>
            <p className="font-medium flex items-center gap-1">
              <Users className="h-3 w-3" />
              {role.member_count || 0}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Created By</p>
            <p className="font-medium truncate">{role.created_by_email || 'N/A'}</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          {actions.view && (
            <Button size="sm" variant="outline" onClick={actions.view} className="flex-1">
              View
            </Button>
          )}
          {actions.edit && (
            <Button size="sm" variant="outline" onClick={actions.edit} className="flex-1">
              Edit
            </Button>
          )}
          {actions.askDelete && (
            <Button size="sm" variant="destructive" onClick={actions.askDelete}>
              Delete
            </Button>
          )}
        </div>
      </>
    );
  };

  return (
    <div className="p-6 max-w-8xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Roles</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Manage roles and permissions
          </p>
        </div>
        <Button onClick={handleCreate} size="default" className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Add Role
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Shield className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Total Roles</p>
                <p className="text-xl sm:text-2xl font-bold">{totalCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <ShieldCheck className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Active</p>
                <p className="text-xl sm:text-2xl font-bold">
                  {roles.filter((r) => r.is_active).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <ShieldX className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Inactive</p>
                <p className="text-xl sm:text-2xl font-bold">
                  {roles.filter((r) => !r.is_active).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters & Search */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search roles by name, description..."
                value={searchTerm}
                onChange={handleSearch}
                className="pl-10"
              />
            </div>

            {/* Status Filter */}
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={activeFilter === '' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleActiveFilter('')}
              >
                All
              </Button>
              <Button
                variant={activeFilter === true ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleActiveFilter(true)}
              >
                Active
              </Button>
              <Button
                variant={activeFilter === false ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleActiveFilter(false)}
              >
                Inactive
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Roles Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Roles List</CardTitle>
            {rolesLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {rolesError ? (
            <div className="p-8 text-center">
              <p className="text-destructive">{rolesError.message}</p>
            </div>
          ) : (
            <>
              <DataTable
                rows={roles}
                isLoading={rolesLoading}
                columns={columns}
                renderMobileCard={renderMobileCard}
                getRowId={(role) => role.id}
                getRowLabel={(role) => role.name}
                onView={handleView}
                onEdit={handleEdit}
                onDelete={handleDelete}
                emptyTitle="No roles found"
                emptySubtitle="Try adjusting your search or filters, or add a new role"
              />

              {/* Pagination */}
              {!rolesLoading && roles.length > 0 && (
                <div className="flex items-center justify-between px-6 py-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Showing {roles.length} of {totalCount} role(s)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!hasPrevious}
                      onClick={() => setCurrentPage((p) => p - 1)}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!hasNext}
                      onClick={() => setCurrentPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Drawer */}
      <RolesFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        roleId={selectedRoleId}
        mode={drawerMode}
        onSuccess={handleDrawerSuccess}
        onDelete={handleDrawerDelete}
        onModeChange={(newMode) => setDrawerMode(newMode)}
      />
    </div>
  );
};
