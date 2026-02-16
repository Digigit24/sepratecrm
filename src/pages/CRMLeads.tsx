// src/pages/CRMLeads.tsx
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '@/hooks/useCRM';
import { useAuth } from '@/hooks/useAuth';
import { useCurrency } from '@/hooks/useCurrency';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { LeadsFormDrawer } from '@/components/LeadsFormDrawer';
import { LeadStatusFormDrawer } from '@/components/LeadStatusFormDrawer';
import { KanbanBoard } from '@/components/KanbanBoard';
import { LeadImportMappingDialog } from '@/components/LeadImportMappingDialog';
import { EditableNotesCell } from '@/components/crm/EditableNotesCell';
import { EditableFollowupCell } from '@/components/crm/EditableFollowupCell';
import { EditableStatusCell } from '@/components/crm/EditableStatusCell';
import { LeadScoreSlider } from '@/components/crm/LeadScoreSlider';
import { WhatsAppTemplateModal } from '@/components/WhatsAppTemplateModal';
import { FollowupsContent } from '@/components/crm/FollowupsContent';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, RefreshCw, Building2, Phone, Mail, IndianRupee, LayoutGrid, List, Download, Upload, FileSpreadsheet, ChevronDown, MessageCircle, Trash2, FileText, CalendarClock, MoreVertical, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import type { Lead, LeadsQueryParams, PriorityEnum, LeadStatus } from '@/types/crmTypes';
import type { RowActions } from '@/components/DataTable';
import { leadStatusCache } from '@/lib/leadStatusCache';

type DrawerMode = 'view' | 'edit' | 'create';
type ViewMode = 'list' | 'kanban' | 'followups';

export const CRMLeads: React.FC = () => {
  const navigate = useNavigate();
  const { user, hasModuleAccess } = useAuth();
  const { hasCRMAccess, useLeads, useLeadStatuses, useFieldConfigurations, deleteLead, patchLead, updateLeadStatus, deleteLeadStatus, bulkCreateLeads, bulkDeleteLeads, bulkUpdateLeadStatus, exportLeads, importLeads } = useCRM();
  const { formatCurrency: formatCurrencyDynamic, getCurrencyCode, getCurrencySymbol } = useCurrency();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [queryParams, setQueryParams] = useState<LeadsQueryParams>({
    page: 1,
    page_size: viewMode === 'kanban' ? 1000 : 20,
    ordering: '-created_at',
  });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>('view');

  const [statusDrawerOpen, setStatusDrawerOpen] = useState(false);
  const [selectedStatusId, setSelectedStatusId] = useState<number | null>(null);
  const [statusDrawerMode, setStatusDrawerMode] = useState<DrawerMode>('view');

  const [importMappingOpen, setImportMappingOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<number>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [isBulkUpdatingStatus, setIsBulkUpdatingStatus] = useState(false);
  const [hideDuplicates, setHideDuplicates] = useState(true);

  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [selectedLeadForTemplate, setSelectedLeadForTemplate] = useState<Lead | null>(null);

  const { data: leadsData, error, isLoading, mutate } = useLeads(queryParams);
  const { data: statusesData, mutate: mutateStatuses } = useLeadStatuses({
    page_size: 100,
    ordering: 'order_index',
    is_active: true
  });

  const { data: configurationsData } = useFieldConfigurations({
    is_active: true,
    ordering: 'display_order',
    page_size: 200,
  });

  // Cache lead statuses when fetched
  useEffect(() => {
    if (statusesData?.results) {
      leadStatusCache.updateFromApi(statusesData.results);
    }
  }, [statusesData]);

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

  const handleCreateLead = useCallback((statusId?: number) => {
    setSelectedLeadId(null);
    setDrawerMode('create');
    setDrawerOpen(true);
  }, []);

  const handleCreateLeadClick = useCallback(() => {
    handleCreateLead();
  }, [handleCreateLead]);

  const handleViewLead = useCallback((lead: Lead) => {
    navigate(`/crm/leads/${lead.id}`);
  }, [navigate]);

  const handleEditLead = useCallback((lead: Lead) => {
    setSelectedLeadId(lead.id);
    setDrawerMode('edit');
    setDrawerOpen(true);
  }, []);

  const handleDeleteLead = useCallback(
    async (lead: Lead) => {
      try {
        await deleteLead(lead.id);
        toast.success(`Lead "${lead.name}" deleted successfully`);
        mutate();
      } catch (error: any) {
        toast.error(error?.message || 'Failed to delete lead');
        throw error;
      }
    },
    [deleteLead, mutate]
  );

  const handleBulkDelete = useCallback(async () => {
    if (selectedLeadIds.size === 0) {
      toast.error('No leads selected');
      return;
    }

    const confirmed = window.confirm(
      `Delete ${selectedLeadIds.size} lead(s)? This action cannot be undone.`
    );

    if (!confirmed) return;

    setIsDeleting(true);

    try {
      const leadIdsArray = Array.from(selectedLeadIds);
      const result = await bulkDeleteLeads(leadIdsArray);

      toast.success(result.message || `Deleted ${result.deleted_count} lead(s)`);
      setSelectedLeadIds(new Set());
      mutate();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete leads');
    } finally {
      setIsDeleting(false);
    }
  }, [selectedLeadIds, bulkDeleteLeads, mutate]);

  const handleBulkStatusChange = useCallback(async (newStatusId: number) => {
    if (selectedLeadIds.size === 0) {
      toast.error('No leads selected');
      return;
    }

    setIsBulkUpdatingStatus(true);

    try {
      const leadIdsArray = Array.from(selectedLeadIds);
      const result = await bulkUpdateLeadStatus(leadIdsArray, newStatusId);

      toast.success(result.message || `Updated status for ${result.updated_count} lead(s)`);
      setSelectedLeadIds(new Set());
      mutate();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update lead status');
    } finally {
      setIsBulkUpdatingStatus(false);
    }
  }, [selectedLeadIds, bulkUpdateLeadStatus, mutate]);

  const toggleLeadSelection = useCallback((leadId: number) => {
    setSelectedLeadIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(leadId)) {
        newSet.delete(leadId);
      } else {
        newSet.add(leadId);
      }
      return newSet;
    });
  }, []);

  const toggleAllLeads = useCallback((leads: Lead[]) => {
    setSelectedLeadIds((prev) => {
      const allSelected = leads.every((lead) => prev.has(lead.id));
      if (allSelected) {
        return new Set();
      } else {
        return new Set(leads.map((lead) => lead.id));
      }
    });
  }, []);

  const handleDrawerSuccess = useCallback(() => {
    mutate();
    mutateStatuses();
  }, [mutate, mutateStatuses]);

  const handleModeChange = useCallback((mode: DrawerMode) => {
    setDrawerMode(mode);
  }, []);

  const handleUpdateNotes = useCallback(
    async (leadId: number, notes: string) => {
      try {
        await patchLead(leadId, { notes });
        mutate();
        toast.success('Notes updated');
      } catch (error: any) {
        toast.error(error?.message || 'Failed to update notes');
        throw error;
      }
    },
    [patchLead, mutate]
  );

  const handleUpdateFollowup = useCallback(
    async (leadId: number, nextFollowUpAt: string | null) => {
      try {
        await patchLead(leadId, { next_follow_up_at: nextFollowUpAt });
        mutate();
      } catch (error: any) {
        toast.error(error?.message || 'Failed to update follow-up');
        throw error;
      }
    },
    [patchLead, mutate]
  );

  const handleUpdateLeadScore = useCallback(
    async (leadId: number, score: number) => {
      try {
        await patchLead(leadId, { lead_score: score });
        mutate();
      } catch (error: any) {
        toast.error(error?.message || 'Failed to update lead score');
        throw error;
      }
    },
    [patchLead, mutate]
  );

  const handleUpdateLeadStatus = useCallback(
    async (leadId: number, newStatusId: number) => {
      const currentData = leadsData;
      if (!currentData) {
        throw new Error('No leads data available');
      }

      const lead = currentData.results.find(l => l.id === leadId);
      if (!lead) {
        throw new Error('Lead not found');
      }

      const newStatus = statusesData?.results.find(s => s.id === newStatusId);
      const isWonStatus = newStatus?.is_won === true;

      const optimisticData = {
        ...currentData,
        results: currentData.results.map(l =>
          l.id === leadId
            ? { ...l, status: newStatusId, updated_at: new Date().toISOString() }
            : l
        )
      };

      try {
        await mutate(optimisticData, false);
        await patchLead(leadId, { status: newStatusId });

        if (isWonStatus) {
          toast.success('Lead marked as won!', {
            duration: 3000,
          });
        }

        await mutate();
      } catch (error: any) {
        await mutate();
        throw new Error(error?.message || 'Failed to update lead status');
      }
    },
    [patchLead, mutate, leadsData, statusesData]
  );

  const handleEditStatus = useCallback((status: LeadStatus) => {
    setSelectedStatusId(status.id);
    setStatusDrawerMode('edit');
    setStatusDrawerOpen(true);
  }, []);

  const handleDeleteStatus = useCallback(
    async (status: LeadStatus) => {
      if (window.confirm(`Are you sure you want to delete status "${status.name}"?`)) {
        try {
          await deleteLeadStatus(status.id);
          toast.success(`Status "${status.name}" deleted successfully`);
          mutateStatuses();
        } catch (error: any) {
          toast.error(error?.message || 'Failed to delete status');
        }
      }
    },
    [deleteLeadStatus, mutateStatuses]
  );

  const handleCreateStatus = useCallback(() => {
    setSelectedStatusId(null);
    setStatusDrawerMode('create');
    setStatusDrawerOpen(true);
  }, []);

  const handleStatusDrawerSuccess = useCallback(() => {
    mutateStatuses();
  }, [mutateStatuses]);

  const handleStatusModeChange = useCallback((mode: DrawerMode) => {
    setStatusDrawerMode(mode);
  }, []);

  const handleCallLead = useCallback((lead: Lead) => {
    if (!lead.phone) {
      toast.error('No phone number available for this lead');
      return;
    }

    const cleanPhone = lead.phone.replace(/[^\d+]/g, '');
    window.location.href = `tel:${cleanPhone}`;

    toast.success(`Calling ${lead.name}...`, {
      description: lead.phone,
      duration: 2000,
    });
  }, []);

  const handleWhatsAppLead = useCallback((lead: Lead) => {
    if (!lead.phone) {
      toast.error('No phone number available for this lead');
      return;
    }

    let cleanPhone = lead.phone.replace(/[^\d+]/g, '');

    if (cleanPhone.startsWith('+')) {
      cleanPhone = cleanPhone.substring(1);
    }

    const message = `Hi ${lead.name}, I'm reaching out regarding your inquiry.`;
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');

    toast.success(`Opening WhatsApp for ${lead.name}...`, {
      description: lead.phone,
      duration: 2000,
    });
  }, []);

  const handleWhatsAppTemplateLead = useCallback((lead: Lead) => {
    if (!lead.phone) {
      toast.error('No phone number available for this lead');
      return;
    }

    setSelectedLeadForTemplate(lead);
    setTemplateModalOpen(true);
  }, []);

  const handleMoveStatus = useCallback(
    async (status: LeadStatus, direction: 'up' | 'down') => {
      const statuses = statusesData?.results || [];
      const currentIndex = statuses.findIndex(s => s.id === status.id);
      
      if (currentIndex === -1) return;
      
      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= statuses.length) return;

      const targetStatus = statuses[targetIndex];
      
      try {
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
        mutateStatuses();
      } catch (error: any) {
        toast.error(error?.message || 'Failed to update status order');
      }
    },
    [statusesData, updateLeadStatus, mutateStatuses]
  );

  const handleViewModeChange = useCallback((newMode: ViewMode) => {
    setViewMode(newMode);
    setQueryParams(prev => ({
      ...prev,
      page: 1,
      page_size: newMode === 'kanban' ? 1000 : 20
    }));
  }, []);

  const handleExportLeads = useCallback(async (format: 'csv' | 'json' = 'csv') => {
    try {
      if (!leadsData || leadsData.count === 0) {
        toast.error('No leads to export');
        return;
      }

      toast.info('Exporting leads...');

      const result = await exportLeads({ format });

      if (format === 'csv' && result instanceof Blob) {
        const url = window.URL.createObjectURL(result);
        const link = document.createElement('a');
        link.href = url;
        const timestamp = new Date().toISOString().split('T')[0];
        link.download = `leads_export_${timestamp}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        toast.success(`Exported leads successfully as CSV`);
      } else if (format === 'json') {
        const jsonResult = result as any;
        const blob = new Blob([JSON.stringify(jsonResult, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const timestamp = new Date().toISOString().split('T')[0];
        link.download = `leads_export_${timestamp}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        toast.success(`Exported ${jsonResult.count} leads successfully as JSON`);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to export leads');
    }
  }, [leadsData, exportLeads]);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const validTypes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv',
      ];

      if (!validTypes.includes(file.type) && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls') && !file.name.endsWith('.csv')) {
        toast.error('Please select a valid CSV or Excel file (.csv, .xlsx, or .xls)');
        event.target.value = '';
        return;
      }

      setSelectedFile(file);
      setImportMappingOpen(true);

      event.target.value = '';
    },
    []
  );

  const handleImportConfirm = useCallback(
    async (mappedData: any[]) => {
      try {
        setImportMappingOpen(false);
        toast.info('Importing leads...');

        const result = await importLeads(undefined, { leads: mappedData });

        const { success_count, failed_count, total_count, failures } = result;

        if (success_count > 0 && failed_count === 0) {
          toast.success(`Successfully imported ${success_count} leads!`, {
            duration: 5000,
          });
        } else if (success_count > 0 && failed_count > 0) {
          const failureMessages = failures.slice(0, 3).map(f =>
            `Row ${f.row}: ${f.name || f.phone} - ${f.reason}`
          ).join('\n');

          toast.warning(`Imported ${success_count} leads, ${failed_count} failed`, {
            description: failureMessages + (failures.length > 3 ? `\n... and ${failures.length - 3} more` : ''),
            duration: 10000,
          });
        } else {
          const failureMessages = failures.slice(0, 3).map(f =>
            `Row ${f.row}: ${f.name || f.phone} - ${f.reason}`
          ).join('\n');

          toast.error(`Failed to import any leads (${failed_count} total)`, {
            description: failureMessages + (failures.length > 3 ? `\n... and ${failures.length - 3} more` : ''),
            duration: 10000,
          });
        }

        if (success_count > 0) {
          mutate();
        }
      } catch (error: any) {
        toast.error(error.message || 'Failed to import leads');
      }
    },
    [importLeads, mutate]
  );

  const getPriorityBadge = (priority: PriorityEnum) => {
    const variants = {
      LOW: 'bg-gray-100 text-gray-800 border-gray-200',
      MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      HIGH: 'bg-red-100 text-red-800 border-red-200',
    };

    return (
      <Badge variant="outline" className={variants[priority]}>
        {priority}
      </Badge>
    );
  };

  const getStatusBadge = (status?: LeadStatus | number) => {
    if (!status) return <Badge variant="outline">No Status</Badge>;

    let statusObj: LeadStatus | undefined;
    if (typeof status === 'number') {
      statusObj = statusesData?.results.find(s => s.id === status);
    } else {
      statusObj = status;
    }

    if (!statusObj) return <Badge variant="outline">Unknown Status</Badge>;

    const bgColor = statusObj.color_hex || '#6B7280';

    return (
      <Badge
        variant="outline"
        style={{
          backgroundColor: `${bgColor}20`,
          borderColor: bgColor,
          color: bgColor,
        }}
      >
        {statusObj.name}
      </Badge>
    );
  };

  const getContrastColor = (hexColor: string): string => {
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
  };

  const formatCurrency = (amount?: string, currencyCode?: string) => {
    if (!amount) return '-';
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount)) return '-';

    return formatCurrencyDynamic(numericAmount, true, 2);
  };

  const filteredLeads = useMemo(() => {
    if (!leadsData?.results) return [];

    if (!hideDuplicates) {
      return leadsData.results;
    }

    const seenPhones = new Set<string>();
    return leadsData.results.filter((lead) => {
      if (!lead.phone) return true;

      const normalizedPhone = lead.phone.replace(/\s+/g, '').toLowerCase();
      if (seenPhones.has(normalizedPhone)) {
        return false;
      }
      seenPhones.add(normalizedPhone);
      return true;
    });
  }, [leadsData?.results, hideDuplicates]);

  const fieldVisibilityMap = useMemo(() => {
    const allFields = configurationsData?.results || [];
    return new Map(
      allFields
        .filter((field) => field.is_standard)
        .map((field) => [field.field_name, field.is_visible])
    );
  }, [configurationsData?.results]);

  const isFieldVisible = useCallback((fieldName: string): boolean => {
    return fieldVisibilityMap.get(fieldName) ?? true;
  }, [fieldVisibilityMap]);

  const dynamicColumns = useMemo(() => {
    const allFields = configurationsData?.results || [];
    const standardFieldsMap = new Map(
      allFields
        .filter((field) => field.is_standard)
        .map((field) => [field.field_name, { order: field.display_order, visible: field.is_visible, config: field }])
    );

    const allLeadsSelected = filteredLeads.length > 0 && filteredLeads.every((lead) => selectedLeadIds.has(lead.id));

    const checkboxColumn: DataTableColumn<Lead> = {
      header: (
        <Checkbox
          checked={allLeadsSelected}
          onCheckedChange={() => toggleAllLeads(filteredLeads)}
          onClick={(e) => e.stopPropagation()}
        />
      ),
      key: 'checkbox',
      cell: (lead) => (
        <Checkbox
          checked={selectedLeadIds.has(lead.id)}
          onCheckedChange={() => toggleLeadSelection(lead.id)}
          onClick={(e) => e.stopPropagation()}
        />
      ),
      className: 'w-[40px]',
      sortable: false,
      filterable: false,
    };

    const columnDefinitions: Record<string, DataTableColumn<Lead>> = {
      name: {
        header: 'Name',
        key: 'name',
        cell: (lead) => (
          <div className="flex flex-col">
            <span className="font-medium text-foreground">{lead.name}</span>
            {lead.title && standardFieldsMap.has('title') && (
              <span className="text-xs text-muted-foreground">{lead.title}</span>
            )}
          </div>
        ),
        className: 'w-[200px]',
        sortable: true,
        filterable: true,
        accessor: (lead) => lead.name,
      },
      company: {
        header: 'Company',
        key: 'company',
        cell: (lead) => (
          <div className="flex items-center gap-2">
            {lead.company ? (
              <>
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm">{lead.company}</span>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">-</span>
            )}
          </div>
        ),
        sortable: true,
        filterable: true,
        accessor: (lead) => lead.company || '',
      },
      phone: {
        header: 'Contact',
        key: 'contact',
        cell: (lead) => (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 text-xs">
              <Phone className="h-3 w-3 text-muted-foreground" />
              <span>{lead.phone}</span>
            </div>
            {lead.email && standardFieldsMap.has('email') && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Mail className="h-3 w-3" />
                <span className="truncate">{lead.email}</span>
              </div>
            )}
            <div className="flex items-center gap-1 mt-1">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs gap-1"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCallLead(lead);
                }}
              >
                <Phone className="h-3 w-3" />
                Call
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs gap-1 text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
                onClick={(e) => {
                  e.stopPropagation();
                  handleWhatsAppLead(lead);
                }}
              >
                <MessageCircle className="h-3 w-3" />
                WhatsApp
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs gap-1 text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                onClick={(e) => {
                  e.stopPropagation();
                  handleWhatsAppTemplateLead(lead);
                }}
                title="Send WhatsApp Template"
              >
                <FileText className="h-3 w-3" />
                Template
              </Button>
            </div>
          </div>
        ),
        sortable: true,
        filterable: true,
        accessor: (lead) => `${lead.phone} ${lead.email || ''}`,
      },
      status: {
        header: 'Status',
        key: 'status',
        cell: (lead) => (
          <div onClick={(e) => e.stopPropagation()}>
            <EditableStatusCell
              currentStatusId={typeof lead.status === 'number' ? lead.status : lead.status?.id}
              statuses={statusesData?.results || []}
              onSave={async (newStatusId) => {
                await handleUpdateLeadStatus(lead.id, newStatusId);
              }}
            />
          </div>
        ),
        sortable: true,
        filterable: false,
        accessor: (lead) => {
          const statusId = typeof lead.status === 'number' ? lead.status : lead.status?.id;
          const statusObj = statusesData?.results.find(s => s.id === statusId);
          return statusObj?.name || '';
        },
      },
      priority: {
        header: 'Priority',
        key: 'priority',
        cell: (lead) => getPriorityBadge(lead.priority),
        sortable: true,
        filterable: true,
        accessor: (lead) => lead.priority,
        sortFn: (a, b, direction) => {
          const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
          const aVal = priorityOrder[a.priority] || 0;
          const bVal = priorityOrder[b.priority] || 0;
          return direction === 'asc' ? aVal - bVal : bVal - aVal;
        },
      },
      value_amount: {
        header: 'Value',
        key: 'value',
        cell: (lead) => (
          <div className="flex items-center gap-1.5">
            <IndianRupee className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium">
              {formatCurrency(lead.value_amount, lead.value_currency)}
            </span>
          </div>
        ),
        className: 'text-right',
        sortable: true,
        filterable: false,
        accessor: (lead) => parseFloat(lead.value_amount || '0'),
      },
      notes: {
        header: 'Notes',
        key: 'notes',
        cell: (lead) => (
          <div onClick={(e) => e.stopPropagation()}>
            <EditableNotesCell
              notes={lead.notes}
              onSave={async (notes) => {
                await handleUpdateNotes(lead.id, notes);
              }}
            />
          </div>
        ),
        className: 'w-[200px]',
        sortable: false,
        filterable: true,
        accessor: (lead) => lead.notes || '',
      },
      next_follow_up_at: {
        header: 'Next Follow-up',
        key: 'next_follow_up_at',
        cell: (lead) => (
          <div onClick={(e) => e.stopPropagation()} className="w-[140px]">
            <EditableFollowupCell
              dateValue={lead.next_follow_up_at}
              onSave={async (date) => {
                await handleUpdateFollowup(lead.id, date);
              }}
              leadName={lead.name}
            />
          </div>
        ),
        sortable: true,
        filterable: false,
        accessor: (lead) => lead.next_follow_up_at || '',
      },
      lead_score: {
        header: 'Score',
        key: 'lead_score',
        cell: (lead) => (
          <div onClick={(e) => e.stopPropagation()}>
            <LeadScoreSlider
              score={lead.lead_score || 0}
              onSave={async (score) => {
                await handleUpdateLeadScore(lead.id, score);
              }}
              leadName={lead.name}
              size="sm"
            />
          </div>
        ),
        sortable: true,
        filterable: false,
        accessor: (lead) => lead.lead_score || 0,
      },
    };

    const visibleColumns: Array<{ column: DataTableColumn<Lead>; order: number }> = [];

    const defaultFieldOrder: Record<string, number> = {
      name: 0,
      phone: 1,
      company: 2,
      status: 3,
      priority: 4,
      value_amount: 5,
      notes: 6,
      next_follow_up_at: 7,
      lead_score: 8,
    };

    Object.entries(columnDefinitions).forEach(([fieldName, columnDef]) => {
      const fieldConfig = standardFieldsMap.get(fieldName);

      if (fieldName === 'notes' || fieldName === 'next_follow_up_at' || fieldName === 'lead_score') {
        const order = fieldConfig?.order ?? defaultFieldOrder[fieldName] ?? 6;
        visibleColumns.push({ column: columnDef, order });
        return;
      }

      const shouldShow = !fieldConfig || fieldConfig.visible;

      if (shouldShow) {
        const order = fieldConfig?.order ?? defaultFieldOrder[fieldName] ?? 999;
        visibleColumns.push({ column: columnDef, order });
      }
    });

    const sortedColumns = visibleColumns
      .sort((a, b) => a.order - b.order)
      .map((item) => item.column);

    sortedColumns.unshift(checkboxColumn);

    sortedColumns.push({
      header: 'Last Updated',
      key: 'updated',
      cell: (lead) => (
        <span className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(lead.updated_at), { addSuffix: true })}
        </span>
      ),
      sortable: true,
      filterable: false,
      accessor: (lead) => new Date(lead.updated_at).getTime(),
    });

    return sortedColumns;
  }, [configurationsData?.results, statusesData?.results, selectedLeadIds, toggleLeadSelection, filteredLeads, toggleAllLeads, handleUpdateNotes, handleUpdateFollowup, handleUpdateLeadScore, handleUpdateLeadStatus]);

  const columns: DataTableColumn<Lead>[] = dynamicColumns;

  const renderMobileCard = (lead: Lead, actions: RowActions<Lead>) => (
    <>
      {isFieldVisible('name') && (
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base truncate">{lead.name}</h3>
            {lead.title && isFieldVisible('title') && (
              <p className="text-xs text-muted-foreground mt-0.5">{lead.title}</p>
            )}
          </div>
          <div className="flex items-center gap-1">
            {isFieldVisible('priority') && getPriorityBadge(lead.priority)}
          </div>
        </div>
      )}

      {(isFieldVisible('company') || isFieldVisible('status')) && (
        <div className="flex flex-wrap items-center gap-2">
          {lead.company && isFieldVisible('company') && (
            <div className="flex items-center gap-1.5 text-sm">
              <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{lead.company}</span>
            </div>
          )}
          {isFieldVisible('status') && (
            <div onClick={(e) => e.stopPropagation()}>
              <EditableStatusCell
                currentStatusId={typeof lead.status === 'number' ? lead.status : lead.status?.id}
                statuses={statusesData?.results || []}
                onSave={async (newStatusId) => {
                  await handleUpdateLeadStatus(lead.id, newStatusId);
                }}
              />
            </div>
          )}
        </div>
      )}

      {(isFieldVisible('phone') || isFieldVisible('email')) && (
        <div className="space-y-2">
          {isFieldVisible('phone') && (
            <div className="flex items-center gap-1.5 text-sm">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{lead.phone}</span>
            </div>
          )}
          {lead.email && isFieldVisible('email') && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Mail className="h-3.5 w-3.5" />
              <span className="truncate">{lead.email}</span>
            </div>
          )}
          {isFieldVisible('phone') && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs gap-1.5 flex-1"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCallLead(lead);
                }}
              >
                <Phone className="h-3.5 w-3.5" />
                Call
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs gap-1.5 flex-1 text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
                onClick={(e) => {
                  e.stopPropagation();
                  handleWhatsAppLead(lead);
                }}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                WhatsApp
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-3 text-xs gap-1.5 flex-1 text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                onClick={(e) => {
                  e.stopPropagation();
                  handleWhatsAppTemplateLead(lead);
                }}
                title="Send WhatsApp Template"
              >
                <FileText className="h-3.5 w-3.5" />
                Template
              </Button>
            </div>
          )}
        </div>
      )}

      {lead.value_amount && isFieldVisible('value_amount') && (
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <IndianRupee className="h-4 w-4 text-muted-foreground" />
          <span>{formatCurrency(lead.value_amount, lead.value_currency)}</span>
        </div>
      )}

      {isFieldVisible('notes') && (
        <div onClick={(e) => e.stopPropagation()}>
          <EditableNotesCell
            notes={lead.notes}
            onSave={async (notes) => {
              await handleUpdateNotes(lead.id, notes);
            }}
          />
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t">
        <span className="text-xs text-muted-foreground">
          Updated {formatDistanceToNow(new Date(lead.updated_at), { addSuffix: true })}
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
    <div className="p-6 max-w-8xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">CRM Leads</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Manage your sales leads and pipeline
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Bulk Actions - shown when leads are selected */}
          {selectedLeadIds.size > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg">
              <span className="text-sm font-medium">
                {selectedLeadIds.size} selected
              </span>
              <div className="w-px h-4 bg-border" />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isBulkUpdatingStatus}
                    className="h-7"
                  >
                    {isBulkUpdatingStatus ? (
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    Status
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[180px]">
                  {statusesData?.results.map((status) => (
                    <DropdownMenuItem
                      key={status.id}
                      onClick={() => handleBulkStatusChange(status.id)}
                      className="cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full border"
                          style={{
                            backgroundColor: status.color_hex || '#6B7280',
                            borderColor: status.color_hex || '#6B7280',
                          }}
                        />
                        <span>{status.name}</span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleBulkDelete}
                disabled={isDeleting}
                className="h-7 text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                {isDeleting ? (
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                )}
                Delete
              </Button>
            </div>
          )}

          {/* Quick Actions */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => mutate()}
            disabled={isLoading}
            className="h-9 w-9"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>

          {/* More Actions Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-9 w-9" title="More actions">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => setHideDuplicates(!hideDuplicates)}>
                {hideDuplicates ? (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    Show All Leads
                  </>
                ) : (
                  <>
                    <EyeOff className="h-4 w-4 mr-2" />
                    Hide Duplicates
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleImportClick}>
                <Upload className="h-4 w-4 mr-2" />
                Import Leads
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleExportLeads('csv')}
                disabled={!leadsData || leadsData.count === 0}
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => handleExportLeads('json')}
                disabled={!leadsData || leadsData.count === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export as JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Primary Action */}
          <Button onClick={handleCreateLeadClick} size="default">
            <Plus className="h-4 w-4 mr-2" />
            New Lead
          </Button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        onChange={handleFileChange}
        className="hidden"
      />

      {leadsData && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Building2 className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Total Leads</p>
                  <p className="text-xl sm:text-2xl font-bold">{leadsData.count}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <RefreshCw className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">This Page</p>
                  <p className="text-xl sm:text-2xl font-bold">{leadsData.results.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <LayoutGrid className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Total Pages</p>
                  <p className="text-xl sm:text-2xl font-bold">
                    {Math.ceil(leadsData.count / (queryParams.page_size || 20))}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <List className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Current Page</p>
                  <p className="text-xl sm:text-2xl font-bold">{queryParams.page || 1}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardContent className="p-4">
          <Tabs value={viewMode} onValueChange={(value) => handleViewModeChange(value as ViewMode)}>
            <TabsList className="grid w-full grid-cols-3 max-w-lg">
              <TabsTrigger value="list" className="flex items-center gap-2">
                <List className="h-4 w-4" />
                List View
              </TabsTrigger>
              <TabsTrigger value="kanban" className="flex items-center gap-2">
                <LayoutGrid className="h-4 w-4" />
                Kanban Board
              </TabsTrigger>
              <TabsTrigger value="followups" className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4" />
                Follow-ups
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      {viewMode === 'followups' ? (
        <FollowupsContent
          leads={filteredLeads}
          isLoading={isLoading}
          onMutate={mutate}
        />
      ) : viewMode === 'list' ? (
        <Card>
          <CardContent className="p-0">
            <DataTable
              rows={filteredLeads}
              isLoading={isLoading}
              columns={columns}
              renderMobileCard={renderMobileCard}
              getRowId={(lead) => lead.id}
              getRowLabel={(lead) => lead.name}
              onView={handleViewLead}
              onEdit={handleEditLead}
              onDelete={handleDeleteLead}
              emptyTitle="No leads found"
              emptySubtitle="Get started by creating your first lead"
            />

            {!isLoading && leadsData && leadsData.count > 0 && (
              <div className="flex items-center justify-between px-6 py-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Showing {leadsData.results.length} of {leadsData.count} lead(s)
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!leadsData.previous}
                    onClick={() =>
                      setQueryParams((prev) => ({ ...prev, page: (prev.page || 1) - 1 }))
                    }
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!leadsData.next}
                    onClick={() =>
                      setQueryParams((prev) => ({ ...prev, page: (prev.page || 1) + 1 }))
                    }
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4">
            <KanbanBoard
              leads={filteredLeads}
              statuses={statusesData?.results || []}
              onViewLead={handleViewLead}
              onCallLead={handleCallLead}
              onWhatsAppLead={handleWhatsAppLead}
              onCreateLead={handleCreateLead}
              onEditStatus={handleEditStatus}
              onDeleteStatus={handleDeleteStatus}
              onCreateStatus={handleCreateStatus}
              onMoveStatus={handleMoveStatus}
              onUpdateLeadStatus={handleUpdateLeadStatus}
              isLoading={isLoading}
            />
          </CardContent>
        </Card>
      )}

      <LeadsFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        leadId={selectedLeadId}
        mode={drawerMode}
        onSuccess={handleDrawerSuccess}
        onDelete={(id) => {}}
        onModeChange={handleModeChange}
      />

      <LeadStatusFormDrawer
        open={statusDrawerOpen}
        onOpenChange={setStatusDrawerOpen}
        statusId={selectedStatusId}
        mode={statusDrawerMode}
        onSuccess={handleStatusDrawerSuccess}
        onDelete={(id) => {}}
        onModeChange={handleStatusModeChange}
      />

      <LeadImportMappingDialog
        open={importMappingOpen}
        onClose={() => setImportMappingOpen(false)}
        file={selectedFile}
        onConfirm={handleImportConfirm}
      />

      <WhatsAppTemplateModal
        open={templateModalOpen}
        onOpenChange={setTemplateModalOpen}
        phoneNumber={selectedLeadForTemplate?.phone || ''}
        leadName={selectedLeadForTemplate?.name || ''}
      />
    </div>
  );
};