// src/pages/CRMCampaignDetail.tsx
import { useParams, useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { ArrowLeft, Send, BarChart2, MessageCircle, Loader2, RefreshCw, Users } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { whatsAppCrmService, type CampaignStatus } from '@/services/whatsappCrmService';

const STATUS_COLORS: Record<CampaignStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  SCHEDULED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  RUNNING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  COMPLETED: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  FAILED: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

export const CRMCampaignDetail: React.FC = () => {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const id = parseInt(campaignId!, 10);

  const { data: campaign, isLoading, mutate } = useSWR(
    campaignId ? `/whatsapp/campaigns/${id}` : null,
    () => whatsAppCrmService.getCampaign(id),
    { revalidateOnFocus: false }
  );

  const { data: analytics, isLoading: analyticsLoading, mutate: mutateAnalytics } = useSWR(
    campaign?.laravel_campaign_uid ? `/whatsapp/campaigns/${id}/analytics` : null,
    () => whatsAppCrmService.getCampaignAnalytics(id),
    { revalidateOnFocus: false }
  );

  const { data: repliesData } = useSWR(
    campaign?.laravel_campaign_uid ? `/whatsapp/campaigns/${id}/replies` : null,
    () => whatsAppCrmService.getCampaignReplies(id),
    { revalidateOnFocus: false }
  );

  const handleLaunch = async () => {
    if (!campaign) return;
    if (!confirm(`Launch "${campaign.name}" now? This will send messages to ${campaign.total_contacts} contacts.`)) return;
    try {
      await whatsAppCrmService.launchCampaign(id);
      toast.success('Campaign launched');
      mutate();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to launch');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Campaign not found.</p>
      </div>
    );
  }

  const analyticsCards = analytics
    ? [
        { label: 'Total', value: analytics.total, color: 'text-foreground' },
        { label: 'Sent', value: analytics.sent, color: 'text-blue-600 dark:text-blue-400' },
        { label: 'Delivered', value: analytics.delivered, color: 'text-green-600 dark:text-green-400' },
        { label: 'Read', value: analytics.read, color: 'text-purple-600 dark:text-purple-400' },
        { label: 'Failed', value: analytics.failed, color: 'text-red-600 dark:text-red-400' },
      ]
    : [];

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/crm/campaigns')} className="mt-0.5">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{campaign.name}</h1>
            <Badge className={`text-[11px] px-1.5 py-0 border-0 ${STATUS_COLORS[campaign.status]}`}>
              {campaign.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {campaign.total_contacts} contacts · Template: {campaign.template_name || campaign.template_uid}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { mutate(); mutateAnalytics(); }}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {(campaign.status === 'DRAFT' || campaign.status === 'SCHEDULED') && (
            <Button size="sm" onClick={handleLaunch}>
              <Send className="h-4 w-4 mr-1" /> Launch Now
            </Button>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        {campaign.scheduled_at && (
          <div>
            <span className="text-muted-foreground">Scheduled</span>
            <p className="font-medium">{format(new Date(campaign.scheduled_at), 'MMM d, yyyy HH:mm')}</p>
          </div>
        )}
        {campaign.launched_at && (
          <div>
            <span className="text-muted-foreground">Launched</span>
            <p className="font-medium">{format(new Date(campaign.launched_at), 'MMM d, yyyy HH:mm')}</p>
          </div>
        )}
        <div>
          <span className="text-muted-foreground">Created</span>
          <p className="font-medium">{format(new Date(campaign.created_at), 'MMM d, yyyy')}</p>
        </div>
        {campaign.laravel_campaign_uid && (
          <div>
            <span className="text-muted-foreground">Laravel Campaign ID</span>
            <p className="font-mono text-xs">{campaign.laravel_campaign_uid}</p>
          </div>
        )}
      </div>

      {/* Analytics */}
      {campaign.laravel_campaign_uid && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart2 className="h-4 w-4" /> Delivery Analytics
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analyticsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading analytics...
              </div>
            ) : analytics ? (
              <div className="space-y-4">
                <div className="grid grid-cols-5 gap-4">
                  {analyticsCards.map((card) => (
                    <div key={card.label} className="text-center">
                      <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{card.label}</div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-6 text-sm pt-2 border-t border-border/60">
                  <div>
                    <span className="text-muted-foreground">Delivery rate: </span>
                    <span className="font-medium">{analytics.delivery_rate.toFixed(1)}%</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Read rate: </span>
                    <span className="font-medium">{analytics.read_rate.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Analytics not available yet.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Replies */}
      {repliesData && repliesData.results.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MessageCircle className="h-4 w-4" /> Replies ({repliesData.count})
            </CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border/50">
            {repliesData.results.map((reply, idx) => (
              <div key={idx} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <span className="text-sm font-medium">
                        {reply.contact_name || reply.phone}
                      </span>
                      {reply.contact_name && (
                        <span className="text-xs text-muted-foreground ml-2">{reply.phone}</span>
                      )}
                      <p className="text-sm text-muted-foreground mt-0.5 truncate">{reply.message_body}</p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {format(new Date(reply.messaged_at), 'MMM d, HH:mm')}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {campaign.notes && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{campaign.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
