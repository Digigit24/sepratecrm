// src/components/ContactsTable.tsx
import React from 'react';
import { DataTable, type DataTableColumn, type RowActions } from '@/components/DataTable';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Phone, MessageCircle, Building2, User, Tag, Users } from 'lucide-react';
import type { Contact } from '@/types/whatsappTypes';

interface ContactsTableProps {
  contacts: Contact[];
  isLoading: boolean;
  onView?: (contact: Contact) => void;
  onEdit?: (contact: Contact) => void;
  onDelete?: (contact: Contact) => Promise<void>;
  onMessage?: (contact: Contact) => void;
  onCall?: (contact: Contact) => void;
  onAddToGroup?: (contact: Contact) => void;
  onAddLabel?: (contact: Contact) => void;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function ContactsTable({
  contacts,
  isLoading,
  onView,
  onEdit,
  onDelete,
  onMessage,
  onCall,
  onAddToGroup,
  onAddLabel,
}: ContactsTableProps) {
  // Define columns for desktop table
  const columns: DataTableColumn<Contact>[] = [
    {
      header: 'Contact',
      key: 'contact',
      cell: (contact) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={contact.profile_pic_url || undefined} />
            <AvatarFallback>
              {contact.name
                ? contact.name.charAt(0).toUpperCase()
                : contact.phone.slice(-2)
              }
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-medium text-foreground truncate">
                {contact.name || 'Unknown'}
              </p>
              {contact.is_business && (
                <Building2 className="h-4 w-4 text-blue-600" />
              )}
            </div>
            <p className="text-sm text-muted-foreground font-mono">
              {contact.phone}
            </p>
          </div>
        </div>
      ),
      className: 'min-w-[200px]',
      sortable: true,
      accessor: (contact) => contact.name || contact.phone,
    },
    {
      header: 'Labels',
      key: 'labels',
      cell: (contact) => (
        <div className="flex flex-wrap gap-1 max-w-[200px]">
          {contact.labels?.length > 0 ? (
            contact.labels.slice(0, 3).map((label) => (
              <Badge key={label} variant="secondary" className="text-xs">
                {label}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">No labels</span>
          )}
          {contact.labels && contact.labels.length > 3 && (
            <Badge variant="outline" className="text-xs">
              +{contact.labels.length - 3}
            </Badge>
          )}
        </div>
      ),
    },
    {
      header: 'Groups',
      key: 'groups',
      cell: (contact) => (
        <div className="flex flex-wrap gap-1 max-w-[200px]">
          {contact.groups?.length > 0 ? (
            contact.groups.slice(0, 2).map((group) => (
              <Badge key={group} variant="outline" className="text-xs">
                {group}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">No groups</span>
          )}
          {contact.groups && contact.groups.length > 2 && (
            <Badge variant="outline" className="text-xs">
              +{contact.groups.length - 2}
            </Badge>
          )}
        </div>
      ),
    },
    {
      header: 'Status',
      key: 'status',
      cell: (contact) => (
        <div className="space-y-1">
          <div className="text-sm">
            {contact.status || 'No status'}
          </div>
          {contact.last_seen && (
            <div className="text-xs text-muted-foreground">
              Last seen: {formatDate(contact.last_seen)}
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Created',
      key: 'created_at',
      cell: (contact) => (
        <div className="text-sm text-muted-foreground">
          {formatDate(contact.created_at)}
        </div>
      ),
      sortable: true,
      accessor: (contact) => new Date(contact.created_at).getTime(),
    },
  ];

  // Mobile card renderer
  const renderMobileCard = (contact: Contact, actions: RowActions<Contact>) => (
    <>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Avatar className="h-12 w-12 flex-shrink-0">
            <AvatarImage src={contact.profile_pic_url || undefined} />
            <AvatarFallback>
              {contact.name
                ? contact.name.charAt(0).toUpperCase()
                : contact.phone.slice(-2)
              }
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-foreground truncate">
                {contact.name || 'Unknown'}
              </h3>
              {contact.is_business && (
                <Building2 className="h-4 w-4 text-blue-600 flex-shrink-0" />
              )}
            </div>
            <p className="text-sm text-muted-foreground font-mono">
              {contact.phone}
            </p>
          </div>
        </div>
      </div>

      {/* Labels */}
      {contact.labels && contact.labels.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Labels</p>
          <div className="flex flex-wrap gap-1">
            {contact.labels.map((label) => (
              <Badge key={label} variant="secondary" className="text-xs">
                {label}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Groups */}
      {contact.groups && contact.groups.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Groups</p>
          <div className="flex flex-wrap gap-1">
            {contact.groups.map((group) => (
              <Badge key={group} variant="outline" className="text-xs">
                {group}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Status & Date */}
      <div className="flex justify-between items-center text-xs text-muted-foreground">
        <span>{contact.status || 'No status'}</span>
        <span>Created: {formatDate(contact.created_at)}</span>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t">
        {onCall && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onCall(contact)}
            className="flex-1"
          >
            <Phone className="h-4 w-4 mr-1" />
            Call
          </Button>
        )}
        {onMessage && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onMessage(contact)}
            className="flex-1"
          >
            <MessageCircle className="h-4 w-4 mr-1" />
            Message
          </Button>
        )}
        {actions.view && (
          <Button
            variant="outline"
            size="sm"
            onClick={actions.view}
            className="flex-1"
          >
            <User className="h-4 w-4 mr-1" />
            View
          </Button>
        )}
      </div>
    </>
  );

  const getExtraActions = (contact: Contact) => (
    <>
      {onMessage && (
        <DropdownMenuItem onClick={() => onMessage(contact)}>
          <MessageCircle className="mr-2 h-4 w-4" />
          Send Message
        </DropdownMenuItem>
      )}
      {onCall && (
        <DropdownMenuItem onClick={() => onCall(contact)}>
          <Phone className="mr-2 h-4 w-4" />
          Call Contact
        </DropdownMenuItem>
      )}
      {onAddLabel && (
        <DropdownMenuItem onClick={() => onAddLabel(contact)}>
          <Tag className="mr-2 h-4 w-4" />
          Add Label
        </DropdownMenuItem>
      )}
      {onAddToGroup && (
        <DropdownMenuItem onClick={() => onAddToGroup(contact)}>
          <Users className="mr-2 h-4 w-4" />
          Add to Group
        </DropdownMenuItem>
      )}
    </>
  );

  return (
    <DataTable
      rows={contacts}
      isLoading={isLoading}
      columns={columns}
      renderMobileCard={renderMobileCard}
      getRowId={(contact) => contact.id.toString()}
      getRowLabel={(contact) => contact.name || contact.phone}
      onRowClick={onView}
      onView={onView}
      onEdit={onEdit}
      onDelete={onDelete}
      extraActions={getExtraActions}
      emptyTitle="No contacts found"
      emptySubtitle="Try adjusting your search criteria or create a new contact"
    />
  );
}
