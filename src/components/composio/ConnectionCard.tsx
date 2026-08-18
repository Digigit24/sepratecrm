// src/components/composio/ConnectionCard.tsx
// One row in "My connections": logo, account label, status, last-synced info and
// the per-connection actions (Reconnect / Enable / Disable / Disconnect).

import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Blocks, Loader2, MoreHorizontal, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PermissionGate } from '@/components/PermissionGate';
import { ConnectionStatusBadge } from '@/components/composio/ConnectionStatusBadge';
import {
  ComposioConnectionScope,
  ComposioConnectionStatus,
  FEATURED_TOOLKIT_LABELS,
  isReconnectableComposioStatus,
} from '@/types/composio.types';
import type { ComposioConnection } from '@/types/composio.types';

/** Never render a raw ISO string — and never crash on a malformed one. */
const relativeTime = (value?: string | null): string | null => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  try {
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return null;
  }
};

interface ConnectionCardProps {
  connection: ComposioConnection;
  onReconnect: (connection: ComposioConnection) => void;
  onDisconnect: (connection: ComposioConnection) => void;
  onToggleEnabled: (connection: ComposioConnection, enable: boolean) => void;
  /** Which action, if any, is currently in flight for this row. */
  pendingAction?: 'reconnect' | 'disconnect' | 'toggle' | null;
}

export const ConnectionCard = ({
  connection,
  onReconnect,
  onDisconnect,
  onToggleEnabled,
  pendingAction = null,
}: ConnectionCardProps) => {
  const [logoFailed, setLogoFailed] = useState(false);

  const slug = connection.toolkit_slug || connection.toolkit?.slug || '';
  const name =
    connection.toolkit?.name || FEATURED_TOOLKIT_LABELS[slug.toUpperCase()] || slug || 'Connection';
  const logo = connection.toolkit?.logo_url;
  const status = connection.status;
  const isActive = status === ComposioConnectionStatus.ACTIVE;
  const needsReconnect = isReconnectableComposioStatus(status);
  const isFailed = status === ComposioConnectionStatus.FAILED;
  const busy = !!pendingAction;

  const lastUsed = relativeTime(connection.last_used_at);
  const connectedAt = relativeTime(connection.connected_at);
  const syncedLine = lastUsed
    ? `Last used ${lastUsed}`
    : connectedAt
      ? `Connected ${connectedAt}`
      : 'Not used yet';

  return (
    <div className="flex items-center justify-between gap-2 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-2 min-w-0">
        <div className="p-1.5 bg-muted rounded shrink-0">
          {logo && !logoFailed ? (
            <img
              src={logo}
              alt=""
              className="h-4 w-4 object-contain"
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <Blocks className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium truncate">{connection.alias || name}</p>
            {connection.scope === ComposioConnectionScope.TENANT && (
              <span className="text-[10px] text-muted-foreground border rounded px-1">Shared</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {connection.account_label || name}
            <span className="mx-1">·</span>
            {syncedLine}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {isFailed && connection.last_error ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <ConnectionStatusBadge status={status} />
              </span>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-xs">
              <p className="text-xs break-words">{connection.last_error}</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <ConnectionStatusBadge status={status} />
        )}

        {needsReconnect && (
          <PermissionGate permission="integrations.connections.edit">
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-xs"
              disabled={busy}
              onClick={() => onReconnect(connection)}
            >
              {pendingAction === 'reconnect' ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3 mr-1" />
              )}
              Reconnect
            </Button>
          </PermissionGate>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7" disabled={busy}>
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <MoreHorizontal className="h-3.5 w-3.5" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <PermissionGate permission="integrations.connections.edit">
              <DropdownMenuItem className="text-xs" onClick={() => onReconnect(connection)}>
                Reconnect
              </DropdownMenuItem>
              {isActive ? (
                <DropdownMenuItem
                  className="text-xs"
                  onClick={() => onToggleEnabled(connection, false)}
                >
                  Disable
                </DropdownMenuItem>
              ) : status === ComposioConnectionStatus.INACTIVE ? (
                <DropdownMenuItem className="text-xs" onClick={() => onToggleEnabled(connection, true)}>
                  Enable
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
            </PermissionGate>
            <PermissionGate
              permission="integrations.connections.delete"
              fallback={
                <DropdownMenuItem className="text-xs" disabled>
                  Disconnect
                </DropdownMenuItem>
              }
            >
              <DropdownMenuItem
                className="text-xs text-destructive focus:text-destructive"
                onClick={() => onDisconnect(connection)}
              >
                Disconnect
              </DropdownMenuItem>
            </PermissionGate>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};

export default ConnectionCard;
