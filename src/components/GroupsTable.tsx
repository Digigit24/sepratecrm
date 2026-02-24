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
  const columns: DataTableColumn<Group>[] = [
    {
      header: 'Group',
      key: 'group',
      cell: (group) => (
        <div className="flex items-center gap-2">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
              {group.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <span className="font-medium text-xs truncate max-w-[160px]">
                {group.name}
              </span>
              {!group.is_active && (
                <Badge variant="secondary" className="text-[10px] px-1 py-0 h-3.5">
                  Inactive
                </Badge>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground font-mono leading-none mt-0.5 truncate max-w-[160px]">
              {group.group_id}
            </p>
          </div>
        </div>
      ),
      className: 'min-w-[180px]',
    },
    {
      header: 'Members',
      key: 'participants',
      cell: (group) => (
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-xs">
            <Users className="h-3 w-3 text-muted-foreground" />
            {group.participant_count}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Crown className="h-3 w-3 text-yellow-600" />
            {group.admins.length}
          </span>
        </div>
      ),
    },
    {
      header: 'Created',
      key: 'created_by',
      cell: (group) => (
        <div>
          <span className="text-xs">{group.created_by || 'Unknown'}</span>
          <p className="text-[10px] text-muted-foreground leading-none mt-0.5">
            {new Date(group.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
          </p>
        </div>
      ),
    },
    {
      header: 'Link',
      key: 'invite_link',
      cell: (group) => (
        <Link2
          className={`h-3.5 w-3.5 ${group.group_invite_link ? 'text-green-600' : 'text-muted-foreground/40'}`}
        />
      ),
    },
    {
      header: 'Status',
      key: 'status',
      cell: (group) => (
        <Badge
          variant={group.is_active ? 'default' : 'secondary'}
          className="text-[10px] px-1.5 py-0 h-4"
        >
          {group.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
  ];

  const renderMobileCard = (group: Group, actions: RowActions<Group>) => (
    <div className="space-y-2">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Avatar className="h-9 w-9 flex-shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary text-xs">
              {group.name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="font-medium text-sm truncate">{group.name}</h3>
              <Badge
                variant={group.is_active ? 'default' : 'secondary'}
                className="text-[10px] px-1 py-0 h-4"
              >
                {group.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground font-mono">{group.group_id}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1">
          <Users className="h-3 w-3 text-muted-foreground" />
          <span className="font-medium">{group.participant_count}</span> members
        </span>
        <span className="flex items-center gap-1">
          <Crown className="h-3 w-3 text-yellow-600" />
          <span className="font-medium">{group.admins.length}</span> admin{group.admins.length !== 1 ? 's' : ''}
        </span>
        {group.group_invite_link && (
          <span className="flex items-center gap-1 text-green-600">
            <Link2 className="h-3 w-3" /> Link
          </span>
        )}
      </div>

      <div className="flex justify-between items-center text-[11px] text-muted-foreground">
        <span>By: {group.created_by || 'Unknown'}</span>
        <span className="flex items-center gap-1">
          <Calendar className="h-2.5 w-2.5" />
          {new Date(group.created_at).toLocaleDateString()}
        </span>
      </div>

      <div className="flex gap-1.5 pt-1.5 border-t">
        <Button variant="outline" size="sm" onClick={() => console.log('Open group chat:', group.group_id)} className="flex-1 h-7 text-xs">
          <MessageCircle className="h-3 w-3 mr-1" />
          Message
        </Button>
        <Button variant="outline" size="sm" onClick={() => console.log('Manage participants:', group.group_id)} className="flex-1 h-7 text-xs">
          <UserPlus className="h-3 w-3 mr-1" />
          Manage
        </Button>
        {actions.view && (
          <Button variant="outline" size="sm" onClick={actions.view} className="flex-1 h-7 text-xs">
            <Users className="h-3 w-3 mr-1" />
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
