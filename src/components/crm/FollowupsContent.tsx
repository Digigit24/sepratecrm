// src/components/crm/FollowupsContent.tsx
import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCRM } from '@/hooks/useCRM';
import { useCurrency } from '@/hooks/useCurrency';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { FollowupScheduleDialog } from '@/components/FollowupScheduleDialog';
import { EditableFollowupCell } from '@/components/crm/EditableFollowupCell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Phone, Mail, MessageCircle, Eye, CalendarClock, MoreVertical } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { isToday, isTomorrow, isPast, parseISO } from 'date-fns';
import { toast } from 'sonner';
import type { Lead } from '@/types/crmTypes';
import { leadStatusCache } from '@/lib/leadStatusCache';

type FollowupFilter = 'all' | 'overdue' | 'today' | 'tomorrow' | 'upcoming' | 'no-date';

interface FollowupsContentProps {
  leads: Lead[];
  isLoading: boolean;
  onMutate: () => void;
}

export const FollowupsContent: React.FC<FollowupsContentProps> = ({
  leads,
  isLoading,
  onMutate,
}) => {
  const navigate = useNavigate();
  const { useLeadStatuses, patchLead } = useCRM();
  const { formatCurrency: formatCurrencyDynamic } = useCurrency();

  // Fetch and cache statuses
  const { data: statusesData } = useLeadStatuses({
    page_size: 100,
    ordering: 'order_index',
    is_active: true
  });

  // Cache statuses when data is loaded
  useEffect(() => {
    if (statusesData?.results) {
      leadStatusCache.updateFromApi(statusesData.results);
    }
  }, [statusesData]);

  const [activeTab, setActiveTab] = useState<FollowupFilter>('all');
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

  // Filter leads based on follow-up status
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const followUpDate = lead.next_follow_up_at ? parseISO(lead.next_follow_up_at) : null;

      switch (activeTab) {
        case 'overdue':
          return followUpDate && isPast(followUpDate) && !isToday(followUpDate);
        case 'today':
          return followUpDate && isToday(followUpDate);
        case 'tomorrow':
          return followUpDate && isTomorrow(followUpDate);
        case 'upcoming':
          return followUpDate && !isPast(followUpDate) && !isToday(followUpDate) && !isTomorrow(followUpDate);
        case 'no-date':
          return !followUpDate;
        case 'all':
        default:
          return true;
      }
    });
  }, [leads, activeTab]);

  // Count leads by category
  const counts = useMemo(() => {
    const result = {
      all: leads.length,
      overdue: 0,
      today: 0,
      tomorrow: 0,
      upcoming: 0,
      noDate: 0,
    };

    leads.forEach((lead) => {
      const followUpDate = lead.next_follow_up_at ? parseISO(lead.next_follow_up_at) : null;

      if (!followUpDate) {
        result.noDate++;
      } else if (isPast(followUpDate) && !isToday(followUpDate)) {
        result.overdue++;
      } else if (isToday(followUpDate)) {
        result.today++;
      } else if (isTomorrow(followUpDate)) {
        result.tomorrow++;
      } else {
        result.upcoming++;
      }
    });

    return result;
  }, [leads]);

  const handleViewLead = (lead: Lead) => {
    navigate(`/crm/leads/${lead.id}`);
  };

  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  const handleEmail = (email: string) => {
    window.location.href = `mailto:${email}`;
  };

  const handleWhatsApp = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    window.open(`https://wa.me/91${cleanPhone}`, '_blank');
  };

  const handleScheduleFollowup = (lead: Lead) => {
    setSelectedLead(lead);
    setScheduleDialogOpen(true);
  };

  const handleFollowupSuccess = () => {
    onMutate();
  };

  const handleUpdateFollowup = async (leadId: number, nextFollowUpAt: string | null) => {
    try {
      await patchLead(leadId, { next_follow_up_at: nextFollowUpAt });
      onMutate();
      toast.success('Follow-up updated');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update follow-up');
      throw error;
    }
  };

  const getLeadStatusBadge = (lead: Lead) => {
    // First try to use status_name from API response
    if (lead.status_name) {
      // Try to find the status object to get color
      const statusObj = statusesData?.results.find(s => s.id === lead.status);
      const bgColor = statusObj?.color_hex || '#6B7280';

      return (
        <Badge
          variant="outline"
          style={{
            backgroundColor: `${bgColor}20`,
            borderColor: bgColor,
            color: bgColor,
          }}
        >
          {lead.status_name}
        </Badge>
      );
    }

    // Fallback to cache or ID lookup
    if (!lead.status) {
      return <Badge variant="outline">No Status</Badge>;
    }

    // Try to get from current data
    let statusObj = statusesData?.results.find(s => s.id === lead.status);

    // If not found, try cache
    if (!statusObj) {
      statusObj = leadStatusCache.getById(lead.status as number);
    }

    if (!statusObj) {
      return <Badge variant="outline">Unknown Status</Badge>;
    }

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


  const columns: DataTableColumn<Lead>[] = [
    {
      header: 'Lead Name',
      key: 'name',
      cell: (lead) => (
        <div>
          <div className="font-medium">{lead.name}</div>
          {lead.title && <div className="text-sm text-muted-foreground">{lead.title}</div>}
          {lead.company && <div className="text-xs text-muted-foreground">{lead.company}</div>}
        </div>
      ),
      accessor: (lead) => lead.name,
      sortable: true,
    },
    {
      header: 'Contact',
      key: 'phone',
      cell: (lead) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Phone className="h-3 w-3 text-muted-foreground" />
            <span className="text-sm">{lead.phone}</span>
          </div>
          {lead.email && (
            <div className="flex items-center gap-2">
              <Mail className="h-3 w-3 text-muted-foreground" />
              <span className="text-sm">{lead.email}</span>
            </div>
          )}
        </div>
      ),
      accessor: (lead) => lead.phone,
    },
    {
      header: 'Follow-up Date',
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
      accessor: (lead) => lead.next_follow_up_at || '',
      sortable: true,
    },
    {
      header: 'Lead Status',
      key: 'lead_status',
      cell: (lead) => getLeadStatusBadge(lead),
      accessor: (lead) => lead.status_name || '',
    },
    {
      header: 'Priority',
      key: 'priority',
      cell: (lead) => {
        const priorityColors = {
          LOW: 'bg-blue-100 text-blue-800',
          MEDIUM: 'bg-yellow-100 text-yellow-800',
          HIGH: 'bg-red-100 text-red-800',
        };
        return (
          <Badge variant="secondary" className={priorityColors[lead.priority] || ''}>
            {lead.priority}
          </Badge>
        );
      },
      accessor: (lead) => lead.priority,
      sortable: true,
    },
    {
      header: 'Value',
      key: 'value_amount',
      cell: (lead) => {
        if (!lead.value_amount) return <span className="text-sm text-muted-foreground">-</span>;
        const numericAmount = parseFloat(lead.value_amount);
        if (isNaN(numericAmount)) return <span className="text-sm text-muted-foreground">-</span>;
        return (
          <div className="text-sm font-medium">
            {formatCurrencyDynamic(numericAmount, true, 2)}
          </div>
        );
      },
      accessor: (lead) => lead.value_amount || '0',
      sortable: true,
    },
  ];

  // Render mobile card view
  const renderMobileCard = (lead: Lead, actions: any) => {
    return (
      <>
        {/* Header row: name + actions menu */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">{lead.name}</h3>
            {lead.company && <p className="text-xs text-muted-foreground truncate">{lead.company}</p>}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0 -mr-1">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleViewLead(lead)}>
                <Eye className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleScheduleFollowup(lead)}>
                <CalendarClock className="mr-2 h-4 w-4" />
                Schedule Follow-up
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => lead.phone && handleCall(lead.phone)}>
                <Phone className="mr-2 h-4 w-4" />
                Call
              </DropdownMenuItem>
              {lead.email && (
                <DropdownMenuItem onClick={() => handleEmail(lead.email)}>
                  <Mail className="mr-2 h-4 w-4" />
                  Email
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => lead.phone && handleWhatsApp(lead.phone)}>
                <MessageCircle className="mr-2 h-4 w-4" />
                WhatsApp
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Phone + follow-up date in one row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground min-w-0">
            <Phone className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{lead.phone}</span>
          </div>
          <div onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
            <EditableFollowupCell
              dateValue={lead.next_follow_up_at}
              onSave={async (date) => {
                await handleUpdateFollowup(lead.id, date);
              }}
              leadName={lead.name}
            />
          </div>
        </div>

        {/* Status + Priority + Value */}
        <div className="flex items-center gap-2 flex-wrap">
          {getLeadStatusBadge(lead)}
          <Badge variant="secondary" className={
            lead.priority === 'HIGH' ? 'bg-red-100 text-red-800 border-0' :
            lead.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800 border-0' :
            'bg-blue-100 text-blue-800 border-0'
          }>
            {lead.priority}
          </Badge>
          {lead.value_amount && (() => {
            const numericAmount = parseFloat(lead.value_amount);
            if (isNaN(numericAmount)) return null;
            return (
              <span className="text-xs font-medium text-green-600">
                {formatCurrencyDynamic(numericAmount, true, 2)}
              </span>
            );
          })()}
        </div>
      </>
    );
  };

  return (
    <div className="space-y-3">
      {/* Follow-up Filter Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as FollowupFilter)}>
        <div className="overflow-x-auto">
          <TabsList className="flex flex-nowrap h-9 w-max min-w-full">
            <TabsTrigger value="all" className="flex-shrink-0 text-xs whitespace-nowrap px-3">
              All ({counts.all})
            </TabsTrigger>
            <TabsTrigger value="overdue" className="flex-shrink-0 text-xs whitespace-nowrap px-3 text-red-600 data-[state=active]:bg-red-50">
              Overdue ({counts.overdue})
            </TabsTrigger>
            <TabsTrigger value="today" className="flex-shrink-0 text-xs whitespace-nowrap px-3 text-orange-600 data-[state=active]:bg-orange-50">
              Today ({counts.today})
            </TabsTrigger>
            <TabsTrigger value="tomorrow" className="flex-shrink-0 text-xs whitespace-nowrap px-3 text-blue-600 data-[state=active]:bg-blue-50">
              Tomorrow ({counts.tomorrow})
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="flex-shrink-0 text-xs whitespace-nowrap px-3 text-green-600 data-[state=active]:bg-green-50">
              Upcoming ({counts.upcoming})
            </TabsTrigger>
            <TabsTrigger value="no-date" className="flex-shrink-0 text-xs whitespace-nowrap px-3 text-gray-600 data-[state=active]:bg-gray-50">
              No Date ({counts.noDate})
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value={activeTab} className="mt-3">
          <DataTable
            rows={filteredLeads}
            columns={columns}
            renderMobileCard={renderMobileCard}
            getRowId={(lead) => lead.id}
            getRowLabel={(lead) => lead.name}
            isLoading={isLoading}
            onView={handleViewLead}
            extraActions={(lead) => (
              <>
                <DropdownMenuItem onClick={() => handleScheduleFollowup(lead)}>
                  <CalendarClock className="mr-2 h-4 w-4" />
                  Schedule Follow-up
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => lead.phone && handleCall(lead.phone)}>
                  <Phone className="mr-2 h-4 w-4" />
                  Call
                </DropdownMenuItem>
                {lead.email && (
                  <DropdownMenuItem onClick={() => handleEmail(lead.email)}>
                    <Mail className="mr-2 h-4 w-4" />
                    Email
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => lead.phone && handleWhatsApp(lead.phone)}>
                  <MessageCircle className="mr-2 h-4 w-4" />
                  WhatsApp
                </DropdownMenuItem>
              </>
            )}
            emptyTitle={`No ${activeTab === 'all' ? '' : activeTab} follow-ups found`}
            emptySubtitle="Try adjusting your filters"
          />
        </TabsContent>
      </Tabs>

      {/* Follow-up Schedule Dialog */}
      <FollowupScheduleDialog
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
        lead={selectedLead}
        onSuccess={handleFollowupSuccess}
      />
    </div>
  );
};
