// src/pages/CRMFieldConfigurations.tsx
import { useState, useCallback, useMemo } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { FieldConfigurationFormDrawer } from '@/components/FieldConfigurationFormDrawer';
import { SortableFieldConfigTable } from '@/components/crm/SortableFieldConfigTable';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, RefreshCw, Save, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { useSWRConfig } from 'swr';
import type { LeadFieldConfiguration, LeadFieldConfigurationsQueryParams } from '@/types/crmTypes';

type DrawerMode = 'view' | 'edit' | 'create';

export const CRMFieldConfigurations: React.FC = () => {
  const { mutate: mutateAll } = useSWRConfig();
  const {
    hasCRMAccess,
    useFieldConfigurations,
    deleteFieldConfiguration,
    updateFieldConfigurationLayout,
  } = useCRM();

  const [activeTab, setActiveTab] = useState<'all' | 'standard' | 'custom'>('all');
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [layoutDraft, setLayoutDraft] = useState<LeadFieldConfiguration[] | null>(null);

  // Query parameters state
  const [queryParams] = useState<LeadFieldConfigurationsQueryParams>({
    page: 1,
    page_size: 500,
    ordering: 'display_order',
  });

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedConfigId, setSelectedConfigId] = useState<number | null>(null);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>('view');

  // Fetch field configurations
  const { data: configurationsData, mutate } = useFieldConfigurations(queryParams);

  const allConfigurations = useMemo(
    () => layoutDraft || configurationsData?.results || [],
    [layoutDraft, configurationsData?.results],
  );

  // Filter configurations based on active tab
  const filteredConfigurations = useMemo(() => {
    return allConfigurations.filter((config) => {
      if (activeTab === 'standard') return config.is_standard;
      if (activeTab === 'custom') return !config.is_standard;
      return true;
    });
  }, [allConfigurations, activeTab]);

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
        setLayoutDraft(null);
        mutate(); // Refresh the list
      } catch (error: unknown) {
        toast.error(error instanceof Error ? error.message : 'Failed to delete field configuration');
        throw error;
      }
    },
    [deleteFieldConfiguration, mutate]
  );

  const handleDrawerSuccess = useCallback(() => {
    setLayoutDraft(null);
    mutate(); // Refresh the list
  }, [mutate]);

  const handleModeChange = useCallback((mode: DrawerMode) => {
    setDrawerMode(mode);
  }, []);

  const handleRefresh = useCallback(() => {
    mutate();
    setLayoutDraft(null);
    toast.success('Field configurations refreshed');
  }, [mutate]);

  const handleReorder = useCallback((reorderedFields: LeadFieldConfiguration[]) => {
    const movedIds = new Set(reorderedFields.map((field) => field.id));

    setLayoutDraft((currentDraft) => {
      let movedIndex = 0;
      const currentFields = currentDraft || configurationsData?.results || [];
      const mergedFields = currentFields.map((field) =>
        movedIds.has(field.id) ? reorderedFields[movedIndex++] : field
      );
      return mergedFields.map((field, index) => ({ ...field, display_order: index + 1 }));
    });
  }, [configurationsData?.results]);

  const handleVisibilityChange = useCallback((field: LeadFieldConfiguration, isVisible: boolean) => {
    setLayoutDraft((currentDraft) => {
      const currentFields = currentDraft || configurationsData?.results || [];
      return currentFields.map((item) =>
        item.id === field.id ? { ...item, is_visible: isVisible } : item
      );
    });
  }, [configurationsData?.results]);

  const handleSaveOrder = useCallback(async () => {
    if (!layoutDraft) return;

    setIsSavingOrder(true);
    try {
      const savedFields = await updateFieldConfigurationLayout({
        fields: layoutDraft.map((field) => ({
          id: field.id,
          is_visible: field.is_visible,
        })),
      });

      if (configurationsData) {
        await mutate({
          ...configurationsData,
          count: savedFields.length,
          next: null,
          previous: null,
          results: savedFields,
        }, false);
      } else {
        await mutate();
      }
      toast.success('Field layout saved. The leads list now uses this column order.');
      setLayoutDraft(null);
      void mutateAll(
        (key) => Array.isArray(key) && key[0] === 'field-configurations',
      );
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to save field layout');
    } finally {
      setIsSavingOrder(false);
    }
  }, [layoutDraft, updateFieldConfigurationLayout, configurationsData, mutate, mutateAll]);

  const handleCancelReorder = useCallback(() => {
    setLayoutDraft(null);
  }, []);

  // Statistics
  const stats = useMemo(() => {
    const results = allConfigurations;
    return {
      total: results.length,
      standard: results.filter(c => c.is_standard).length,
      custom: results.filter(c => !c.is_standard).length,
    };
  }, [allConfigurations]);

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

  return (
    <div className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-semibold">Field Configurations</h1>
          <span className="text-xs text-muted-foreground">{stats.total} fields</span>
        </div>
        <div className="flex items-center gap-1.5">
          {layoutDraft && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={handleCancelReorder}
                disabled={isSavingOrder}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={handleSaveOrder}
                disabled={isSavingOrder}
              >
                {isSavingOrder ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5 mr-1" />
                    Save Layout
                  </>
                )}
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleRefresh}>
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <Button onClick={handleCreateConfiguration} size="sm" className="h-7 text-xs">
            <Plus className="w-3.5 h-3.5 mr-1" />
            Create Field
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <GripVertical className="h-4 w-4 shrink-0" />
        <span>Drag any row by its handle to reorder it. Use the visibility button to show or hide that column on the leads list, then save the layout.</span>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)}>
        <TabsList className="h-8">
          <TabsTrigger value="all" className="text-xs h-6 px-2.5">
            All ({stats.total})
          </TabsTrigger>
          <TabsTrigger value="standard" className="text-xs h-6 px-2.5">
            Standard ({stats.standard})
          </TabsTrigger>
          <TabsTrigger value="custom" className="text-xs h-6 px-2.5">
            Custom ({stats.custom})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-3">
          <div className="border rounded-lg overflow-hidden">
            <SortableFieldConfigTable
              fields={filteredConfigurations}
              onReorder={handleReorder}
              onVisibilityChange={handleVisibilityChange}
              onView={handleViewConfiguration}
              onEdit={handleEditConfiguration}
              onDelete={handleDeleteConfiguration}
              disabled={isSavingOrder}
            />
          </div>
        </TabsContent>

        <TabsContent value="standard" className="mt-3">
          <div className="border rounded-lg overflow-hidden">
            <SortableFieldConfigTable
              fields={filteredConfigurations}
              onReorder={handleReorder}
              onVisibilityChange={handleVisibilityChange}
              onView={handleViewConfiguration}
              onEdit={handleEditConfiguration}
              onDelete={handleDeleteConfiguration}
              disabled={isSavingOrder}
            />
          </div>
        </TabsContent>

        <TabsContent value="custom" className="mt-3">
          {filteredConfigurations.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-xs text-muted-foreground mb-3">
                No custom fields configured yet.
              </p>
              <Button onClick={handleCreateConfiguration} variant="outline" size="sm" className="h-7 text-xs">
                <Plus className="w-3.5 h-3.5 mr-1" />
                Create Custom Field
              </Button>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <SortableFieldConfigTable
                fields={filteredConfigurations}
                onReorder={handleReorder}
                onVisibilityChange={handleVisibilityChange}
                onView={handleViewConfiguration}
                onEdit={handleEditConfiguration}
                onDelete={handleDeleteConfiguration}
                disabled={isSavingOrder}
              />
            </div>
          )}
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
