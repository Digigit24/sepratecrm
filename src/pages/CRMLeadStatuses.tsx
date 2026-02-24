// src/pages/CRMLeadStatuses.tsx
import { useState, useCallback, useRef, useEffect } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { useAuth } from '@/hooks/useAuth';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { LeadStatusFormDrawer } from '@/components/LeadStatusFormDrawer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, RefreshCw, GripVertical, ArrowUp, ArrowDown } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import type { LeadStatus, LeadStatusesQueryParams } from '@/types/crmTypes';
import type { RowActions } from '@/components/DataTable';
import { leadStatusCache } from '@/lib/leadStatusCache';

type DrawerMode = 'view' | 'edit' | 'create';

export const CRMLeadStatuses: React.FC = () => {
  const { user, hasModuleAccess } = useAuth();
  const { hasCRMAccess, useLeadStatuses, deleteLeadStatus, updateLeadStatus } = useCRM();

  // Query parameters state
  const [queryParams, setQueryParams] = useState<LeadStatusesQueryParams>({
    page: 1,
    page_size: 50,
    ordering: 'order_index',
  });

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedStatusId, setSelectedStatusId] = useState<number | null>(null);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>('view');

  // Drag and drop state
  const [draggedItem, setDraggedItem] = useState<LeadStatus | null>(null);
  const [dragOverItem, setDragOverItem] = useState<LeadStatus | null>(null);

  // Fetch lead statuses
  const { data: statusesData, error, isLoading, mutate } = useLeadStatuses(queryParams);

  // Cache lead statuses when fetched
  useEffect(() => {
    if (statusesData?.results) {
      leadStatusCache.updateFromApi(statusesData.results);
    }
  }, [statusesData]);

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
  const handleCreateStatus = useCallback(() => {
    setSelectedStatusId(null);
    setDrawerMode('create');
    setDrawerOpen(true);
  }, []);

  const handleViewStatus = useCallback((status: LeadStatus) => {
    setSelectedStatusId(status.id);
    setDrawerMode('view');
    setDrawerOpen(true);
  }, []);

  const handleEditStatus = useCallback((status: LeadStatus) => {
    setSelectedStatusId(status.id);
    setDrawerMode('edit');
    setDrawerOpen(true);
  }, []);

  const handleDeleteStatus = useCallback(
    async (status: LeadStatus) => {
      try {
        await deleteLeadStatus(status.id);
        toast.success(`Status "${status.name}" deleted successfully`);
        mutate(); // Refresh the list
      } catch (error: any) {
        toast.error(error?.message || 'Failed to delete status');
        throw error;
      }
    },
    [deleteLeadStatus, mutate]
  );

  const handleDrawerSuccess = useCallback(() => {
    mutate(); // Refresh the list
  }, [mutate]);

  const handleModeChange = useCallback((mode: DrawerMode) => {
    setDrawerMode(mode);
  }, []);

  // Move status up/down in order
  const handleMoveStatus = useCallback(
    async (status: LeadStatus, direction: 'up' | 'down') => {
      const statuses = statusesData?.results || [];
      const currentIndex = statuses.findIndex(s => s.id === status.id);
      
      if (currentIndex === -1) return;
      
      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= statuses.length) return;

      const targetStatus = statuses[targetIndex];
      
      try {
        // Swap order_index values
        await Promise.all([
          updateLeadStatus(status.id, { 
            ...status, 
            order_index: targetStatus.order_index 
          }),
          updateLeadStatus(targetStatus.id, { 
            ...targetStatus, 
            order_index: status.order_index 
          })
        ]);
        
        toast.success('Status order updated successfully');
        mutate(); // Refresh the list
      } catch (error: any) {
        toast.error(error?.message || 'Failed to update status order');
      }
    },
    [statusesData, updateLeadStatus, mutate]
  );

  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent, status: LeadStatus) => {
    e.stopPropagation(); // Prevent row click
    setDraggedItem(status);
    e.dataTransfer.effectAllowed = 'move';
    // Set drag image
    if (e.currentTarget instanceof HTMLElement) {
      const dragImage = e.currentTarget.cloneNode(true) as HTMLElement;
      dragImage.style.opacity = '0.5';
      document.body.appendChild(dragImage);
      e.dataTransfer.setDragImage(dragImage, 0, 0);
      setTimeout(() => document.body.removeChild(dragImage), 0);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, status: LeadStatus) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent event bubbling
    e.dataTransfer.dropEffect = 'move';
    setDragOverItem(status);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    // Only clear if we're leaving the container, not moving between children
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
      setDragOverItem(null);
    }
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedItem(null);
    setDragOverItem(null);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent, targetStatus: LeadStatus) => {
      e.preventDefault();
      e.stopPropagation();

      if (!draggedItem || draggedItem.id === targetStatus.id) {
        setDraggedItem(null);
        setDragOverItem(null);
        return;
      }

      try {
        // Swap order_index values
        await Promise.all([
          updateLeadStatus(draggedItem.id, {
            ...draggedItem,
            order_index: targetStatus.order_index
          }),
          updateLeadStatus(targetStatus.id, {
            ...targetStatus,
            order_index: draggedItem.order_index
          })
        ]);

        toast.success('Status order updated successfully');
        mutate(); // Refresh the list
      } catch (error: any) {
        toast.error(error?.message || 'Failed to update status order');
      } finally {
        setDraggedItem(null);
        setDragOverItem(null);
      }
    },
    [draggedItem, updateLeadStatus, mutate]
  );

  // Status badge helper
  const getStatusBadge = (status: LeadStatus) => {
    const bgColor = status.color_hex || '#6B7280';
    
    return (
      <div className="flex items-center gap-2">
        <div
          className="w-4 h-4 rounded-full border border-gray-300"
          style={{ backgroundColor: bgColor }}
        />
        <Badge
          variant="outline"
          style={{
            backgroundColor: `${bgColor}20`,
            borderColor: bgColor,
            color: bgColor,
          }}
        >
          {status.name}
        </Badge>
      </div>
    );
  };

  // Properties badge helper
  const getPropertiesBadges = (status: LeadStatus) => (
    <div className="flex flex-wrap gap-1">
      {status.is_won && (
        <Badge variant="default" className="bg-green-100 text-green-800 border-green-200">
          Won
        </Badge>
      )}
      {status.is_lost && (
        <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-200">
          Lost
        </Badge>
      )}
      {!status.is_active && (
        <Badge variant="secondary" className="bg-gray-100 text-gray-800 border-gray-200">
          Inactive
        </Badge>
      )}
    </div>
  );

  // Desktop table columns
  const columns: DataTableColumn<LeadStatus>[] = [
    {
      header: 'Order',
      key: 'order',
      cell: (status) => {
        const statuses = statusesData?.results || [];
        const currentIndex = statuses.findIndex(s => s.id === status.id);
        const isFirst = currentIndex === 0;
        const isLast = currentIndex === statuses.length - 1;

        return (
          <div
            className="flex items-center gap-2"
            onClick={(e) => e.stopPropagation()} // Prevent row click
          >
            <div
              className={`
                cursor-move p-1.5 rounded transition-all select-none
                ${draggedItem?.id === status.id ? 'opacity-50 scale-95 cursor-grabbing' : ''}
                ${dragOverItem?.id === status.id ? 'bg-primary/20 ring-2 ring-primary' : 'hover:bg-muted'}
              `}
              draggable={true}
              onDragStart={(e) => handleDragStart(e, status)}
              onDragOver={(e) => handleDragOver(e, status)}
              onDragLeave={handleDragLeave}
              onDragEnd={handleDragEnd}
              onDrop={(e) => handleDrop(e, status)}
              title="Drag to reorder"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex flex-col gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  handleMoveStatus(status, 'up');
                }}
                disabled={isFirst}
              >
                <ArrowUp className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={(e) => {
                  e.stopPropagation();
                  handleMoveStatus(status, 'down');
                }}
                disabled={isLast}
              >
                <ArrowDown className="h-3 w-3" />
              </Button>
            </div>
            <span className="text-sm font-mono">{status.order_index}</span>
          </div>
        );
      },
      className: 'w-[120px]',
    },
    {
      header: 'Status',
      key: 'status',
      cell: (status) => getStatusBadge(status),
      className: 'w-[200px]',
    },
    {
      header: 'Properties',
      key: 'properties',
      cell: (status) => getPropertiesBadges(status),
    },
    {
      header: 'Active',
      key: 'active',
      cell: (status) => (
        <Badge variant={status.is_active ? 'default' : 'secondary'}>
          {status.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    {
      header: 'Last Updated',
      key: 'updated',
      cell: (status) => (
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(status.updated_at), { addSuffix: true })}
        </span>
      ),
    },
  ];

  // Mobile card renderer
  const renderMobileCard = (status: LeadStatus, actions: RowActions<LeadStatus>) => (
    <>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {getStatusBadge(status)}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">#{status.order_index}</span>
          <div
            className={`
              cursor-move p-1.5 rounded transition-all select-none
              ${draggedItem?.id === status.id ? 'opacity-50 scale-95 cursor-grabbing' : ''}
              ${dragOverItem?.id === status.id ? 'bg-primary/20 ring-2 ring-primary' : 'hover:bg-muted'}
            `}
            draggable={true}
            onDragStart={(e) => handleDragStart(e, status)}
            onDragOver={(e) => handleDragOver(e, status)}
            onDragLeave={handleDragLeave}
            onDragEnd={handleDragEnd}
            onDrop={(e) => handleDrop(e, status)}
            title="Drag to reorder"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </div>

      {/* Properties */}
      <div className="space-y-2">
        {getPropertiesBadges(status)}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t">
        <span className="text-xs text-muted-foreground">
          Updated {formatDistanceToNow(new Date(status.updated_at), { addSuffix: true })}
        </span>
        <div className="flex gap-2">
          {actions.edit && (
            <Button variant="outline" size="sm" onClick={actions.edit}>
              Edit
            </Button>
          )}
          {actions.view && (
            <Button variant="default" size="sm" onClick={actions.view}>
              View
            </Button>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h1 className="text-base font-semibold">Lead Statuses</h1>
          {statusesData && (
            <span className="text-xs text-muted-foreground">{statusesData.count} total</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => mutate()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={handleCreateStatus} size="sm" className="h-7 text-xs">
            <Plus className="h-3.5 w-3.5 mr-1" />
            New Status
          </Button>
        </div>
      </div>

      {/* Statuses Table */}
      <div className="border rounded-lg overflow-hidden">
        <DataTable
          rows={statusesData?.results || []}
          isLoading={isLoading}
          columns={columns}
          renderMobileCard={renderMobileCard}
          getRowId={(status) => status.id}
          getRowLabel={(status) => status.name}
          onView={handleViewStatus}
          onEdit={handleEditStatus}
          onDelete={handleDeleteStatus}
          emptyTitle="No lead statuses found"
          emptySubtitle="Get started by creating your first lead status"
        />

        {/* Pagination */}
        {!isLoading && statusesData && statusesData.count > 0 && (
          <div className="flex items-center justify-between px-4 py-2 border-t bg-muted/30">
            <p className="text-xs text-muted-foreground">
              {statusesData.results.length} of {statusesData.count}
            </p>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                disabled={!statusesData.previous}
                onClick={() =>
                  setQueryParams((prev) => ({ ...prev, page: (prev.page || 1) - 1 }))
                }
              >
                Previous
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                disabled={!statusesData.next}
                onClick={() =>
                  setQueryParams((prev) => ({ ...prev, page: (prev.page || 1) + 1 }))
                }
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Form Drawer */}
      <LeadStatusFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        statusId={selectedStatusId}
        mode={drawerMode}
        onSuccess={handleDrawerSuccess}
        onDelete={(id) => {
          // Already handled in handleDeleteStatus
        }}
        onModeChange={handleModeChange}
      />
    </div>
  );
};