// src/pages/CRMFieldConfigurations.tsx
import { useState, useCallback, useMemo } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { useAuth } from '@/hooks/useAuth';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { FieldConfigurationFormDrawer } from '@/components/FieldConfigurationFormDrawer';
import { SortableFieldConfigTable } from '@/components/crm/SortableFieldConfigTable';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, RefreshCw, Settings2, Eye, EyeOff, Save } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import type { LeadFieldConfiguration, LeadFieldConfigurationsQueryParams } from '@/types/crmTypes';

type DrawerMode = 'view' | 'edit' | 'create';

export const CRMFieldConfigurations: React.FC = () => {
  const { user, hasModuleAccess } = useAuth();
  const { hasCRMAccess, useFieldConfigurations, deleteFieldConfiguration, patchFieldConfiguration } = useCRM();

  const [activeTab, setActiveTab] = useState<'all' | 'standard' | 'custom'>('all');
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [pendingReorder, setPendingReorder] = useState<LeadFieldConfiguration[] | null>(null);

  // Query parameters state
  const [queryParams, setQueryParams] = useState<LeadFieldConfigurationsQueryParams>({
    page: 1,
    page_size: 100,
    ordering: 'display_order',
  });

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>('view');

  // Fetch field configurations
  const { data: configurationsData, error, isLoading, mutate } = useFieldConfigurations(queryParams);

  // Filter configurations based on active tab
  const filteredConfigurations = useMemo(() => {
    const results = configurationsData?.results || [];
    return results.filter((config) => {
      if (activeTab === 'standard') return config.is_standard;
      if (activeTab === 'custom') return !config.is_standard;
      return true;
    });
  }, [configurationsData?.results, activeTab]);

  // Check access
  if (!hasCRMAccess) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-2">CRM Access Required</h2>
              <p className="text-gray-600">
                CRM module is not enabled for your account. Please contact your administrator.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Handlers
  const handleCreateConfiguration = useCallback(() => {
    setSelectedConfigId(null);
    setDrawerMode('create');
    setDrawerOpen(true);
  }, []);

  const handleViewConfiguration = useCallback((config: LeadFieldConfiguration) => {
    setSelectedConfigId(config.id);
    setDrawerMode('view');
    setDrawerOpen(true);
  }, []);

  const handleEditConfiguration = useCallback((config: LeadFieldConfiguration) => {
    setSelectedConfigId(config.id);
    setDrawerMode('edit');
    setDrawerOpen(true);
  }, []);

  const handleDeleteConfiguration = useCallback(
    async (config: LeadFieldConfiguration) => {
      // Prevent deletion of standard fields
      if (config.is_standard) {
        toast.error('Standard fields cannot be deleted');
        return;
      }

      try {
        await deleteFieldConfiguration(config.id);
        toast.success(`Field configuration "${config.field_label}" deleted successfully`);
        mutate(); // Refresh the list
      } catch (error: any) {
        toast.error(error?.message || 'Failed to delete field configuration');
        throw error;
      }
    },
    [deleteFieldConfiguration, mutate]
  );

  const handleDrawerSuccess = useCallback(() => {
    mutate(); // Refresh the list
  }, [mutate]);

  const handleModeChange = useCallback((mode: DrawerMode) => {
    setDrawerMode(mode);
  }, []);

  const handleRefresh = useCallback(() => {
    mutate();
    setPendingReorder(null);
    toast.success('Field configurations refreshed');
  }, [mutate]);

  const handleReorder = useCallback((reorderedFields: LeadFieldConfiguration[]) => {
    setPendingReorder(reorderedFields);
  }, []);

  const handleSaveOrder = useCallback(async () => {
    if (!pendingReorder) return;

    setIsSavingOrder(true);
    try {
      // Update each field's display_order
      await Promise.all(
        pendingReorder.map((field) =>
          patchFieldConfiguration(field.id, {
            display_order: field.display_order,
            field_type: field.field_type // Required for custom fields
          })
        )
      );

      toast.success('Field order saved successfully');
      setPendingReorder(null);
      mutate(); // Refresh the list
    } catch (error: any) {
      toast.error(error?.message || 'Failed to save field order');
    } finally {
      setIsSavingOrder(false);
    }
  }, [pendingReorder, patchFieldConfiguration, mutate]);

  const handleCancelReorder = useCallback(() => {
    setPendingReorder(null);
    mutate(); // Reset to original order
  }, [mutate]);

  // Field type badge helper
  const getFieldTypeBadge = (fieldType?: string) => {
    if (!fieldType) return null;

    const colors: Record<string, string> = {
      TEXT: 'bg-blue-100 text-blue-800 border-blue-200',
      NUMBER: 'bg-green-100 text-green-800 border-green-200',
      EMAIL: 'bg-purple-100 text-purple-800 border-purple-200',
      PHONE: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      DATE: 'bg-pink-100 text-pink-800 border-pink-200',
      DATETIME: 'bg-pink-100 text-pink-800 border-pink-200',
      DROPDOWN: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      MULTISELECT: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      CHECKBOX: 'bg-cyan-100 text-cyan-800 border-cyan-200',
      URL: 'bg-orange-100 text-orange-800 border-orange-200',
      TEXTAREA: 'bg-blue-100 text-blue-800 border-blue-200',
      DECIMAL: 'bg-green-100 text-green-800 border-green-200',
      CURRENCY: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    };

    return (
      <Badge variant="outline" className={colors[fieldType] || 'bg-gray-100 text-gray-800 border-gray-200'}>
        {fieldType}
      </Badge>
    );
  };

  // Properties badge helper
  const getPropertiesBadges = (config: LeadFieldConfiguration) => (
    <div className="flex flex-wrap gap-1">
      {config.is_standard && (
        <Badge variant="default" className="bg-blue-100 text-blue-800 border-blue-200">
          Standard
        </Badge>
      )}
      {!config.is_standard && (
        <Badge variant="secondary" className="bg-purple-100 text-purple-800 border-purple-200">
          Custom
        </Badge>
      )}
      {config.is_required && (
        <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">
          Required
        </Badge>
      )}
      {!config.is_visible && (
        <Badge variant="outline" className="bg-gray-100 text-gray-800 border-gray-200">
          <EyeOff className="w-3 h-3 mr-1" />
          Hidden
        </Badge>
      )}
      {!config.is_active && (
        <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">
          Inactive
        </Badge>
      )}
    </div>
  );

  // Desktop table columns
  const columns: DataTableColumn<LeadFieldConfiguration>[] = [
    {
      header: 'Order',
      key: 'display_order',
      cell: (config) => (
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-muted-foreground">
            #{config.display_order}
          </span>
        </div>
      ),
      sortable: true,
    },
    {
      header: 'Field Name',
      key: 'field_name',
      cell: (config) => (
        <div className="flex flex-col gap-1">
          <div className="font-medium">{config.field_label}</div>
          <div className="text-sm text-muted-foreground font-mono">
            {config.field_name}
          </div>
        </div>
      ),
      sortable: true,
    },
    {
      header: 'Type',
      key: 'field_type',
      cell: (config) => getFieldTypeBadge(config.field_type),
      sortable: true,
    },
    {
      header: 'Properties',
      key: 'properties',
      cell: (config) => getPropertiesBadges(config),
    },
    {
      header: 'Updated',
      key: 'updated_at',
      cell: (config) => (
        <span className="text-sm text-muted-foreground">
          {formatDistanceToNow(new Date(config.updated_at), { addSuffix: true })}
        </span>
      ),
      sortable: true,
    },
  ];

  // Mobile card renderer
  const renderMobileCard = (config: LeadFieldConfiguration) => (
    <Card key={config.id} className="hover:shadow-md transition-shadow cursor-pointer">
      <CardContent className="p-4" onClick={() => handleViewConfiguration(config)}>
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-sm text-muted-foreground">
                  #{config.display_order}
                </span>
                <h3 className="font-semibold text-base">{config.field_label}</h3>
              </div>
              <p className="text-sm text-muted-foreground font-mono">
                {config.field_name}
              </p>
            </div>
          </div>

          {/* Field Type */}
          {config.field_type && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Type:</span>
              {getFieldTypeBadge(config.field_type)}
            </div>
          )}

          {/* Properties */}
          <div>{getPropertiesBadges(config)}</div>

          {/* Help Text */}
          {config.help_text && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {config.help_text}
            </p>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between text-sm text-muted-foreground pt-2 border-t">
            <span>
              Updated {formatDistanceToNow(new Date(config.updated_at), { addSuffix: true })}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  // Statistics
  const stats = useMemo(() => {
    const results = configurationsData?.results || [];
    return {
      total: results.length,
      standard: results.filter(c => c.is_standard).length,
      custom: results.filter(c => !c.is_standard).length,
      visible: results.filter(c => c.is_visible).length,
      required: results.filter(c => c.is_required).length,
    };
  }, [configurationsData?.results]);

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Settings2 className="w-8 h-8" />
            Field Configurations
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage lead fields and custom field configurations
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pendingReorder && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelReorder}
                disabled={isSavingOrder}
              >
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleSaveOrder}
                disabled={isSavingOrder}
              >
                {isSavingOrder ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Save Order
                  </>
                )}
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={handleCreateConfiguration}>
            <Plus className="w-4 h-4 mr-2" />
            Create Field
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-sm text-muted-foreground">Total Fields</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">{stats.standard}</div>
            <p className="text-sm text-muted-foreground">Standard Fields</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-purple-600">{stats.custom}</div>
            <p className="text-sm text-muted-foreground">Custom Fields</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-green-600">{stats.visible}</div>
            <p className="text-sm text-muted-foreground">Visible</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">{stats.required}</div>
            <p className="text-sm text-muted-foreground">Required</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="all">
            All Fields ({stats.total})
          </TabsTrigger>
          <TabsTrigger value="standard">
            Standard ({stats.standard})
          </TabsTrigger>
          <TabsTrigger value="custom">
            Custom ({stats.custom})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>All Field Configurations</CardTitle>
              <CardDescription>
                Drag and drop to reorder fields. Changes will be saved when you click "Save Order".
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SortableFieldConfigTable
                fields={pendingReorder || filteredConfigurations}
                onReorder={handleReorder}
                onView={handleViewConfiguration}
                onEdit={handleEditConfiguration}
                onDelete={handleDeleteConfiguration}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="standard" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Standard Fields</CardTitle>
              <CardDescription>
                Pre-defined Lead model fields with configurable visibility and display settings. Drag to reorder.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SortableFieldConfigTable
                fields={pendingReorder || filteredConfigurations}
                onReorder={handleReorder}
                onView={handleViewConfiguration}
                onEdit={handleEditConfiguration}
                onDelete={handleDeleteConfiguration}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="custom" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Custom Fields</CardTitle>
              <CardDescription>
                Dynamic fields stored in Lead metadata for custom data collection. Drag to reorder.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredConfigurations.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground mb-4">
                    No custom fields configured yet. Get started by creating your first custom field.
                  </p>
                  <Button onClick={handleCreateConfiguration} variant="outline">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Custom Field
                  </Button>
                </div>
              ) : (
                <SortableFieldConfigTable
                  fields={pendingReorder || filteredConfigurations}
                  onReorder={handleReorder}
                  onView={handleViewConfiguration}
                  onEdit={handleEditConfiguration}
                  onDelete={handleDeleteConfiguration}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Form Drawer */}
      <FieldConfigurationFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        configId={selectedConfigId}
        mode={drawerMode}
        onSuccess={handleDrawerSuccess}
        onDelete={(id) => {
          // Handle delete callback if needed
        }}
        onModeChange={handleModeChange}
      />
    </div>
  );
};
