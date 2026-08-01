// src/pages/telephony/CampaignsPage.tsx
// Auto-dialler campaign manager — create, edit, toggle, delete, push leads.
// RBAC-gated via ModuleProtectedRoute (requiredPermission="telephony.campaigns.view") in App.tsx.
import React, { useState } from 'react';
import useSWR from 'swr';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Megaphone,
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  Play,
  Pause,
  Users,
  Loader2,
  AlertCircle,
  Upload,
  Clock,
  Calendar,
  Info,
  Target,
  PhoneCall,
  Layers,
  RefreshCcw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { toast } from 'sonner';
import { telephonyService } from '@/services/telephonyService';
import {
  CampaignRingRule,
  type TeleCMICampaign,
  type TeleCMICampaignCreateData,
} from '@/types/telephony.types';
import { useUsers } from '@/hooks/useUsers';
import { useCRM } from '@/hooks/useCRM';
import { telephonyBadgeClass, telephonyDotClass, campaignActiveTone, campaignActiveLabel } from '@/lib/telephonyBadge';
import { cn } from '@/lib/utils';
import { SideDrawer, type DrawerActionButton } from '@/components/SideDrawer';

// ── constants ─────────────────────────────────────────────────────────────────

const RING_RULE_LABELS: Record<string, string> = {
  [CampaignRingRule.RING_ALL]: 'Ring All',
  [CampaignRingRule.ROUND_ROBIN]: 'Round Robin',
};

const TIMEZONES = [
  'Asia/Kolkata',
  'Asia/Dubai',
  'UTC',
  'America/New_York',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
];

// ── helpers ───────────────────────────────────────────────────────────────────

const fmtDate = (d: string) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch {
    return d;
  }
};

const emptyForm = (): TeleCMICampaignCreateData => ({
  name: '',
  timezone: 'Asia/Kolkata',
  start_date: '',
  end_date: '',
  start_time: '09:00',
  end_time: '18:00',
  call_interval: 30,
  ring_rule: CampaignRingRule.ROUND_ROBIN,
  agent_user_ids: [],
  notes: '',
  source_group_id: null,
});

// ── Campaign Form ─────────────────────────────────────────────────────────────

interface CampaignFormProps {
  form: TeleCMICampaignCreateData;
  onChange: (patch: Partial<TeleCMICampaignCreateData>) => void;
  agentOptions: { id: string; label: string }[];
}

const CampaignForm: React.FC<CampaignFormProps> = ({ form, onChange, agentOptions }) => {
  const { useLeadGroups } = useCRM();
  const { data: groupsData } = useLeadGroups({ page_size: 100 });
  const groups = groupsData?.results || [];

  const toggleAgent = (id: string) => {
    const current = form.agent_user_ids || [];
    const next = current.includes(id)
      ? current.filter((a) => a !== id)
      : [...current, id];
    onChange({ agent_user_ids: next });
  };

  return (
    <div className="space-y-5">
      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="cf-name">
          Campaign Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="cf-name"
          placeholder="Q3 Lead Outreach"
          value={form.name || ''}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </div>

      <Separator />

      {/* Source group */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1">
          <Label htmlFor="cf-source-group" className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5" /> Source Group
          </Label>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-3 w-3 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="text-xs max-w-[220px]">
              Leads come from this CRM Group. Use "Sync from Group" on the campaign to push its current members into the dialer.
            </TooltipContent>
          </Tooltip>
        </div>
        <Select
          value={form.source_group_id != null ? String(form.source_group_id) : 'none'}
          onValueChange={(v) => onChange({ source_group_id: v === 'none' ? null : parseInt(v, 10) })}
        >
          <SelectTrigger id="cf-source-group">
            <SelectValue placeholder="No source group" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No source group (manual lead IDs only)</SelectItem>
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
      </div>

      <Separator />

      {/* Date range */}
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" /> Schedule
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="cf-start-date">Start Date</Label>
            <Input
              id="cf-start-date"
              type="date"
              value={form.start_date || ''}
              onChange={(e) => onChange({ start_date: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cf-end-date">End Date</Label>
            <Input
              id="cf-end-date"
              type="date"
              value={form.end_date || ''}
              onChange={(e) => onChange({ end_date: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cf-start-time">Daily Start</Label>
            <Input
              id="cf-start-time"
              type="time"
              value={form.start_time || '09:00'}
              onChange={(e) => onChange({ start_time: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cf-end-time">Daily End</Label>
            <Input
              id="cf-end-time"
              type="time"
              value={form.end_time || '18:00'}
              onChange={(e) => onChange({ end_time: e.target.value })}
            />
          </div>
        </div>
        <div className="mt-3">
          <Label htmlFor="cf-timezone">Timezone</Label>
          <Select
            value={form.timezone || 'Asia/Kolkata'}
            onValueChange={(v) => onChange({ timezone: v })}
          >
            <SelectTrigger id="cf-timezone" className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz} value={tz}>{tz}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Separator />

      {/* Dial settings */}
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" /> Dial Settings
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="cf-ring-rule">Ring Rule</Label>
            <Select
              value={form.ring_rule || CampaignRingRule.ROUND_ROBIN}
              onValueChange={(v) => onChange({ ring_rule: v as CampaignRingRule })}
            >
              <SelectTrigger id="cf-ring-rule">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={CampaignRingRule.ROUND_ROBIN}>Round Robin</SelectItem>
                <SelectItem value={CampaignRingRule.RING_ALL}>Ring All</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <Label htmlFor="cf-interval">Interval (sec)</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="text-xs">
                  Seconds between consecutive dial attempts (10–120s)
                </TooltipContent>
              </Tooltip>
            </div>
            <Select
              value={String(form.call_interval ?? 30)}
              onValueChange={(v) => onChange({ call_interval: parseInt(v, 10) })}
            >
              <SelectTrigger id="cf-interval">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 30, 40, 50, 60, 120].map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    {s < 60 ? `${s}s` : s === 60 ? '1 min' : '2 min'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Separator />

      {/* Agents */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> Agents
          </p>
          <span className="text-xs text-muted-foreground">
            {(form.agent_user_ids || []).length} selected
          </span>
        </div>
        {agentOptions.length === 0 ? (
          <p className="text-sm text-muted-foreground border rounded-lg p-3 text-center">
            No agents found
          </p>
        ) : (
          <div className="border rounded-lg divide-y max-h-48 overflow-y-auto">
            {agentOptions.map((a) => (
              <label
                key={a.id}
                htmlFor={`agent-${a.id}`}
                className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <Checkbox
                  id={`agent-${a.id}`}
                  checked={(form.agent_user_ids || []).includes(a.id)}
                  onCheckedChange={() => toggleAgent(a.id)}
                />
                <span className="text-sm">{a.label}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label htmlFor="cf-notes">Notes</Label>
        <Textarea
          id="cf-notes"
          placeholder="Internal notes about this campaign…"
          rows={3}
          value={form.notes || ''}
          onChange={(e) => onChange({ notes: e.target.value })}
          className="resize-none"
        />
      </div>
    </div>
  );
};

// ── Push Leads Dialog ─────────────────────────────────────────────────────────

interface PushLeadsDialogProps {
  campaign: TeleCMICampaign | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
}

const PushLeadsDialog: React.FC<PushLeadsDialogProps> = ({
  campaign, open, onOpenChange, onDone,
}) => {
  const [text, setText] = useState('');
  const [pushing, setPushing] = useState(false);
  const [syncingGroup, setSyncingGroup] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const ids = text.split(/[\n,\s]+/).map((s) => s.trim()).filter(Boolean);
  const sourceGroup = campaign?.source_group ?? null;

  const handleSyncFromGroup = async () => {
    if (!campaign || !sourceGroup) return;
    setSyncingGroup(true);
    try {
      const result = await telephonyService.pushCampaignFromGroup(campaign.id, sourceGroup.id);
      toast.success(`${result.pushed} lead(s) synced from "${sourceGroup.name}"`);
      onOpenChange(false);
      onDone();
    } catch {
      toast.error('Failed to sync from group — check console for details');
    } finally {
      setSyncingGroup(false);
    }
  };

  const handlePush = async () => {
    if (!campaign || ids.length === 0) {
      toast.error('Enter at least one Lead ID');
      return;
    }
    setPushing(true);
    try {
      const result = await telephonyService.pushCampaignLeads(campaign.id, ids);
      toast.success(`${result.pushed} lead(s) pushed to campaign`);
      setText('');
      onOpenChange(false);
      onDone();
    } catch {
      toast.error('Failed to push leads — check console for details');
    } finally {
      setPushing(false);
    }
  };

  const busy = pushing || syncingGroup;

  const footerButtons: DrawerActionButton[] = sourceGroup
    ? [
        {
          label: 'Cancel',
          onClick: () => onOpenChange(false),
          variant: 'outline',
          disabled: busy,
        },
        {
          label: `Sync from "${sourceGroup.name}"`,
          onClick: handleSyncFromGroup,
          variant: 'default',
          loading: syncingGroup,
          disabled: busy,
          icon: RefreshCcw,
        },
      ]
    : [
        {
          label: 'Cancel',
          onClick: () => onOpenChange(false),
          variant: 'outline',
          disabled: busy,
        },
        {
          label: `Push${ids.length > 0 ? ` (${ids.length})` : ''} Leads`,
          onClick: handlePush,
          variant: 'default',
          loading: pushing,
          disabled: ids.length === 0,
          icon: Upload,
        },
      ];

  return (
    <SideDrawer
      open={open}
      onOpenChange={(o) => !busy && onOpenChange(o)}
      title="Push Leads"
      description={campaign?.name}
      size="sm"
      footerButtons={footerButtons}
      footerAlignment="right"
      storageKey="telephony-push-leads-drawer-width"
    >
      <div className="space-y-4">
        {sourceGroup ? (
          <div className="rounded-lg border bg-muted/40 p-3 space-y-1.5">
            <p className="text-xs font-medium flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-muted-foreground" />
              Source Group
            </p>
            <div className="flex items-center gap-1.5 text-sm">
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: sourceGroup.color_hex || '#6366F1' }} />
              {sourceGroup.name}
            </div>
            <p className="text-xs text-muted-foreground">
              Pushes the group's current members into this campaign's dialer queue. Safe to re-run as the group grows.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
            No Source Group set for this campaign yet. Edit the campaign to pick one, or push Lead IDs manually below.
          </div>
        )}

        <div>
          <button
            type="button"
            className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
            onClick={() => setAdvancedOpen((v) => !v)}
          >
            {advancedOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Advanced — push Lead IDs manually
          </button>
          {advancedOpen && (
            <div className="space-y-2 mt-2">
              <Textarea
                placeholder={'101, 102, 103\n104\n105'}
                rows={6}
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="font-mono text-xs resize-none"
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {ids.length} ID{ids.length !== 1 ? 's' : ''} entered
                </p>
                {sourceGroup && (
                  <Button variant="outline" size="sm" className="h-7 text-xs" disabled={ids.length === 0 || busy} onClick={handlePush}>
                    {pushing ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> : <Upload className="h-3 w-3 mr-1.5" />}
                    Push these instead
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </SideDrawer>
  );
};

// ── KPI stat card ─────────────────────────────────────────────────────────────

interface CampaignStatProps {
  label: string;
  value: string | number;
  sub: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
}

const CampaignStat: React.FC<CampaignStatProps> = ({ label, value, sub, icon: Icon, iconBg, iconColor }) => (
  <Card>
    <CardContent className="pt-4 pb-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground truncate">{label}</p>
          <p className="text-2xl font-bold mt-0.5 tabular-nums">{value}</p>
          <p className="text-xs text-muted-foreground mt-1 truncate">{sub}</p>
        </div>
        <div className={cn('p-2 rounded-lg shrink-0', iconBg)}>
          <Icon className={cn('h-4 w-4', iconColor)} />
        </div>
      </div>
    </CardContent>
  </Card>
);

// ── Campaign row ──────────────────────────────────────────────────────────────

interface CampaignRowProps {
  campaign: TeleCMICampaign;
  toggling: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPushLeads: () => void;
}

const CampaignRow: React.FC<CampaignRowProps> = ({
  campaign: c, toggling, onToggle, onEdit, onDelete, onPushLeads,
}) => {
  const leadsProgress = c.lead_count > 0
    ? Math.round((c.leads_called / c.lead_count) * 100)
    : 0;

  return (
    <TableRow>
      {/* Name */}
      <TableCell className="min-w-[160px]">
        <div>
          <p className="text-sm font-medium">{c.name}</p>
          {c.source_group && (
            <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
              <Layers className="h-2.5 w-2.5" />
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: c.source_group.color_hex || '#6366F1' }}
              />
              {c.source_group.name}
            </p>
          )}
          {c.telecmi_campaign_id && (
            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
              ID: {c.telecmi_campaign_id}
            </p>
          )}
        </div>
      </TableCell>

      {/* Status */}
      <TableCell>
        <Badge variant="secondary" className={telephonyBadgeClass(campaignActiveTone(c.is_active))}>
          <span className={cn('h-1.5 w-1.5 rounded-full mr-1.5 inline-block', telephonyDotClass(campaignActiveTone(c.is_active)))} />
          {campaignActiveLabel(c.is_active)}
        </Badge>
      </TableCell>

      {/* Dates */}
      <TableCell className="hidden md:table-cell text-xs text-muted-foreground whitespace-nowrap">
        {fmtDate(c.start_date)}
        <span className="mx-1 text-muted-foreground/50">→</span>
        {fmtDate(c.end_date)}
      </TableCell>

      {/* Ring rule */}
      <TableCell className="hidden lg:table-cell text-xs">
        {RING_RULE_LABELS[c.ring_rule] || c.ring_rule}
      </TableCell>

      {/* Interval */}
      <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
        {c.call_interval}s
      </TableCell>

      {/* Agents */}
      <TableCell className="hidden md:table-cell text-right">
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="h-3 w-3" />
          {(c.agent_user_ids || []).length}
        </span>
      </TableCell>

      {/* Leads progress */}
      <TableCell className="hidden md:table-cell w-[120px]">
        {c.lead_count > 0 ? (
          <div>
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-medium tabular-nums">{c.leads_called}</span>
              <span className="text-muted-foreground tabular-nums">/{c.lead_count}</span>
            </div>
            <Progress value={leadsProgress} className="h-1.5" />
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">No leads</span>
        )}
      </TableCell>

      {/* Actions */}
      <TableCell>
        <div className="flex items-center justify-end gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onPushLeads}
              >
                <Upload className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="text-xs">Push leads</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onToggle}
                disabled={toggling}
              >
                {toggling
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : c.is_active
                    ? <Pause className="h-3.5 w-3.5" />
                    : <Play className="h-3.5 w-3.5" />
                }
              </Button>
            </TooltipTrigger>
            <TooltipContent className="text-xs">
              {c.is_active ? 'Pause' : 'Activate'}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="text-xs">Edit</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                onClick={onDelete}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="text-xs">Delete</TooltipContent>
          </Tooltip>
        </div>
      </TableCell>
    </TableRow>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

export const CampaignsPage: React.FC = () => {
  const { useUsersList } = useUsers();
  const { data: usersData } = useUsersList({ page_size: 100 });

  const agentOptions = (usersData?.results || []).map((u) => ({
    id: String(u.id),
    label: u.full_name || `${u.first_name} ${u.last_name}`.trim() || u.email,
  }));

  const { data, isLoading, error, mutate } = useSWR(
    'telephony-campaigns',
    () => telephonyService.getCampaigns(),
    { revalidateOnFocus: false },
  );

  const campaigns = data?.results || [];
  const activeCnt = campaigns.filter((c) => c.is_active).length;
  const totalLeadsQueued = campaigns.reduce((sum, c) => sum + (c.lead_count || 0), 0);
  const totalLeadsCalled = campaigns.reduce((sum, c) => sum + (c.leads_called || 0), 0);

  // ── create ──
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<TeleCMICampaignCreateData>(emptyForm());
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!createForm.name?.trim()) { toast.error('Campaign name is required'); return; }
    setCreating(true);
    try {
      await telephonyService.createCampaign(createForm);
      toast.success('Campaign created');
      setCreateOpen(false);
      setCreateForm(emptyForm());
      await mutate();
    } catch {
      toast.error('Failed to create campaign');
    } finally {
      setCreating(false);
    }
  };

  // ── edit ──
  const [editTarget, setEditTarget] = useState<TeleCMICampaign | null>(null);
  const [editForm, setEditForm] = useState<TeleCMICampaignCreateData>(emptyForm());
  const [saving, setSaving] = useState(false);

  const openEdit = (c: TeleCMICampaign) => {
    setEditTarget(c);
    setEditForm({
      name: c.name,
      timezone: c.timezone,
      start_date: c.start_date,
      end_date: c.end_date,
      start_time: c.start_time,
      end_time: c.end_time,
      call_interval: c.call_interval,
      ring_rule: c.ring_rule,
      agent_user_ids: c.agent_user_ids,
      notes: c.notes,
      source_group_id: c.source_group?.id ?? null,
    });
  };

  const handleSave = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      await telephonyService.updateCampaign(editTarget.id, editForm);
      toast.success('Campaign updated');
      setEditTarget(null);
      await mutate();
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // ── toggle ──
  const [toggling, setToggling] = useState<number | null>(null);

  const handleToggle = async (c: TeleCMICampaign) => {
    setToggling(c.id);
    try {
      await telephonyService.toggleCampaignActive(c.id);
      toast.success(c.is_active ? 'Campaign paused' : 'Campaign activated');
      await mutate();
    } catch {
      toast.error('Toggle failed');
    } finally {
      setToggling(null);
    }
  };

  // ── delete ──
  const [deleteTarget, setDeleteTarget] = useState<TeleCMICampaign | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await telephonyService.deleteCampaign(deleteTarget.id);
      toast.success('Campaign deleted');
      setDeleteTarget(null);
      await mutate();
    } catch {
      toast.error('Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  // ── push leads ──
  const [pushTarget, setPushTarget] = useState<TeleCMICampaign | null>(null);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-muted-foreground" />
            Campaigns
          </h1>
          {!isLoading && campaigns.length > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {campaigns.length} total · {activeCnt} active
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => mutate()}
            disabled={isLoading}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
            <span className="hidden sm:inline text-xs">Refresh</span>
          </Button>
          <Button
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => { setCreateForm(emptyForm()); setCreateOpen(true); }}
          >
            <Plus className="h-3.5 w-3.5" />
            New Campaign
          </Button>
        </div>
      </div>

      {/* ── KPI Stats ───────────────────────────────────────────────── */}
      {!isLoading && campaigns.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <CampaignStat
            label="Total Campaigns"
            value={campaigns.length}
            sub={`${activeCnt} active now`}
            icon={Megaphone}
            iconBg="bg-slate-100 dark:bg-slate-500/10"
            iconColor="text-slate-600 dark:text-slate-400"
          />
          <CampaignStat
            label="Active"
            value={activeCnt}
            sub={`${campaigns.length - activeCnt} paused`}
            icon={Play}
            iconBg="bg-green-100 dark:bg-green-500/10"
            iconColor="text-green-600 dark:text-green-400"
          />
          <CampaignStat
            label="Leads Queued"
            value={totalLeadsQueued}
            sub="across all campaigns"
            icon={Target}
            iconBg="bg-blue-100 dark:bg-blue-500/10"
            iconColor="text-blue-600 dark:text-blue-400"
          />
          <CampaignStat
            label="Leads Dialled"
            value={totalLeadsCalled}
            sub={totalLeadsQueued > 0 ? `${Math.round((totalLeadsCalled / totalLeadsQueued) * 100)}% of queue` : 'no leads yet'}
            icon={PhoneCall}
            iconBg="bg-amber-100 dark:bg-amber-500/10"
            iconColor="text-amber-600 dark:text-amber-400"
          />
        </div>
      )}

      {/* ── Table ───────────────────────────────────────────────────── */}
      <Card>
        <CardContent className="p-0">
          {error ? (
            <div className="flex flex-col items-center gap-2 py-12">
              <AlertCircle className="h-6 w-6 text-destructive" />
              <p className="text-sm text-destructive font-medium">Failed to load campaigns</p>
              <Button variant="outline" size="sm" onClick={() => mutate()}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Retry
              </Button>
            </div>
          ) : isLoading ? (
            <div className="flex justify-center items-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16">
              <div className="p-4 rounded-full bg-muted">
                <Megaphone className="h-8 w-8 text-muted-foreground/40" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">No campaigns yet</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Create a campaign to start auto-dialling leads.
                </p>
              </div>
              <Button
                size="sm"
                className="mt-1 gap-1.5"
                onClick={() => { setCreateForm(emptyForm()); setCreateOpen(true); }}
              >
                <Plus className="h-3.5 w-3.5" />
                Create Campaign
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Dates</TableHead>
                  <TableHead className="hidden lg:table-cell">Ring Rule</TableHead>
                  <TableHead className="hidden lg:table-cell">Interval</TableHead>
                  <TableHead className="hidden md:table-cell text-right">Agents</TableHead>
                  <TableHead className="hidden md:table-cell w-[120px]">Leads</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns.map((c) => (
                  <CampaignRow
                    key={c.id}
                    campaign={c}
                    toggling={toggling === c.id}
                    onToggle={() => handleToggle(c)}
                    onEdit={() => openEdit(c)}
                    onDelete={() => setDeleteTarget(c)}
                    onPushLeads={() => setPushTarget(c)}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ── Create Drawer ───────────────────────────────────────────── */}
      <SideDrawer
        open={createOpen}
        onOpenChange={(o) => !creating && setCreateOpen(o)}
        title="New Campaign"
        description="Set up a new outbound calling campaign backed by TeleCMI."
        mode="create"
        size="md"
        storageKey="telephony-campaign-drawer-width"
        footerButtons={[
          {
            label: 'Cancel',
            onClick: () => setCreateOpen(false),
            variant: 'outline',
            disabled: creating,
          },
          {
            label: 'Create Campaign',
            onClick: handleCreate,
            variant: 'default',
            loading: creating,
            disabled: !createForm.name?.trim(),
            icon: Plus,
          },
        ]}
        footerAlignment="right"
      >
        <CampaignForm
          form={createForm}
          onChange={(p) => setCreateForm((prev) => ({ ...prev, ...p }))}
          agentOptions={agentOptions}
        />
      </SideDrawer>

      {/* ── Edit Drawer ──────────────────────────────────────────────── */}
      <SideDrawer
        open={!!editTarget}
        onOpenChange={(o) => !o && !saving && setEditTarget(null)}
        title="Edit Campaign"
        description={editTarget?.name}
        mode="edit"
        size="md"
        storageKey="telephony-campaign-drawer-width"
        footerButtons={[
          {
            label: 'Cancel',
            onClick: () => setEditTarget(null),
            variant: 'outline',
            disabled: saving,
          },
          {
            label: 'Save Changes',
            onClick: handleSave,
            variant: 'default',
            loading: saving,
          },
        ]}
        footerAlignment="right"
      >
        {editTarget && (
          <CampaignForm
            form={editForm}
            onChange={(p) => setEditForm((prev) => ({ ...prev, ...p }))}
            agentOptions={agentOptions}
          />
        )}
      </SideDrawer>

      {/* ── Delete Confirm ───────────────────────────────────────────── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && !deleting && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget?.name}</strong> and remove it from
              TeleCMI. Any already-dialled leads will retain their call records in your CRM.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete Campaign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Push Leads ───────────────────────────────────────────────── */}
      <PushLeadsDialog
        campaign={pushTarget}
        open={!!pushTarget}
        onOpenChange={(o) => !o && setPushTarget(null)}
        onDone={() => mutate()}
      />
    </div>
  );
};

export default CampaignsPage;
