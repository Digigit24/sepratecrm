// src/components/admin-settings/TelephonySettingsTab.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Loader2,
  Save,
  Trash2,
  Phone,
  Webhook,
  Copy,
  Check,
  AlertCircle,
} from 'lucide-react';
import { useTelephony } from '@/hooks/useTelephony';
import { API_CONFIG } from '@/lib/apiConfig';
import {
  SbcRegion,
  SBC_REGION_OPTIONS,
  type TeleCMICredential,
  type TeleCMICredentialCreateData,
  type TeleCMICredentialUpdateData,
} from '@/types/telephony.types';

interface TelephonySettingsTabProps {
  /** Current tenant UUID — used to build the per-tenant webhook URLs. */
  tenantId: string | null;
}

const SECRET_PLACEHOLDER = '•••• set';

export const TelephonySettingsTab: React.FC<TelephonySettingsTabProps> = ({ tenantId }) => {
  const { useCredentials, createCredential, updateCredential, deleteCredential } = useTelephony();
  const { data, error, isLoading, mutate } = useCredentials();

  // The single tenant credential record (one per tenant), if it exists.
  const credential: TeleCMICredential | undefined = data?.results?.[0];
  const hasCredential = !!credential;

  // ---------- form state ----------
  const [appId, setAppId] = useState('');
  const [secret, setSecret] = useState(''); // empty => unchanged (only send when typed)
  const [sbcRegion, setSbcRegion] = useState<SbcRegion>(SbcRegion.IND);
  const [defaultCallerId, setDefaultCallerId] = useState('');
  const [webhookSecret, setWebhookSecret] = useState(''); // empty => unchanged
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Prefill from the fetched credential. Secrets are write-only and never returned,
  // so they stay blank in state and we show "•••• set" as the placeholder instead.
  useEffect(() => {
    if (credential) {
      setAppId(credential.app_id || '');
      setSbcRegion(credential.sbc_region || SbcRegion.IND);
      setDefaultCallerId(credential.default_caller_id || '');
      setSecret('');
      setWebhookSecret('');
    }
  }, [credential]);

  const selectedRegion = useMemo(
    () => SBC_REGION_OPTIONS.find((r) => r.value === sbcRegion),
    [sbcRegion],
  );

  // ---------- save (create or update) ----------
  const handleSave = async () => {
    if (!appId.trim()) {
      toast.error('App ID is required');
      return;
    }

    setIsSaving(true);
    try {
      if (hasCredential && credential) {
        // PATCH — only send fields that changed. Blank secret fields are left untouched.
        const payload: TeleCMICredentialUpdateData = {
          app_id: appId.trim(),
          sbc_region: sbcRegion,
          default_caller_id: defaultCallerId.trim() || undefined,
        };
        if (secret.trim()) payload.secret = secret.trim();
        if (webhookSecret.trim()) payload.webhook_secret = webhookSecret.trim();
        await updateCredential(credential.id, payload);
      } else {
        // POST — secret is required on create.
        if (!secret.trim()) {
          toast.error('Secret is required to connect a new TeleCMI account');
          setIsSaving(false);
          return;
        }
        const payload: TeleCMICredentialCreateData = {
          app_id: appId.trim(),
          secret: secret.trim(),
          sbc_region: sbcRegion,
        };
        if (defaultCallerId.trim()) payload.default_caller_id = defaultCallerId.trim();
        if (webhookSecret.trim()) payload.webhook_secret = webhookSecret.trim();
        await createCredential(payload);
      }
      // Clear write-only fields and refresh the list.
      setSecret('');
      setWebhookSecret('');
      await mutate();
    } catch {
      // toast already shown by the hook via toastTelephonyError.
    } finally {
      setIsSaving(false);
    }
  };

  // ---------- delete (disconnect) ----------
  const handleDelete = async () => {
    if (!credential) return;
    setIsDeleting(true);
    try {
      await deleteCredential(credential.id);
      setAppId('');
      setSecret('');
      setSbcRegion(SbcRegion.IND);
      setDefaultCallerId('');
      setWebhookSecret('');
      await mutate();
    } catch {
      // toast already shown by the hook.
    } finally {
      setIsDeleting(false);
    }
  };

  // ---------- loading / fatal error ----------
  // A 424 (not configured) is an expected empty state, not a fatal error.
  const isFatalError = !!error && !(error as { status?: number })?.status;

  if (isLoading && !data) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Connection card ─────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              <CardTitle>TeleCMI Connection</CardTitle>
            </div>
            {hasCredential && (
              <Badge variant={credential?.is_active ? 'default' : 'secondary'}>
                {credential?.is_active ? 'Connected' : 'Inactive'}
              </Badge>
            )}
          </div>
          <CardDescription>
            Connect this tenant's TeleCMI account. One connection per tenant — these credentials
            power Click-To-Call, the in-browser softphone, SMS, and call-log sync.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isFatalError && (
            <div className="flex items-center gap-2 p-4 border border-destructive rounded-lg bg-destructive/10 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p className="text-sm">Failed to load telephony credentials.</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="telecmi-app-id">App ID</Label>
              <Input
                id="telecmi-app-id"
                placeholder="e.g. 12345"
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Your TeleCMI App ID.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="telecmi-secret">App Secret</Label>
              <Input
                id="telecmi-secret"
                type="password"
                autoComplete="new-password"
                placeholder={hasCredential ? SECRET_PLACEHOLDER : 'xxxx-xxxx-xxxx-xxxx'}
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {hasCredential
                  ? 'Stored securely. Leave blank to keep the current secret.'
                  : 'Write-only. Stored encrypted — never shown again.'}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="telecmi-region">SBC Region</Label>
              <Select value={sbcRegion} onValueChange={(v) => setSbcRegion(v as SbcRegion)}>
                <SelectTrigger id="telecmi-region">
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  {SBC_REGION_OPTIONS.map((region) => (
                    <SelectItem key={region.value} value={region.value}>
                      {region.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                SBC host:{' '}
                <span className="font-mono">{selectedRegion?.host ?? '—'}</span>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="telecmi-caller-id">Default Caller ID</Label>
              <Input
                id="telecmi-caller-id"
                placeholder="+918000000000"
                value={defaultCallerId}
                onChange={(e) => setDefaultCallerId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Default outbound caller ID (optional).
              </p>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="telecmi-webhook-secret">Webhook Secret</Label>
              <Input
                id="telecmi-webhook-secret"
                type="password"
                autoComplete="new-password"
                placeholder={
                  credential?.webhook_secret ? SECRET_PLACEHOLDER : 'optional-shared-secret'
                }
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Optional. If set, TeleCMI must send it as the{' '}
                <span className="font-mono">X-Webhook-Secret</span> header on every webhook.
                {credential?.webhook_secret ? ' Leave blank to keep the current value.' : ''}
              </p>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            {hasCredential ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="text-destructive" disabled={isDeleting}>
                    {isDeleting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    Disconnect
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Disconnect TeleCMI?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This removes the tenant's TeleCMI credentials. Agents will no longer be able
                      to make calls or send SMS until the account is reconnected. Existing call logs
                      are kept.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Disconnect
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <span />
            )}

            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {hasCredential ? 'Save Changes' : 'Connect TeleCMI'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Webhook URLs card ───────────────────────────────────── */}
      <WebhookUrlsCard tenantId={tenantId} />
    </div>
  );
};

// ==================== Webhook URLs card ====================

interface WebhookUrlsCardProps {
  tenantId: string | null;
}

const WebhookUrlsCard: React.FC<WebhookUrlsCardProps> = ({ tenantId }) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Webhooks are served by the same backend as the CRM API (crmClient base).
  const base = API_CONFIG.CRM_BASE_URL.replace(/\/$/, '');
  const tid = tenantId ?? '<your-tenant-uuid>';

  const urls = [
    {
      key: 'cdr',
      label: 'CDR Webhook URL',
      hint: 'TeleCMI dashboard → Webhook → CDR',
      url: `${base}/telephony/webhook/cdr/?tenant_id=${tid}`,
    },
    {
      key: 'live',
      label: 'Live Events URL',
      hint: 'TeleCMI dashboard → Webhook → Live Events',
      url: `${base}/telephony/webhook/live/?tenant_id=${tid}`,
    },
  ];

  const handleCopy = async (key: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedKey(key);
      toast.success('Webhook URL copied');
      window.setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1500);
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Webhook className="h-5 w-5" />
          <CardTitle>Webhook URLs</CardTitle>
        </div>
        <CardDescription>
          Paste these into the TeleCMI dashboard at{' '}
          <a
            href="https://connle.telecmi.com/login"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            connle.telecmi.com
          </a>{' '}
          — CDR URL under Webhook → CDR, Live Events URL under Webhook → Live Events. This is a
          one-time setup per tenant.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!tenantId && (
          <div className="flex items-center gap-2 p-3 border border-amber-300 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300">
            <AlertCircle className="h-4 w-4" />
            <p className="text-xs">
              No tenant detected — the URLs below show a placeholder instead of your tenant UUID.
            </p>
          </div>
        )}

        {urls.map((item) => (
          <div key={item.key} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-sm">{item.label}</Label>
              <span className="text-xs text-muted-foreground">{item.hint}</span>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 text-xs bg-muted rounded-md break-all font-mono">
                {item.url}
              </code>
              <Button
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={() => handleCopy(item.key, item.url)}
                aria-label={`Copy ${item.label}`}
              >
                {copiedKey === item.key ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
