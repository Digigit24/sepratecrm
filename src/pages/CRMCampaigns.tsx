// src/pages/CRMCampaigns.tsx
// WhatsApp campaigns managed from DigiCRM (not from the WhatsApp module)
import { useState, useCallback } from 'react';
import useSWR, { mutate as globalMutate } from 'swr';
import { Plus, RefreshCw, Send, BarChart2, MessageCircle, Loader2, ChevronRight, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CampaignFormDrawer } from '@/components/crm/CampaignFormDrawer';
import { whatsAppCrmService, type WhatsAppCampaign, type CampaignStatus } from '@/services/whatsappCrmService';

const STATUS_COLORS: Record<CampaignStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  SCHEDULED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  RUNNING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  COMPLETED: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

export const CRMCampaigns: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const swrKey = ['/whatsapp/campaigns', page, statusFilter, search];

  const { data, isLoading, mutate } = useSWR(
    swrKey,
    () => whatsAppCrmService.getCampaigns({
      page,
      page_size: 20,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      search: search || undefined,
    }),
    { revalidateOnFocus: false }
  );

  const campaigns = data?.results ?? [];
  const totalCount = data?.count ?? 0;

  const handleLaunch = useCallback(async (campaign: WhatsAppCampaign, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Launch "${campaign.name}" now?`)) return;
    try {
      await whatsAppCrmService.launchCampaign(campaign.id);
      toast.success('Campaign launched');
      mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to launch campaign');
    }
  }, [mutate]);

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">WhatsApp Campaigns</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{totalCount} campaign{totalCount !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => mutate()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button size="sm" onClick={() => setDrawerOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Campaign
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search campaigns..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-8 h-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-36 h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="SCHEDULED">Scheduled</SelectItem>
            <SelectItem value="RUNNING">Running</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <MessageCircle className="h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No campaigns yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Create your first WhatsApp campaign to get started</p>
          <Button size="sm" className="mt-4" onClick={() => setDrawerOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Campaign
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {campaigns.map((c) => (
            <Card
              key={c.id}
              className="cursor-pointer hover:bg-muted/30 transition-colors border-border/60"
              onClick={() => navigate(`/crm/campaigns/${c.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{c.name}</span>
                      <Badge className={`text-[11px] px-1.5 py-0 border-0 ${STATUS_COLORS[c.status]}`}>
                        {c.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 mt-1.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" />
                        {c.template_name || c.template_uid}
                      </span>
                      <span>{c.total_contacts} contact{c.total_contacts !== 1 ? 's' : ''}</span>
                      {c.scheduled_at && (
                        <span>Scheduled {format(new Date(c.scheduled_at), 'MMM d, yyyy HH:mm')}</span>
                      )}
                      {c.launched_at && (
                        <span>Launched {format(new Date(c.launched_at), 'MMM d, yyyy HH:mm')}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {c.status === 'COMPLETED' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 gap-1 text-xs"
                        onClick={(e) => { e.stopPropagation(); navigate(`/crm/campaigns/${c.id}`); }}
                      >
                        <BarChart2 className="h-3.5 w-3.5" /> Analytics
                      </Button>
                    )}
                    {(c.status === 'DRAFT' || c.status === 'SCHEDULED') && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-2 gap-1 text-xs"
                        onClick={(e) => handleLaunch(c, e)}
                      >
                        <Send className="h-3.5 w-3.5" /> Launch
                      </Button>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalCount > 20 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            Showing {(page - 1) * 20 + 1}–{Math.min(page * 20, totalCount)} of {totalCount}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page * 20 >= totalCount} onClick={() => setPage(p => p + 1)}>Next</Button>
          </div>
        </div>
      )}

      {/* Create drawer */}
      <CampaignFormDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        onSuccess={() => { setDrawerOpen(false); mutate(); }}
      />
    </div>
  );
};
