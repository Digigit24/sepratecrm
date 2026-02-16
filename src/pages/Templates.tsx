// src/pages/Templates.tsx
import { useEffect, useMemo, useState } from 'react';
import { Filter, Plus, Search, X, RefreshCw, RefreshCcw, FileText, CheckCircle, Clock, XCircle } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

import { useTemplates } from '@/hooks/whatsapp/useTemplates';
import type { TemplatesListQuery, Template } from '@/types/whatsappTypes';

import { TemplatesTable } from '@/components/TemplatesTable';
import TemplatesFormDrawer from '@/components/TemplatesFormDrawer';
import { TemplatesFiltersDrawer } from '@/components/TemplatesFiltersDrawer';

export default function Templates() {
  const isMobile = useIsMobile();

  // Search and filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<TemplatesListQuery>({
    limit: 50,
    skip: 0,
  });
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit' | 'view'>('view');

  // Data hook
  const {
    templates,
    total,
    isLoading,
    error,
    fetchTemplates,
    deleteTemplate,
    refetch,
    syncAllTemplates,
    syncTemplate,
  } = useTemplates({ initialQuery: filters, autoFetch: true });

  // Keep hook data in sync with local filters when they change
  useEffect(() => {
    fetchTemplates(filters);
  }, [filters, fetchTemplates]);

  // Handlers: search
  const handleSearch = () => {
    const next: TemplatesListQuery = {
      ...filters,
      // The backend supports language/category/status; "search" is not specified in schemas,
      // But we can gracefully ignore if backend doesn't use it.
      // If your backend needs a different key, adjust here.
      // For now we keep local-only filter and rely on BE to ignore unknown param.
      // Remove below line if server rejects unknown params:
      // search: searchQuery || undefined,
      // NOTE: Server list endpoint doesn't define a search param, so we won't send it.
      skip: 0,
    };
    setFilters(next);
    fetchTemplates(next);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    const next: TemplatesListQuery = {
      ...filters,
      // search: undefined,
      skip: 0,
    };
    setFilters(next);
    fetchTemplates(next);
  };

  const handleApplyFilters = () => {
    // filters already updated by drawer via onFiltersChange
    setFilters((prev) => ({ ...prev, skip: 0 }));
    fetchTemplates({ ...filters, skip: 0 });
    setIsFiltersOpen(false);
  };

  const handleClearFilters = () => {
    const reset: TemplatesListQuery = {
      limit: 50,
      skip: 0,
    };
    setFilters(reset);
    fetchTemplates(reset);
    setIsFiltersOpen(false);
  };

  // Drawer handlers
  const handleCreateTemplate = () => {
    setSelectedTemplateId(null);
    setDrawerMode('create');
    setDrawerOpen(true);
  };

  const handleEditTemplate = (template: Template) => {
    setSelectedTemplateId(template.id);
    setDrawerMode('edit');
    setDrawerOpen(true);
  };

  const handleViewTemplate = (template: Template) => {
    setSelectedTemplateId(template.id);
    setDrawerMode('view');
    setDrawerOpen(true);
  };

  const handleDeleteTemplate = async (template: Template) => {
    try {
      await deleteTemplate(template.id);
      toast.success('Template deleted successfully');
      await refetch();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete template');
      throw err; // keep DataTable delete dialog state consistent
    }
  };

  const handleDrawerSuccess = async () => {
    await refetch();
  };

  const handleRefresh = async () => {
    await refetch();
    toast.success('Templates refreshed');
  };

  const handleSyncAll = async () => {
    try {
      const result = await syncAllTemplates();
      if (result) {
        toast.success(`Synced! Updated: ${result.updated}, Unchanged: ${result.unchanged}`);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to sync templates');
    }
  };

  const handleSyncTemplate = async (template: Template) => {
    try {
      await syncTemplate(template.id);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to sync template');
    }
  };

  const handleViewAnalytics = (template: Template) => {
    // Analytics is now a tab in the main drawer
    setSelectedTemplateId(template.id);
    setDrawerMode('view');
    setDrawerOpen(true);
  };

  const handleSendTemplate = (template: Template) => {
    // Send is now a tab in the main drawer
    setSelectedTemplateId(template.id);
    setDrawerMode('view');
    setDrawerOpen(true);
  };

  // Loading & error states (full-page)
  if (isLoading && templates.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading templates...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 max-w-md">
          <h3 className="text-lg font-semibold text-destructive mb-2">Error Loading Templates</h3>
          <p className="text-sm text-destructive/80">
            {error || 'Failed to fetch templates'}
          </p>
          <Button onClick={handleRefresh} variant="outline" className="mt-4 w-full">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Calculate stats for display
  const approvedCount = templates.filter(t => t.status === 'APPROVED').length;
  const pendingCount = templates.filter(t => t.status === 'PENDING').length;
  const rejectedCount = templates.filter(t => t.status === 'REJECTED').length;

  // Filter templates based on search query
  const filteredTemplates = searchQuery
    ? templates.filter((t) => t.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : templates;

  return (
    <div className="p-6 max-w-8xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">WhatsApp Templates</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Manage your WhatsApp message templates
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={handleSyncAll}
            variant="outline"
            size="sm"
            disabled={isLoading}
            title="Sync all templates with Meta API"
          >
            <RefreshCcw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Sync All
          </Button>
          <Button
            onClick={handleRefresh}
            variant="outline"
            size="sm"
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={handleCreateTemplate} size="default" className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Total Templates</p>
                <p className="text-xl sm:text-2xl font-bold">{total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Approved</p>
                <p className="text-xl sm:text-2xl font-bold">{approvedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Pending</p>
                <p className="text-xl sm:text-2xl font-bold">{pendingCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Rejected</p>
                <p className="text-xl sm:text-2xl font-bold">{rejectedCount}</p>
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
                placeholder="Search templates by name..."
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

            <Button
              variant="outline"
              onClick={() => setIsFiltersOpen(true)}
            >
              <Filter className="h-4 w-4" />
              {!isMobile && <span className="ml-2">Filters</span>}
            </Button>
          </div>

          {/* Active filter tags */}
          {(filters.status || filters.category || filters.language) && (
            <div className="flex flex-wrap gap-2 mt-3">
              {filters.status && (
                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary">
                  Status: {filters.status}
                </span>
              )}
              {filters.category && (
                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                  Category: {filters.category}
                </span>
              )}
              {filters.language && (
                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400">
                  Language: {filters.language}
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table Card */}
      <Card>
        <CardContent className="p-0">
          <TemplatesTable
            templates={filteredTemplates}
            isLoading={isLoading}
            onView={handleViewTemplate}
            onEdit={handleEditTemplate}
            onDelete={handleDeleteTemplate}
            onSync={handleSyncTemplate}
            onViewAnalytics={handleViewAnalytics}
            onSend={handleSendTemplate}
          />

          {!isLoading && total > 0 && (
            <div className="flex items-center justify-between px-6 py-4 border-t">
              <p className="text-sm text-muted-foreground">
                Showing {filteredTemplates.length} of {total} template(s)
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filters Drawer */}
      <TemplatesFiltersDrawer
        open={isFiltersOpen}
        onOpenChange={setIsFiltersOpen}
        filters={filters}
        onFiltersChange={setFilters}
        onApplyFilters={handleApplyFilters}
        onClearFilters={handleClearFilters}
      />

      {/* Template Drawer with Analytics and Send tabs */}
      <TemplatesFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        templateId={selectedTemplateId}
        mode={drawerMode}
        onSuccess={handleDrawerSuccess}
        onDelete={(id) => {
          const t = templates.find((x) => x.id === id);
          if (t) {
            return handleDeleteTemplate(t);
          }
        }}
        onModeChange={setDrawerMode}
      />
    </div>
  );
}

export { Templates };