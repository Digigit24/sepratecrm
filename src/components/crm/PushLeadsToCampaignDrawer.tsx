// src/components/crm/PushLeadsToCampaignDrawer.tsx
// Bulk "Push to Campaign" action from the Leads list. Leads-to-campaign
// always goes through a CRM Group (the existing many-to-many source of
// truth) rather than a bespoke lead-picker: this drawer adds the selected
// leads to a group (existing or new), then syncs that group into an
// existing or brand-new campaign.
import { useState } from 'react';
import useSWR from 'swr';
import { toast } from 'sonner';
import { Loader2, Layers, Megaphone, Plus } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { SideDrawer, type DrawerActionButton } from '@/components/SideDrawer';
import { useCRM } from '@/hooks/useCRM';
import { telephonyService } from '@/services/telephonyService';

interface PushLeadsToCampaignDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadIds: number[];
  onDone: () => void;
}

export function PushLeadsToCampaignDrawer({ open, onOpenChange, leadIds, onDone }: PushLeadsToCampaignDrawerProps) {
  const { useLeadGroups, createLeadGroup, addLeadsToGroup } = useCRM();
  const { data: groupsData } = useLeadGroups({ page_size: 100 });
  const groups = groupsData?.results || [];

  const { data: campaignsData } = useSWR(
    open ? 'telephony-campaigns-for-push' : null,
    () => telephonyService.getCampaigns(),
    { revalidateOnFocus: false },
  );
  const campaigns = campaignsData?.results || [];

  const [groupMode, setGroupMode] = useState<'existing' | 'new'>('existing');
  const [groupId, setGroupId] = useState<number | null>(null);
  const [newGroupName, setNewGroupName] = useState('');

  const [campaignMode, setCampaignMode] = useState<'existing' | 'new'>('existing');
  const [campaignId, setCampaignId] = useState<number | null>(null);
  const [newCampaignName, setNewCampaignName] = useState('');

  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setGroupMode('existing');
    setGroupId(null);
    setNewGroupName('');
    setCampaignMode('existing');
    setCampaignId(null);
    setNewCampaignName('');
  };

  const canSubmit =
    leadIds.length > 0 &&
    (groupMode === 'existing' ? groupId !== null : newGroupName.trim().length > 0) &&
    (campaignMode === 'existing' ? campaignId !== null : newCampaignName.trim().length > 0);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      // 1. Resolve the target group (create it if the rep typed a new name).
      let resolvedGroupId = groupId;
      let resolvedGroupName = groups.find((g) => g.id === groupId)?.name || '';
      if (groupMode === 'new') {
        const created = await createLeadGroup({ name: newGroupName.trim() });
        resolvedGroupId = created.id;
        resolvedGroupName = created.name;
      }
      if (!resolvedGroupId) throw new Error('Could not resolve target group');

      // 2. Make sure the selected leads are members of that group.
      await addLeadsToGroup(resolvedGroupId, leadIds);

      // 3. Resolve the target campaign (create it seeded from the group, or
      //    re-point an existing campaign's source group if it differs).
      let resolvedCampaignId = campaignId;
      if (campaignMode === 'new') {
        const created = await telephonyService.createCampaign({
          name: newCampaignName.trim(),
          source_group_id: resolvedGroupId,
        });
        resolvedCampaignId = created.id;
      } else if (resolvedCampaignId) {
        const target = campaigns.find((c) => c.id === resolvedCampaignId);
        if (target && target.source_group?.id !== resolvedGroupId) {
          await telephonyService.updateCampaign(resolvedCampaignId, { source_group_id: resolvedGroupId });
        }
      }
      if (!resolvedCampaignId) throw new Error('Could not resolve target campaign');

      // 4. Sync the group's members (now including the selection) into the dialer.
      const result = await telephonyService.pushCampaignFromGroup(resolvedCampaignId, resolvedGroupId);
      toast.success(`${result.pushed} lead(s) synced to campaign via "${resolvedGroupName}"`);
      reset();
      onOpenChange(false);
      onDone();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to push leads to campaign');
    } finally {
      setSubmitting(false);
    }
  };

  const footerButtons: DrawerActionButton[] = [
    { label: 'Cancel', onClick: () => onOpenChange(false), variant: 'outline', disabled: submitting },
    {
      label: 'Push to Campaign',
      onClick: handleSubmit,
      variant: 'default',
      loading: submitting,
      disabled: !canSubmit,
      icon: Megaphone,
    },
  ];

  return (
    <SideDrawer
      open={open}
      onOpenChange={(o) => { if (!submitting) { onOpenChange(o); if (!o) reset(); } }}
      title="Push to Campaign"
      description={`${leadIds.length} lead${leadIds.length !== 1 ? 's' : ''} selected`}
      size="sm"
      footerButtons={footerButtons}
      footerAlignment="right"
      storageKey="push-leads-to-campaign-drawer-width"
    >
      <div className="space-y-5">
        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" /> Group
          </Label>
          <Tabs value={groupMode} onValueChange={(v) => setGroupMode(v as 'existing' | 'new')}>
            <TabsList className="w-full h-8 bg-muted/50 p-0.5 rounded-lg">
              <TabsTrigger value="existing" className="flex-1 text-xs h-full">Existing</TabsTrigger>
              <TabsTrigger value="new" className="flex-1 text-xs h-full">New group</TabsTrigger>
            </TabsList>
            <TabsContent value="existing" className="mt-2">
              <Select value={groupId != null ? String(groupId) : ''} onValueChange={(v) => setGroupId(parseInt(v, 10))}>
                <SelectTrigger><SelectValue placeholder="Select a group" /></SelectTrigger>
                <SelectContent>
                  {groups.length === 0 && (
                    <SelectItem value="__none" disabled>No groups yet — create one</SelectItem>
                  )}
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={String(g.id)}>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: g.color_hex || '#6366F1' }} />
                        {g.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TabsContent>
            <TabsContent value="new" className="mt-2">
              <Input placeholder="e.g. Q3 Outreach — hot leads" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} />
            </TabsContent>
          </Tabs>
          <p className="text-xs text-muted-foreground">
            Selected leads are added to this group (existing memberships are kept).
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Megaphone className="h-3.5 w-3.5" /> Campaign
          </Label>
          <Tabs value={campaignMode} onValueChange={(v) => setCampaignMode(v as 'existing' | 'new')}>
            <TabsList className="w-full h-8 bg-muted/50 p-0.5 rounded-lg">
              <TabsTrigger value="existing" className="flex-1 text-xs h-full">Existing</TabsTrigger>
              <TabsTrigger value="new" className="flex-1 text-xs h-full gap-1">
                <Plus className="h-3 w-3" /> New campaign
              </TabsTrigger>
            </TabsList>
            <TabsContent value="existing" className="mt-2">
              <Select value={campaignId != null ? String(campaignId) : ''} onValueChange={(v) => setCampaignId(parseInt(v, 10))}>
                <SelectTrigger><SelectValue placeholder="Select a campaign" /></SelectTrigger>
                <SelectContent>
                  {campaigns.length === 0 && (
                    <SelectItem value="__none" disabled>No campaigns yet — create one</SelectItem>
                  )}
                  {campaigns.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {campaignId != null && campaigns.find((c) => c.id === campaignId)?.source_group && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  Currently synced from "{campaigns.find((c) => c.id === campaignId)?.source_group?.name}" — will be re-pointed to the group above.
                </p>
              )}
            </TabsContent>
            <TabsContent value="new" className="mt-2">
              <Input placeholder="e.g. Q3 Lead Outreach" value={newCampaignName} onChange={(e) => setNewCampaignName(e.target.value)} />
              <p className="text-xs text-muted-foreground mt-1.5">
                Creates the campaign with default dial settings — fine-tune schedule/agents afterwards from Campaigns.
              </p>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </SideDrawer>
  );
}
