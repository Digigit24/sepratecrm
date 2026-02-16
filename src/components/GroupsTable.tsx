// src/components/GroupsTable.tsx
import { DataTable, type DataTableColumn, type RowActions } from '@/components/DataTable';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Users, MessageCircle, Crown, UserPlus, Link2, Calendar } from 'lucide-react';
import type { Group } from '@/types/whatsappTypes';

interface GroupsTableProps {
  groups: Group[];
  isLoading: boolean;
  onView: (group: Group) => void;
  onEdit: (group: Group) => void;
  onDelete: (group: Group) => Promise<void>;
  onRefresh: () => void;
}

export default function GroupsTable({
  groups,
  isLoading,
  onView,
  onEdit,
  onDelete,
  onRefresh,
}: GroupsTableProps) {
  // Define columns for desktop table
  const columns: DataTableColumn<Group>[] = [
    {
      header: 'Group',
      key: 'group',
      cell: (group) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary/10 text-primary">
              {group.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-medium text-foreground truncate">
                {group.name}
              </p>
              {!group.is_active && (
                <Badge variant="secondary" className="text-xs">
                  Inactive
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground font-mono">
              ID: {group.group_id}
            </p>
            {group.description && (
              <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                {group.description}
              </p>
            )}
          </div>
        </div>
      ),
      className: 'min-w-[250px]',
    },
    {
      header: 'Participants',
      key: 'participants',
      cell: (group) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{group.participant_count}</span>
            <span className="text-sm text-muted-foreground">members</span>
          </div>
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4 text-yellow-600" />
            <span className="text-sm text-muted-foreground">
              {group.admins.length} admin{group.admins.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      ),
    },
    {
      header: 'Created By',
      key: 'created_by',
      cell: (group) => (
        <div className="space-y-1">
          <div className="text-sm">
            {group.created_by || 'Unknown'}
          </div>
          <div className="text-xs text-muted-foreground">
            {new Date(group.created_at).toLocaleDateString()}
          </div>
        </div>
      ),
    },
    {
      header: 'Invite Link',
      key: 'invite_link',
      cell: (group) => (
        <div className="flex items-center gap-2">
          {group.group_invite_link ? (
            <>
              <Link2 className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-600">Available</span>
            </>
          ) : (
            <>
              <Link2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">None</span>
            </>
          )}
        </div>
      ),
    },
    {
      header: 'Status',
      key: 'status',
      cell: (group) => (
        <div className="space-y-1">
          <Badge 
            variant={group.is_active ? 'default' : 'secondary'}
            className="text-xs"
          >
            {group.is_active ? 'Active' : 'Inactive'}
          </Badge>
          <div className="text-xs text-muted-foreground">
            Updated: {new Date(group.updated_at).toLocaleDateString()}
          </div>
        </div>
      ),
    },
  ];

  // Mobile card renderer
  const renderMobileCard = (group: Group, actions: RowActions<Group>) => (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Avatar className="h-12 w-12 flex-shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary">
              {group.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium text-foreground truncate">
                {group.name}
              </h3>
              <Badge 
                variant={group.is_active ? 'default' : 'secondary'}
                className="text-xs"
              >
                {group.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground font-mono">
              ID: {group.group_id}
            </p>
            {group.description && (
              <p className="text-xs text-muted-foreground mt-1">
                {group.description}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{group.participant_count}</span>
          <span className="text-muted-foreground">members</span>
        </div>
        <div className="flex items-center gap-2">
          <Crown className="h-4 w-4 text-yellow-600" />
          <span className="font-medium">{group.admins.length}</span>
          <span className="text-muted-foreground">admin{group.admins.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Invite Link */}
      {group.group_invite_link && (
        <div className="flex items-center gap-2 text-sm">
          <Link2 className="h-4 w-4 text-green-600" />
          <span className="text-green-600">Invite link available</span>
        </div>
      )}

      {/* Created Info */}
      <div className="flex justify-between items-center text-xs text-muted-foreground">
        <span>Created by: {group.created_by || 'Unknown'}</span>
        <span>
          <Calendar className="h-3 w-3 inline mr-1" />
          {new Date(group.created_at).toLocaleDateString()}
        </span>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            // Navigate to group chat
            console.log('Open group chat:', group.group_id);
          }}
          className="flex-1"
        >
          <MessageCircle className="h-4 w-4 mr-1" />
          Message
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            // Manage participants
            console.log('Manage participants:', group.group_id);
          }}
          className="flex-1"
        >
          <UserPlus className="h-4 w-4 mr-1" />
          Manage
        </Button>
        {actions.view && (
          <Button
            variant="outline"
            size="sm"
            onClick={actions.view}
            className="flex-1"
          >
            <Users className="h-4 w-4 mr-1" />
            View
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <DataTable
      rows={groups}
      isLoading={isLoading}
      columns={columns}
      renderMobileCard={renderMobileCard}
      getRowId={(group) => group.group_id}
      getRowLabel={(group) => group.name}
      onView={onView}
      onEdit={onEdit}
      onDelete={onDelete}
      emptyTitle="No groups found"
      emptySubtitle="Try adjusting your search criteria or create a new group"
    />
  );
}