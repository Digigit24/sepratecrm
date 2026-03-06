// src/components/CampaignsTable.tsx
import React from 'react';
import { Archive, ArchiveRestore, BarChart3, Calendar, UsersRound } from 'lucide-react';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import type { WACampaign } from '@/types/whatsappTypes';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface CampaignsTableProps {
  campaigns: WACampaign[];
  isLoading: boolean;
  onView?: (row: WACampaign) => void;
  onEdit?: (row: WACampaign) => void;
  onDelete?: (row: WACampaign) => Promise<void>;
  onArchive?: (row: WACampaign) => void;
  onUnarchive?: (row: WACampaign) => void;
  onViewAnalytics?: (row: WACampaign) => void;
}

function formatDate(iso?: string) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: '2-digit',
    });
  } catch {
    return iso;
  }
}

function getStatusBadge(campaign: WACampaign) {
  const text = campaign.status_text;
  if (text) {
    const lower = text.toLowerCase();
    if (lower === 'executed') return { label: 'Executed', cls: 'bg-green-100 text-green-800' };
    if (lower === 'processing') return { label: 'Processing', cls: 'bg-blue-100 text-blue-800' };
    if (lower === 'pending' || lower === 'scheduled') return { label: text, cls: 'bg-yellow-100 text-yellow-800' };
    if (lower === 'failed') return { label: 'Failed', cls: 'bg-red-100 text-red-800' };
    return { label: text, cls: 'bg-gray-100 text-gray-700' };
  }
  // Fall back to numeric status
  switch (Number(campaign.status)) {
    case 1: return { label: 'Active', cls: 'bg-green-100 text-green-800' };
    case 2: return { label: 'Processing', cls: 'bg-blue-100 text-blue-800' };
    case 3: return { label: 'Executed', cls: 'bg-emerald-100 text-emerald-800' };
    case 4: return { label: 'Failed', cls: 'bg-red-100 text-red-800' };
    default: return { label: String(campaign.status), cls: 'bg-gray-100 text-gray-700' };
  }
}

export function CampaignsTable({
  campaigns,
  isLoading,
  onView,
  onEdit,
  onDelete,
  onArchive,
  onUnarchive,
  onViewAnalytics
}: CampaignsTableProps) {
  const columns: DataTableColumn<WACampaign>[] = [
    {
      header: 'Campaign',
      key: 'campaign',
      cell: (row) => (
        <div className="min-w-0">
          <span className="font-medium text-xs truncate block max-w-[180px]">
            {row.campaign_name || '(No name)'}
          </span>
          <p className="text-[10px] text-muted-foreground font-mono leading-none mt-0.5">
            {row.campaign_id}
          </p>
        </div>
      ),
      sortable: true,
      accessor: (row) => row.campaign_name || '',
    },
    {
      header: 'Template',
      key: 'template',
      cell: (row) => (
        <div className="min-w-0">
          <span className="text-xs truncate block max-w-[160px]">
            {row.template_name || '—'}
          </span>
          {row.template_language && (
            <span className="text-[10px] text-muted-foreground">{row.template_language}</span>
          )}
        </div>
      ),
      sortable: true,
      accessor: (row) => row.template_name || '',
    },
    {
      header: 'Status',
      key: 'status',
      cell: (row) => {
        const { label, cls } = getStatusBadge(row);
        return (
          <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0 h-4', cls)}>
            {label}
          </Badge>
        );
      },
      sortable: true,
      accessor: (row) => row.status_text || String(row.status),
    },
    {
      header: 'Scheduled',
      key: 'scheduled',
      cell: (row) => (
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Calendar className="h-3 w-3" />
          {formatDate(row.scheduled_at)}
        </span>
      ),
      sortable: true,
      accessor: (row) => row.scheduled_at ? new Date(row.scheduled_at).getTime() : 0,
    },
    {
      header: 'Contacts',
      key: 'total',
      cell: (row) => (
        <span className="flex items-center gap-1 text-xs tabular-nums">
          <UsersRound className="h-3 w-3 text-muted-foreground" />
          {row.total_recipients}
        </span>
      ),
      sortable: true,
      accessor: (row) => row.total_recipients,
    },
  ];

  const renderMobileCard = (row: WACampaign, _actions: any) => {
    const { label, cls } = getStatusBadge(row);
    return (
      <>
        <div className="flex items-start justify-between">
          <div>
            <div className="font-medium text-sm">{row.campaign_name || '(No name)'}</div>
            <div className="text-[11px] text-muted-foreground font-mono">{row.campaign_id}</div>
          </div>
          <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0 h-4', cls)}>
            {label}
          </Badge>
        </div>

        {row.template_name && (
          <div className="text-[11px] text-muted-foreground">
            Template: <span className="font-medium">{row.template_name}</span>
            {row.template_language && ` (${row.template_language})`}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="rounded border p-1.5">
            <div className="text-[9px] uppercase text-muted-foreground">Contacts</div>
            <div className="text-xs font-medium">{row.total_recipients}</div>
          </div>
          <div className="rounded border p-1.5">
            <div className="text-[9px] uppercase text-muted-foreground">Scheduled</div>
            <div className="text-xs font-medium">{formatDate(row.scheduled_at)}</div>
          </div>
        </div>
      </>
    );
  };

  const getExtraActions = (row: WACampaign) => (
    <>
      {onViewAnalytics && (
        <DropdownMenuItem onClick={() => onViewAnalytics(row)}>
          <BarChart3 className="mr-2 h-4 w-4" />
          View Analytics
        </DropdownMenuItem>
      )}
      {onArchive && (
        <DropdownMenuItem onClick={() => onArchive(row)}>
          <Archive className="mr-2 h-4 w-4" />
          Archive
        </DropdownMenuItem>
      )}
      {onUnarchive && (
        <DropdownMenuItem onClick={() => onUnarchive(row)}>
          <ArchiveRestore className="mr-2 h-4 w-4" />
          Unarchive
        </DropdownMenuItem>
      )}
    </>
  );

  return (
    <DataTable
      rows={campaigns}
      isLoading={isLoading}
      columns={columns}
      renderMobileCard={renderMobileCard}
      getRowId={(row) => row.campaign_id}
      getRowLabel={(row) => row.campaign_name || row.campaign_id}
      onRowClick={onView}
      onView={onView}
      onEdit={onEdit}
      onDelete={onDelete}
      extraActions={getExtraActions}
      emptyTitle="No campaigns yet"
      emptySubtitle="Create your first WhatsApp broadcast campaign"
    />
  );
}

export default CampaignsTable;
