// src/pages/telephony/CallerIDsPage.tsx
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Loader2, PhoneOutgoing, Check, AlertTriangle } from 'lucide-react';
import { useTelephony } from '@/hooks/useTelephony';
import { TelephonyApiError } from '@/services/telephonyService';

export const CallerIDsPage: React.FC = () => {
  const { useCallerIds, useWebRTCConfig, setCallerId } = useTelephony();
  const { data, error, isLoading, isValidating, mutate } = useCallerIds();
  const { data: webrtc } = useWebRTCConfig();

  const [customId, setCustomId] = useState('');
  const [settingId, setSettingId] = useState<string | null>(null);

  const notConfigured = error instanceof TelephonyApiError && error.isNotConfigured;
  const callerIds = data?.callerids || [];

  const handleSet = async (value: string) => {
    if (!value.trim()) return;
    setSettingId(value);
    try {
      await setCallerId({ caller_id: value.trim() });
      await mutate();
    } catch {
      // hook toasts
    } finally {
      setSettingId(null);
    }
  };

  return (
    <div className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-base font-semibold">Caller IDs</h1>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => mutate()} disabled={isValidating} title="Refresh">
          <RefreshCw className={`h-3.5 w-3.5 ${isValidating ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {notConfigured ? (
        <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <p className="text-sm">
            Telephony isn't set up for your account.{' '}
            <Link to="/admin/settings" className="underline font-medium">Open Settings</Link> to register your TeleCMI agent.
          </p>
        </div>
      ) : (
        <>
          {/* Set active for me */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Set active caller ID</CardTitle>
              <CardDescription>
                Current default:{' '}
                <span className="font-mono">{webrtc?.default_caller_id || '—'}</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="custom-caller-id">Caller ID</Label>
                  <Input
                    id="custom-caller-id"
                    placeholder="918111111111"
                    value={customId}
                    onChange={(e) => setCustomId(e.target.value)}
                  />
                </div>
                <Button onClick={() => handleSet(customId)} disabled={!customId.trim() || settingId === customId}>
                  {settingId === customId ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                  Set active
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Available caller IDs */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <PhoneOutgoing className="h-4 w-4" />
                Available caller IDs ({callerIds.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading && callerIds.length === 0 ? (
                <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              ) : callerIds.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No caller IDs available.</p>
              ) : (
                <div className="divide-y">
                  {callerIds.map((c) => {
                    const isActive = webrtc?.default_caller_id === c.callerid;
                    return (
                      <div key={c.callerid} className="flex items-center justify-between py-2.5">
                        <div>
                          <p className="text-sm font-medium font-mono">{c.callerid}</p>
                          <p className="text-xs text-muted-foreground">{c.name}</p>
                        </div>
                        {isActive ? (
                          <Badge className="bg-green-600 hover:bg-green-600">Active</Badge>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleSet(c.callerid)}
                            disabled={settingId === c.callerid}
                          >
                            {settingId === c.callerid ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
                            Set as active
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default CallerIDsPage;
