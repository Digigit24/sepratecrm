// src/components/composio/ConnectToolkitDialog.tsx
//
// Pre-flight dialog for a connect flow, plus every in-flight state the flow can
// be in (plan §D.9). Owns a `useComposioConnectFlow` instance for the lifetime
// of the dialog, so closing the dialog cancels the flow and tears down its
// timers and popup.

import { useEffect, useState } from 'react';
import { AlertTriangle, Blocks, CheckCircle2, ExternalLink, Loader2, ShieldCheck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { useComposioConnectFlow } from '@/hooks/useComposioConnectFlow';
import { ComposioConnectionScope } from '@/types/composio.types';
import type { ComposioToolkit } from '@/types/composio.types';

interface ConnectToolkitDialogProps {
  toolkit: ComposioToolkit | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once a connection reaches ACTIVE, so the parent can switch tabs. */
  onConnected?: (toolkitSlug: string) => void;
  /** Re-authorising an existing connection rather than creating a new one. */
  reconnectPublicId?: string | null;
}

export const ConnectToolkitDialog = ({
  toolkit,
  open,
  onOpenChange,
  onConnected,
  reconnectPublicId = null,
}: ConnectToolkitDialogProps) => {
  const flow = useComposioConnectFlow();
  const [alias, setAlias] = useState('');
  const [scope, setScope] = useState<ComposioConnectionScope>(ComposioConnectionScope.USER);

  const toolkitName = toolkit?.name || 'this app';

  // Reset the form (and abort any orphaned flow) whenever the dialog opens.
  useEffect(() => {
    if (open) {
      setAlias('');
      setScope(ComposioConnectionScope.USER);
      flow.reset();
    }
    // `flow.reset` is stable; re-running on every flow identity change would
    // wipe the in-flight state the dialog is rendering.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (flow.phase === 'connected' && toolkit?.slug) {
      onConnected?.(toolkit.slug);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flow.phase]);

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) flow.cancel();
    onOpenChange(nextOpen);
  };

  const handleStart = () => {
    if (!toolkit?.slug) return;
    if (reconnectPublicId) {
      void flow.reconnect(reconnectPublicId, {
        toolkitSlug: toolkit.slug,
        toolkitName: toolkit.name,
      });
      return;
    }
    void flow.connect(toolkit.slug, {
      alias: alias.trim() || undefined,
      scope,
      toolkitName: toolkit.name,
    });
  };

  const renderBody = () => {
    switch (flow.phase) {
      case 'initiating':
        return (
          <div className="py-6 text-center space-y-2">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
            <p className="text-sm font-medium">Preparing…</p>
            <p className="text-xs text-muted-foreground">Setting up a secure link to {toolkitName}.</p>
          </div>
        );

      case 'awaiting_user':
        return (
          <div className="py-6 text-center space-y-2">
            <ExternalLink className="h-6 w-6 mx-auto text-primary" />
            <p className="text-sm font-medium">Complete the sign-in in the new window.</p>
            <p className="text-xs text-muted-foreground">
              We are waiting for {toolkitName} to confirm. Do not close this dialog.
            </p>
          </div>
        );

      case 'polling':
        return (
          <div className="py-6 text-center space-y-2">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" />
            <p className="text-sm font-medium">Confirming…</p>
            <p className="text-xs text-muted-foreground">This usually takes a few seconds.</p>
          </div>
        );

      case 'connected':
        return (
          <div className="py-6 text-center space-y-2">
            <CheckCircle2 className="h-6 w-6 mx-auto text-green-600" />
            <p className="text-sm font-medium">{toolkitName} connected</p>
            <p className="text-xs text-muted-foreground">
              You can now use {toolkitName} actions across Celiyo.
            </p>
          </div>
        );

      case 'error':
        return (
          <div className="py-4 space-y-3">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                {flow.error || `We could not connect ${toolkitName}.`}
              </AlertDescription>
            </Alert>
          </div>
        );

      default:
        return (
          <div className="space-y-3 py-1">
            {!reconnectPublicId && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="composio-alias" className="text-xs">
                    Name this connection <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="composio-alias"
                    value={alias}
                    onChange={(event) => setAlias(event.target.value)}
                    placeholder={`My ${toolkitName} account`}
                    className="h-8 text-xs"
                    maxLength={120}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Who can use it</Label>
                  <RadioGroup
                    value={scope}
                    onValueChange={(value) => setScope(value as ComposioConnectionScope)}
                    className="gap-2"
                  >
                    <label className="flex items-start gap-2 border rounded-md p-2 cursor-pointer hover:bg-muted/50">
                      <RadioGroupItem value={ComposioConnectionScope.USER} className="mt-0.5" />
                      <span>
                        <span className="block text-xs font-medium">Just me</span>
                        <span className="block text-[11px] text-muted-foreground">
                          Only you can use this connection.
                        </span>
                      </span>
                    </label>
                    <label className="flex items-start gap-2 border rounded-md p-2 cursor-pointer hover:bg-muted/50">
                      <RadioGroupItem value={ComposioConnectionScope.TENANT} className="mt-0.5" />
                      <span>
                        <span className="block text-xs font-medium">Everyone in this workspace</span>
                        <span className="block text-[11px] text-muted-foreground">
                          Shared — anyone in your workspace can use it.
                        </span>
                      </span>
                    </label>
                  </RadioGroup>
                </div>

                <Separator />
              </>
            )}

            <div className="flex items-start gap-2 text-[11px] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0 text-green-600" />
              <p>
                You will sign in to {toolkitName} on their own page. Celiyo never sees your{' '}
                {toolkitName} password, and you can disconnect at any time from My connections.
              </p>
            </div>
          </div>
        );
    }
  };

  const renderFooter = () => {
    switch (flow.phase) {
      case 'initiating':
        return (
          <Button size="sm" className="h-7 text-xs" disabled>
            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
            Preparing…
          </Button>
        );

      case 'awaiting_user':
        return (
          <>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleClose(false)}>
              Cancel
            </Button>
            <Button size="sm" className="h-7 text-xs" onClick={flow.reopen} disabled={!flow.redirectUrl}>
              <ExternalLink className="h-3.5 w-3.5 mr-1" />
              Reopen window
            </Button>
          </>
        );

      case 'polling':
        return (
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleClose(false)}>
            Close
          </Button>
        );

      case 'connected':
        return (
          <Button size="sm" className="h-7 text-xs" onClick={() => handleClose(false)}>
            Done
          </Button>
        );

      case 'error':
        return (
          <>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleClose(false)}>
              Close
            </Button>
            <Button size="sm" className="h-7 text-xs" onClick={handleStart}>
              Try again
            </Button>
          </>
        );

      default:
        return (
          <>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleClose(false)}>
              Cancel
            </Button>
            <Button size="sm" className="h-7 text-xs" onClick={handleStart} disabled={!toolkit}>
              Continue to {toolkitName}
            </Button>
          </>
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm flex items-center gap-2">
            {toolkit?.logo_url ? (
              <img src={toolkit.logo_url} alt="" className="h-4 w-4 object-contain" />
            ) : (
              <Blocks className="h-4 w-4 text-muted-foreground" />
            )}
            {reconnectPublicId ? `Reconnect ${toolkitName}` : `Connect ${toolkitName}`}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {reconnectPublicId
              ? `Sign in again to restore access to ${toolkitName}.`
              : `Authorise Celiyo to act on your behalf in ${toolkitName}.`}
          </DialogDescription>
        </DialogHeader>

        {renderBody()}

        <DialogFooter className="gap-1.5">{renderFooter()}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConnectToolkitDialog;
