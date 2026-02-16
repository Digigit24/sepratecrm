// src/pages/Contacts.tsx
import { useState } from 'react';
import { useContacts, useContactMutations } from '@/hooks/whatsapp/useContacts';
import type { ContactsListQuery, Contact } from '@/types/whatsappTypes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Filter, Plus, Search, X, RefreshCw, Upload, Users, UserCheck, Building2, Tag } from 'lucide-react';
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

  // Calculate stats
  const businessCount = contacts.filter(c => c.is_business).length;
  const labeledCount = contacts.filter(c => c.labels && c.labels.length > 0).length;

  return (
    <div className="p-6 max-w-8xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">WhatsApp Contacts</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Manage your WhatsApp contacts
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={handleRefresh}
            variant="outline"
            size="sm"
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={() => setIsImportDialogOpen(true)}
            variant="outline"
            size="sm"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button onClick={handleCreateContact} size="default" className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Add Contact
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Total Contacts</p>
                <p className="text-xl sm:text-2xl font-bold">{total}</p>
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
                <p className="text-xs sm:text-sm text-muted-foreground">In View</p>
                <p className="text-xl sm:text-2xl font-bold">{contacts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Building2 className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Business</p>
                <p className="text-xl sm:text-2xl font-bold">{businessCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Tag className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Labeled</p>
                <p className="text-xl sm:text-2xl font-bold">{labeledCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Filters Card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2">
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
                <Button variant="outline">
                  <Filter className="h-4 w-4" />
                  {!isMobile && <span className="ml-2">Filters</span>}
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
            <div className="flex flex-wrap gap-2 mt-3">
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
        </CardContent>
      </Card>

      {/* Table Card */}
      <Card>
        <CardContent className="p-0">
          <ContactsTable
            contacts={contacts}
            isLoading={isLoading}
            onView={handleViewContact}
            onEdit={handleEditContact}
            onDelete={handleDeleteContact}
          />

          {!isLoading && total > 0 && (
            <div className="flex items-center justify-between px-6 py-4 border-t">
              <p className="text-sm text-muted-foreground">
                Showing {contacts.length} of {total} contact{total !== 1 ? 's' : ''}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

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