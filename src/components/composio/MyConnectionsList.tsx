// src/components/composio/MyConnectionsList.tsx
//
// "My connections": the caller's live Composio connections with status,
// last-synced info and per-row actions. Reconnect reuses the same connect flow
// as the catalogue (via ConnectToolkitDialog in reconnect mode), so link
// expiry, popup blocking and OAuth cancellation behave identically here.

import { useState } from 'react';
import { AlertCircle, Info, Plug, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ConnectionCard } from '@/components/composio/ConnectionCard';
import { ConnectToolkitDialog } from '@/components/composio/ConnectToolkitDialog';
import { DisconnectConfirmDialog } from '@/components/composio/DisconnectConfirmDialog';
import { useComposio } from '@/hooks/useComposio';
import {
  getComposioErrorMessage,
  isComposioForbidden,
  isComposioNotReady,
  isComposioUnconfigured,
} from '@/services/composioService';
import { FEATURED_TOOLKIT_LABELS } from '@/types/composio.types';
import type { ComposioConnection, ComposioToolkit } from '@/types/composio.types';

const toolkitOf = (connection: ComposioConnection | null): ComposioToolkit | null => {
  if (!connection) return null;
  const slug = connection.toolkit_slug || connection.toolkit?.slug || '';
  return {
    slug,
    name:
      connection.toolkit?.name || FEATURED_TOOLKIT_LABELS[slug.toUpperCase()] || slug || 'Connection',
    logo_url: connection.toolkit?.logo_url ?? null,
  };
};

interface MyConnectionsListProps {
  /** Switch the parent to the catalogue tab from the empty state. */
  onBrowseApps?: () => void;
}

export const MyConnectionsList = ({ onBrowseApps }: MyConnectionsListProps) => {
  const { useConnections, disconnect, enableConnection, disableConnection } = useComposio();
  const { data, error, isLoading, mutate } = useConnections();

  const [pending, setPending] = useState<{ id: string; action: 'disconnect' | 'toggle' } | null>(null);
  const [reconnectTarget, setReconnectTarget] = useState<ComposioConnection | null>(null);
  const [disconnectTarget, setDisconnectTarget] = useState<ComposioConnection | null>(null);

  const connections = data?.results ?? [];

  // SWR's bound `mutate()` rejects when the fetcher throws. Without a catch that
  // becomes an unhandled promise rejection on every Try Again click while the
  // backend endpoints are still missing — the rendered `error` already tells the
  // user what happened.
  const retry = () => {
    void mutate().catch(() => undefined);
  };

  const handleReconnect = (connection: ComposioConnection) => setReconnectTarget(connection);

  const handleToggleEnabled = async (connection: ComposioConnection, enable: boolean) => {
    setPending({ id: connection.public_id, action: 'toggle' });
    try {
      if (enable) await enableConnection(connection.public_id);
      else await disableConnection(connection.public_id);
      toast.success(enable ? 'Connection enabled' : 'Connection disabled');
    } catch (err) {
      toast.error(getComposioErrorMessage(err, 'Could not update the connection'));
    } finally {
      setPending(null);
    }
  };

  const handleConfirmDisconnect = async () => {
    if (!disconnectTarget) return;
    const target = disconnectTarget;
    setPending({ id: target.public_id, action: 'disconnect' });
    try {
      await disconnect(target.public_id);
      const label = toolkitOf(target)?.name ?? 'App';
      toast.success(`${label} disconnected`);
      setDisconnectTarget(null);
    } catch (err) {
      toast.error(getComposioErrorMessage(err, 'Could not disconnect'));
    } finally {
      setPending(null);
    }
  };

  if (isLoading && !data) {
    return (
      <div className="space-y-2">
        {[...Array(3)].map((_, index) => (
          <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-2">
              <Skeleton className="h-8 w-8 rounded" />
              <div>
                <Skeleton className="h-4 w-28 mb-1" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
            <Skeleton className="h-7 w-20" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    if (isComposioUnconfigured(error) || isComposioNotReady(error)) {
      return (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle className="text-sm">Connected apps aren't available yet</AlertTitle>
          <AlertDescription className="text-xs">
            {isComposioUnconfigured(error)
              ? 'Connected apps aren’t set up for this workspace yet. Ask an administrator to configure Composio.'
              : 'This workspace is running a build of the API that doesn’t include connected apps yet.'}
          </AlertDescription>
        </Alert>
      );
    }

    if (isComposioForbidden(error)) {
      return (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="text-sm">You don't have access to connections</AlertTitle>
          <AlertDescription className="text-xs">
            Ask a workspace administrator to grant you the "integrations" permissions.
          </AlertDescription>
        </Alert>
      );
    }

    return (
      <div className="text-center py-8">
        <p className="text-xs text-red-500">
          {getComposioErrorMessage(error, 'Failed to load connections')}
        </p>
        <Button variant="outline" size="sm" className="mt-2 h-7 text-xs" onClick={retry}>
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {connections.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {connections.length} {connections.length === 1 ? 'connection' : 'connections'}
          </p>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={retry}
            title="Refresh connections"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {!connections.length ? (
        <div className="text-center py-8">
          <Plug className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm font-medium">No apps connected yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Connect Gmail, Notion, Google Drive or Google Calendar to get started.
          </p>
          {onBrowseApps && (
            <Button size="sm" className="mt-2 h-7 text-xs" onClick={onBrowseApps}>
              Browse apps
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {connections.map((connection) => (
            <ConnectionCard
              key={connection.public_id}
              connection={connection}
              onReconnect={handleReconnect}
              onDisconnect={setDisconnectTarget}
              onToggleEnabled={(target, enable) => void handleToggleEnabled(target, enable)}
              pendingAction={pending?.id === connection.public_id ? pending.action : null}
            />
          ))}
        </div>
      )}

      <ConnectToolkitDialog
        toolkit={toolkitOf(reconnectTarget)}
        reconnectPublicId={reconnectTarget?.public_id ?? null}
        open={!!reconnectTarget}
        onOpenChange={(open) => {
          if (!open) setReconnectTarget(null);
        }}
      />

      <DisconnectConfirmDialog
        open={!!disconnectTarget}
        onOpenChange={(open) => {
          if (!open && pending?.action !== 'disconnect') setDisconnectTarget(null);
        }}
        toolkitName={toolkitOf(disconnectTarget)?.name ?? 'this app'}
        accountLabel={disconnectTarget?.account_label}
        isPending={pending?.action === 'disconnect'}
        onConfirm={() => void handleConfirmDisconnect()}
      />
    </div>
  );
};

export default MyConnectionsList;
