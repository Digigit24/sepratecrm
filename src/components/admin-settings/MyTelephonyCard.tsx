// src/components/admin-settings/MyTelephonyCard.tsx
import React, { useState, useEffect } from 'react';
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
  Loader2,
  Save,
  Phone,
  RefreshCw,
  Pencil,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTelephony } from '@/hooks/useTelephony';
import { TelephonyApiError } from '@/services/telephonyService';
import type {
  TeleCMIAgentCreateData,
  TeleCMIAgentUpdateData,
} from '@/types/telephony.types';

const TELEPHONY_MODULE = 'telephony';
const PASSWORD_PLACEHOLDER = '•••• set';

export const MyTelephonyCard: React.FC = () => {
  const { user, hasModuleAccess } = useAuth();
  const userId = user?.id ?? undefined;

  const { useMyAgent, createAgent, updateAgent, refreshToken } = useTelephony();
  const { agent, isLoading, mutate } = useMyAgent(userId);
  const hasAgent = !!agent;

  // ---------- form state ----------
  const [telecmiUserId, setTelecmiUserId] = useState('');
  const [password, setPassword] = useState(''); // blank => unchanged
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Prefill from the fetched agent. Password is write-only → stays blank.
  useEffect(() => {
    if (agent) {
      setTelecmiUserId(agent.telecmi_user_id || '');
      setPassword('');
      setIsEditing(false);
    } else {
      setIsEditing(true); // no record yet → start in entry mode
    }
  }, [agent]);

  // Hide the card entirely when the telephony module is not enabled.
  if (!hasModuleAccess(TELEPHONY_MODULE)) return null;

  // ---------- save (create or update) ----------
  const handleSave = async () => {
    if (!telecmiUserId.trim()) {
      toast.error('TeleCMI User ID is required');
      return;
    }
    if (!userId) {
      toast.error('Could not determine your user — please re-login');
      return;
    }

    setIsSaving(true);
    try {
      if (hasAgent && agent) {
        const payload: TeleCMIAgentUpdateData = { telecmi_user_id: telecmiUserId.trim() };
        if (password.trim()) payload.password = password.trim();
        await updateAgent(agent.id, payload);
      } else {
        if (!password.trim()) {
          toast.error('Password is required to register your TeleCMI agent');
          setIsSaving(false);
          return;
        }
        const payload: TeleCMIAgentCreateData = {
          user_id: userId,
          telecmi_user_id: telecmiUserId.trim(),
          password: password.trim(),
        };
        await createAgent(payload);
      }
      setPassword('');
      setIsEditing(false);
      await mutate();
    } catch {
      // toast already shown by the hook.
    } finally {
      setIsSaving(false);
    }
  };

  // ---------- refresh token ----------
  const handleRefreshToken = async () => {
    setIsRefreshing(true);
    try {
      await refreshToken();
      await mutate(); // refresh token_is_fresh
    } catch {
      // toast already shown (424 => "Set up telephony in Settings").
    } finally {
      setIsRefreshing(false);
    }
  };

  const telecmiUserIdLocked = hasAgent && !isEditing;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            <CardTitle>My Telephony</CardTitle>
          </div>
          {hasAgent && (
            <Badge
              variant={agent?.token_is_fresh ? 'default' : 'secondary'}
              className={
                agent?.token_is_fresh
                  ? 'bg-green-600 hover:bg-green-600'
                  : 'bg-amber-500 hover:bg-amber-500 text-white'
              }
            >
              {agent?.token_is_fresh ? 'Token fresh' : 'Token stale'}
            </Badge>
          )}
        </div>
        <CardDescription>
          Register your personal TeleCMI credentials so you can make and receive calls. These are
          tied to your user account only.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading && !agent ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="my-telecmi-user-id">TeleCMI User ID</Label>
                  {telecmiUserIdLocked && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => setIsEditing(true)}
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                  )}
                </div>
                <Input
                  id="my-telecmi-user-id"
                  placeholder="e.g. 103_1111112"
                  value={telecmiUserId}
                  onChange={(e) => setTelecmiUserId(e.target.value)}
                  disabled={telecmiUserIdLocked}
                />
                <p className="text-xs text-muted-foreground">
                  Format: <span className="font-mono">{'<extension>_<appid>'}</span>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="my-telecmi-password">Password</Label>
                <Input
                  id="my-telecmi-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder={hasAgent ? PASSWORD_PLACEHOLDER : 'Your TeleCMI password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  {hasAgent
                    ? 'Stored securely. Leave blank to keep your current password.'
                    : 'Write-only. Stored encrypted — never shown again.'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              {hasAgent ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefreshToken}
                  disabled={isRefreshing}
                >
                  {isRefreshing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Refresh Token
                </Button>
              ) : (
                <span />
              )}

              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {hasAgent ? 'Save Changes' : 'Register Agent'}
              </Button>
            </div>

            <Separator />

            <WebRTCReadinessRow enabled={hasModuleAccess(TELEPHONY_MODULE)} />
          </>
        )}
      </CardContent>
    </Card>
  );
};

// ==================== WebRTC readiness ====================

interface WebRTCReadinessRowProps {
  enabled: boolean;
}

const WebRTCReadinessRow: React.FC<WebRTCReadinessRowProps> = ({ enabled }) => {
  const { useWebRTCConfig } = useTelephony();
  const { data, error, isLoading } = useWebRTCConfig(enabled);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking in-browser calling readiness…
      </div>
    );
  }

  // 424 (or any error) => not configured yet.
  const notConfigured =
    !data || (error instanceof TelephonyApiError ? true : !!error);

  if (notConfigured) {
    return (
      <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <p className="text-sm">
          Not configured — finish setup above (or ask an admin to connect TeleCMI in Telephony
          settings).
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 p-3 rounded-lg border border-green-300 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300">
      <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
      <div className="text-sm">
        <p className="font-medium">Ready for in-browser calls</p>
        <p className="text-xs mt-0.5 text-green-700/80 dark:text-green-300/80">
          SBC host: <span className="font-mono">{data.sbc_host}</span>
          {data.default_caller_id ? (
            <>
              {' · '}Caller ID: <span className="font-mono">{data.default_caller_id}</span>
            </>
          ) : null}
        </p>
      </div>
    </div>
  );
};
