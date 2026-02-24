// src/components/ContactsTable.tsx
import React from 'react';
import { DataTable, type DataTableColumn, type RowActions } from '@/components/DataTable';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Phone, MessageCircle, Building2, User, Tag, Users, Clock } from 'lucide-react';
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
    month: 'short',
    day: 'numeric',
    year: '2-digit',
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
  const columns: DataTableColumn<Contact>[] = [
    {
      header: 'Contact',
      key: 'contact',
      cell: (contact) => (
        <div className="flex items-center gap-2">
          <Avatar className="h-7 w-7">
            <AvatarImage src={contact.profile_pic_url || undefined} />
            <AvatarFallback className="text-[10px]">
              {contact.name
                ? contact.name.charAt(0).toUpperCase()
                : contact.phone.slice(-2)
              }
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <span className="font-medium text-xs truncate max-w-[140px]">
                {contact.name || 'Unknown'}
              </span>
              {contact.is_business && (
                <Building2 className="h-3 w-3 text-blue-600 flex-shrink-0" />
              )}
            </div>
            <p className="text-[11px] text-muted-foreground font-mono leading-none mt-0.5">
              {contact.phone}
            </p>
          </div>
        </div>
      ),
      className: 'min-w-[170px]',
      sortable: true,
      accessor: (contact) => contact.name || contact.phone,
    },
    {
      header: 'Labels',
      key: 'labels',
      cell: (contact) => (
        <div className="flex flex-wrap gap-0.5 max-w-[150px]">
          {contact.labels?.length > 0 ? (
            <>
              {contact.labels.slice(0, 2).map((label) => (
                <Badge key={label} variant="secondary" className="text-[10px] px-1.5 py-0 h-4 leading-none">
                  {label}
                </Badge>
              ))}
              {contact.labels.length > 2 && (
                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 leading-none">
                  +{contact.labels.length - 2}
                </Badge>
              )}
            </>
          ) : (
            <span className="text-[11px] text-muted-foreground">—</span>
          )}
        </div>
      ),
    },
    {
      header: 'Groups',
      key: 'groups',
      cell: (contact) => (
        <div className="flex flex-wrap gap-0.5 max-w-[150px]">
          {contact.groups?.length > 0 ? (
            <>
              {contact.groups.slice(0, 2).map((group) => (
                <Badge key={group} variant="outline" className="text-[10px] px-1.5 py-0 h-4 leading-none">
                  {group}
                </Badge>
              ))}
              {contact.groups.length > 2 && (
                <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 leading-none">
                  +{contact.groups.length - 2}
                </Badge>
              )}
            </>
          ) : (
            <span className="text-[11px] text-muted-foreground">—</span>
          )}
        </div>
      ),
    },
    {
      header: 'Status',
      key: 'status',
      cell: (contact) => (
        <div>
          <span className="text-xs">{contact.status || '—'}</span>
          {contact.last_seen && (
            <div className="flex items-center gap-1 mt-0.5">
              <Clock className="h-2.5 w-2.5 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">{formatDate(contact.last_seen)}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Created',
      key: 'created_at',
      cell: (contact) => (
        <span className="text-[11px] text-muted-foreground">
          {formatDate(contact.created_at)}
        </span>
      ),
      sortable: true,
      accessor: (contact) => new Date(contact.created_at).getTime(),
    },
  ];

  const renderMobileCard = (contact: Contact, actions: RowActions<Contact>) => (
    <>
      <div className="flex items-center gap-2">
        <Avatar className="h-9 w-9 flex-shrink-0">
          <AvatarImage src={contact.profile_pic_url || undefined} />
          <AvatarFallback className="text-xs">
            {contact.name
              ? contact.name.charAt(0).toUpperCase()
              : contact.phone.slice(-2)
            }
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <h3 className="font-medium text-sm truncate">{contact.name || 'Unknown'}</h3>
            {contact.is_business && <Building2 className="h-3 w-3 text-blue-600 flex-shrink-0" />}
          </div>
          <p className="text-xs text-muted-foreground font-mono">{contact.phone}</p>
        </div>
      </div>

      {(contact.labels?.length > 0 || contact.groups?.length > 0) && (
        <div className="flex flex-wrap gap-1">
          {contact.labels?.map((label) => (
            <Badge key={label} variant="secondary" className="text-[10px] h-4 px-1.5 py-0">
              {label}
            </Badge>
          ))}
          {contact.groups?.map((group) => (
            <Badge key={group} variant="outline" className="text-[10px] h-4 px-1.5 py-0">
              {group}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex justify-between items-center text-[11px] text-muted-foreground">
        <span>{contact.status || 'No status'}</span>
        <span>{formatDate(contact.created_at)}</span>
      </div>

      <div className="flex gap-1.5 pt-1.5 border-t">
        {onCall && (
          <Button variant="outline" size="sm" onClick={() => onCall(contact)} className="flex-1 h-7 text-xs">
            <Phone className="h-3 w-3 mr-1" />
            Call
          </Button>
        )}
        {onMessage && (
          <Button variant="outline" size="sm" onClick={() => onMessage(contact)} className="flex-1 h-7 text-xs">
            <MessageCircle className="h-3 w-3 mr-1" />
            Message
          </Button>
        )}
        {actions.view && (
          <Button variant="outline" size="sm" onClick={actions.view} className="flex-1 h-7 text-xs">
            <User className="h-3 w-3 mr-1" />
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
