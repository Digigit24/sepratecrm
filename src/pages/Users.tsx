// src/pages/Users.tsx
import React, { useState } from 'react';
import { useUser } from '@/hooks/useUser';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DataTable, DataTableColumn } from '@/components/DataTable';
import UsersFormDrawer from '@/components/UsersFormDrawer';
import {
  Loader2,
  Plus,
  Search,
  Users as UsersIcon,
  UserCheck,
  UserX,
  Shield
} from 'lucide-react';
import { UserListParams, User } from '@/types/user.types';

export const Users: React.FC = () => {
  const { user: currentUser } = useAuth();
  const {
    useUsers,
    deleteUser,
  } = useUser();

  // State for search and filters
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<boolean | ''>('');
  const [currentPage, setCurrentPage] = useState(1);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [drawerMode, setDrawerMode] = useState<'view' | 'edit' | 'create'>('view');

  // Build query params
  const queryParams: UserListParams = {
    page: currentPage,
    search: searchTerm || undefined,
    is_active: activeFilter === '' ? undefined : activeFilter,
  };

  // Fetch users
  const {
    data: usersData,
    error: usersError,
    isLoading: usersLoading,
    mutate: mutateUsers
  } = useUsers(queryParams);

  const users = usersData?.results || [];
  const totalCount = usersData?.count || 0;
  const hasNext = !!usersData?.next;
  const hasPrevious = !!usersData?.previous;

  // Handlers
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); // Reset to first page
  };

  const handleActiveFilter = (active: boolean | '') => {
    setActiveFilter(active);
    setCurrentPage(1);
  };

  const handleView = (user: User) => {
    setSelectedUserId(user.id);
    setDrawerMode('view');
    setDrawerOpen(true);
  };

  const handleEdit = (user: User) => {
    setSelectedUserId(user.id);
    setDrawerMode('edit');
    setDrawerOpen(true);
  };

  const handleCreate = () => {
    setSelectedUserId(null);
    setDrawerMode('create');
    setDrawerOpen(true);
  };

  const handleDelete = async (user: User) => {
    try {
      await deleteUser(user.id);
      mutateUsers();
    } catch (error: any) {
      console.error('Delete failed:', error);
    }
  };

  const handleDrawerSuccess = () => {
    mutateUsers();
  };

  const handleDrawerDelete = () => {
    mutateUsers();
  };

  // DataTable columns configuration
  const columns: DataTableColumn<User>[] = [
    {
      header: 'User',
      key: 'name',
      cell: (user) => (
        <div className="flex flex-col">
          <span className="font-medium">{user.first_name} {user.last_name}</span>
          <span className="text-sm text-muted-foreground">{user.email}</span>
        </div>
      ),
    },
    {
      header: 'Phone',
      key: 'phone',
      cell: (user) => (
        <span className="text-sm">{user.phone || 'N/A'}</span>
      ),
    },
    {
      header: 'Roles',
      key: 'roles',
      cell: (user) => (
        <div className="flex flex-wrap gap-1">
          {(user.roles || []).slice(0, 2).map((role) => (
            <Badge key={role.id} variant="secondary" className="text-xs">
              {role.name}
            </Badge>
          ))}
          {(user.roles || []).length > 2 && (
            <Badge variant="outline" className="text-xs">
              +{(user.roles || []).length - 2}
            </Badge>
          )}
          {user.is_super_admin && (
            <Badge variant="default" className="text-xs bg-purple-600">
              Super Admin
            </Badge>
          )}
        </div>
      ),
    },
    {
      header: 'Timezone',
      key: 'timezone',
      cell: (user) => (
        <span className="text-sm">{user.timezone || 'N/A'}</span>
      ),
    },
    {
      header: 'Status',
      key: 'status',
      cell: (user) => {
        return (
          <Badge variant="default" className={user.is_active ? 'bg-green-600' : 'bg-gray-600'}>
            {user.is_active ? 'Active' : 'Inactive'}
          </Badge>
        );
      },
    },
  ];

  // Mobile card renderer
  const renderMobileCard = (user: User, actions: any) => {
    return (
      <>
        {/* Header Row */}
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base truncate">
              {user.first_name} {user.last_name}
            </h3>
            <p className="text-sm text-muted-foreground truncate">{user.email}</p>
          </div>
          <Badge
            variant="default"
            className={user.is_active ? 'bg-green-600' : 'bg-gray-600'}
          >
            {user.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </div>

        {/* Phone */}
        {user.phone && (
          <div className="text-sm text-muted-foreground">
            Phone: {user.phone}
          </div>
        )}

        {/* Roles */}
        <div className="flex flex-wrap gap-1">
          {(user.roles || []).map((role) => (
            <Badge key={role.id} variant="secondary" className="text-xs">
              {role.name}
            </Badge>
          ))}
          {user.is_super_admin && (
            <Badge variant="default" className="text-xs bg-purple-600">
              Super Admin
            </Badge>
          )}
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Timezone</p>
            <p className="font-medium">{user.timezone || 'N/A'}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Tenant</p>
            <p className="font-medium">{user.tenant_name || 'N/A'}</p>
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
          <h1 className="text-2xl sm:text-3xl font-bold">Users</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Manage user accounts
          </p>
        </div>
        <Button onClick={handleCreate} size="default" className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <UsersIcon className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Total Users</p>
                <p className="text-xl sm:text-2xl font-bold">{totalCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <UserCheck className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Active</p>
                <p className="text-xl sm:text-2xl font-bold">
                  {users.filter((u) => u.is_active).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <UserX className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Inactive</p>
                <p className="text-xl sm:text-2xl font-bold">
                  {users.filter((u) => !u.is_active).length}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Shield className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Admins</p>
                <p className="text-xl sm:text-2xl font-bold">
                  {users.filter((u) => u.is_super_admin).length}
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
                placeholder="Search users by name, email..."
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

      {/* Users Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Users List</CardTitle>
            {usersLoading && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {usersError ? (
            <div className="p-8 text-center">
              <p className="text-destructive">{usersError.message}</p>
            </div>
          ) : (
            <>
              <DataTable
                rows={users}
                isLoading={usersLoading}
                columns={columns}
                renderMobileCard={renderMobileCard}
                getRowId={(user) => user.id}
                getRowLabel={(user) => `${user.first_name} ${user.last_name}`}
                onView={handleView}
                onEdit={handleEdit}
                onDelete={handleDelete}
                emptyTitle="No users found"
                emptySubtitle="Try adjusting your search or filters, or add a new user"
              />

              {/* Pagination */}
              {!usersLoading && users.length > 0 && (
                <div className="flex items-center justify-between px-6 py-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Showing {users.length} of {totalCount} user(s)
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
      <UsersFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        userId={selectedUserId}
        mode={drawerMode}
        onSuccess={handleDrawerSuccess}
        onDelete={handleDrawerDelete}
        onModeChange={(newMode) => setDrawerMode(newMode)}
      />
    </div>
  );
};
