// src/components/CampaignsTable.tsx
import React from 'react';
import { Archive, ArchiveRestore, BarChart3, Calendar, Send, AlertTriangle, UsersRound } from 'lucide-react';
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

function formatDate(iso: string) {
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

function successRate(c: WACampaign) {
  if (!c.total_recipients) return 0;
  return Math.round(((c.sent_count ?? 0) / c.total_recipients) * 100);
}

function getSuccessRateColor(rate: number) {
  if (rate >= 90) return 'bg-green-100 text-green-800';
  if (rate >= 70) return 'bg-emerald-100 text-emerald-800';
  if (rate >= 40) return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-800';
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
      header: 'Date',
      key: 'created',
      cell: (row) => (
        <span className="text-[11px] text-muted-foreground">
          {formatDate(row.created_at)}
        </span>
      ),
      sortable: true,
      accessor: (row) => new Date(row.created_at).getTime(),
    },
    {
      header: 'Recipients',
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
    {
      header: 'Sent',
      key: 'sent',
      cell: (row) => (
        <span className="flex items-center gap-1 text-xs tabular-nums">
          <Send className="h-3 w-3 text-green-600" />
          <span className="text-green-600">{row.sent_count}</span>
        </span>
      ),
      sortable: true,
      accessor: (row) => row.sent_count ?? 0,
    },
    {
      header: 'Failed',
      key: 'failed',
      cell: (row) => (
        <span className="flex items-center gap-1 text-xs tabular-nums">
          <AlertTriangle className={cn('h-3 w-3', (row.failed_count ?? 0) > 0 ? 'text-red-500' : 'text-muted-foreground/40')} />
          <span className={cn((row.failed_count ?? 0) > 0 ? 'text-red-600' : 'text-muted-foreground')}>
            {row.failed_count ?? 0}
          </span>
        </span>
      ),
      sortable: true,
      accessor: (row) => row.failed_count ?? 0,
    },
    {
      header: 'Rate',
      key: 'success',
      cell: (row) => {
        const rate = successRate(row);
        return (
          <Badge variant="secondary" className={cn('text-[10px] px-1.5 py-0 h-4 tabular-nums', getSuccessRateColor(rate))}>
            {rate}%
          </Badge>
        );
      },
      sortable: true,
      accessor: (row) => successRate(row),
    },
  ];

  const renderMobileCard = (row: WACampaign, actions: any) => {
    const rate = successRate(row);
    return (
      <>
        <div className="flex items-start justify-between">
          <div>
            <div className="font-medium text-sm">{row.campaign_name || '(No name)'}</div>
            <div className="text-[11px] text-muted-foreground font-mono">{row.campaign_id}</div>
          </div>
          <Badge
            variant="secondary"
            className={cn('text-[10px] px-1.5 py-0 h-4 tabular-nums', getSuccessRateColor(rate))}
          >
            {rate}%
          </Badge>
        </div>

        <div className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Calendar className="h-2.5 w-2.5" />
          {formatDate(row.created_at)}
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded border p-1.5">
            <div className="text-[9px] uppercase text-muted-foreground">Recipients</div>
            <div className="text-xs font-medium">{row.total_recipients}</div>
          </div>
          <div className="rounded border p-1.5">
            <div className="text-[9px] uppercase text-muted-foreground">Sent</div>
            <div className="text-xs font-medium text-green-600">{row.sent_count}</div>
          </div>
          <div className="rounded border p-1.5">
            <div className="text-[9px] uppercase text-muted-foreground">Failed</div>
            <div className={cn('text-xs font-medium', (row.failed_count ?? 0) > 0 ? 'text-red-600' : '')}>
              {row.failed_count ?? 0}
            </div>
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
