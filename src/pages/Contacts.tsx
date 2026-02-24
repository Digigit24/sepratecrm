// src/pages/Contacts.tsx
import { useState } from 'react';
import { useContacts, useContactMutations } from '@/hooks/whatsapp/useContacts';
import type { ContactsListQuery, Contact } from '@/types/whatsappTypes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Filter, Plus, Search, X, RefreshCw, Upload } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { toast } from 'sonner';

import ContactsFiltersDrawer from '@/components/ContactsFiltersDrawer';
import ContactsTable from '@/components/ContactsTable';
import ContactsFormDrawer from '@/components/ContactsFormDrawer';
import ContactsImportDialog from '@/components/ContactsImportDialog';

export default function Contacts() {
  const isMobile = useIsMobile();
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<ContactsListQuery>({
    limit: 100,
    offset: 0,
  });
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);

  // Contact Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedContactPhone, setSelectedContactPhone] = useState<string | null>(null);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit' | 'view'>('view');

  const { contacts, total, isLoading, error, revalidate } = useContacts(filters);
  const { deleteContact } = useContactMutations();

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

  const handleApplyFilters = (newFilters: ContactsListQuery) => {
    setFilters(newFilters);
    setIsFiltersOpen(false);
  };

  const handleResetFilters = () => {
    const resetFilters: ContactsListQuery = {
      limit: 100,
      offset: 0,
      search: searchQuery || undefined,
    };
    setFilters(resetFilters);
    setIsFiltersOpen(false);
  };

  // Contact Drawer handlers
  const handleCreateContact = () => {
    setSelectedContactPhone(null);
    setDrawerMode('create');
    setDrawerOpen(true);
  };

  const handleEditContact = (contact: Contact) => {
    setSelectedContactPhone(contact.phone);
    setDrawerMode('edit');
    setDrawerOpen(true);
  };

  const handleViewContact = (contact: Contact) => {
    setSelectedContactPhone(contact.phone);
    setDrawerMode('view');
    setDrawerOpen(true);
  };

  const handleDeleteContact = async (contact: Contact) => {
    try {
      await deleteContact(contact.phone);
      toast.success('Contact deleted successfully');
      revalidate();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete contact');
      throw error; // Re-throw to let DataTable handle the error state
    }
  };

  const handleDrawerSuccess = () => {
    revalidate(); // Refresh the list
  };

  const handleRefresh = () => {
    revalidate();
    toast.success('Contacts refreshed');
  };

  const handleImportSuccess = () => {
    revalidate();
  };

  if (isLoading && contacts.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading contacts...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 max-w-md">
          <h3 className="text-lg font-semibold text-destructive mb-2">Error Loading Contacts</h3>
          <p className="text-sm text-destructive/80">{error.message || 'Failed to fetch contact data'}</p>
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
          <h1 className="text-base font-semibold">Contacts</h1>
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
          <Button
            onClick={() => setIsImportDialogOpen(true)}
            variant="outline"
            size="sm"
            className="h-7 text-xs"
          >
            <Upload className="h-3.5 w-3.5 mr-1" />
            Import
          </Button>
          <Button onClick={handleCreateContact} size="sm" className="h-7 text-xs">
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Contact
          </Button>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search contacts by name or phone..."
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
            <ContactsFiltersDrawer
              filters={filters}
              onApplyFilters={handleApplyFilters}
              onResetFilters={handleResetFilters}
              onClose={() => setIsFiltersOpen(false)}
            />
          </SheetContent>
        </Sheet>
      </div>

      {/* Active Filter Tags */}
      {(filters.search || filters.labels || filters.groups) && (
        <div className="flex flex-wrap gap-2">
          {filters.search && (
            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary">
              Search: {filters.search}
            </span>
          )}
          {filters.labels && (
            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
              Labels: {filters.labels}
            </span>
          )}
          {filters.groups && (
            <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
              Groups: {filters.groups}
            </span>
          )}
        </div>
      )}

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <ContactsTable
          contacts={contacts}
          isLoading={isLoading}
          onView={handleViewContact}
          onEdit={handleEditContact}
          onDelete={handleDeleteContact}
        />

        {!isLoading && total > 0 && (
          <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/30">
            <p className="text-xs text-muted-foreground">
              {contacts.length} of {total}
            </p>
          </div>
        )}
      </div>

      {/* Contact Drawer */}
      <ContactsFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        contactPhone={selectedContactPhone}
        mode={drawerMode}
        onSuccess={handleDrawerSuccess}
        onDelete={(phone) => {
          // Handle delete from drawer
          const contact = contacts.find(c => c.phone === phone);
          if (contact) {
            handleDeleteContact(contact);
          }
        }}
        onModeChange={setDrawerMode}
      />

      {/* Import Dialog */}
      <ContactsImportDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        onSuccess={handleImportSuccess}
      />
    </div>
  );
}