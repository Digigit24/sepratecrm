// src/components/composio/ToolkitCard.tsx
// One tile in the toolkit catalogue: logo, name, description, connection status
// and the Connect / Manage action. Element-level RBAC via PermissionGate.

import { useState } from 'react';
import { Blocks, Loader2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PermissionGate } from '@/components/PermissionGate';
import { ConnectionStatusBadge } from '@/components/composio/ConnectionStatusBadge';
import { ComposioConnectionStatus, isFeaturedToolkit } from '@/types/composio.types';
import type { ComposioToolkit } from '@/types/composio.types';

interface ToolkitCardProps {
  toolkit: ComposioToolkit;
  onConnect: (toolkit: ComposioToolkit) => void;
  onManage: (toolkit: ComposioToolkit) => void;
  busy?: boolean;
}

export const ToolkitCard = ({ toolkit, onConnect, onManage, busy = false }: ToolkitCardProps) => {
  const [logoFailed, setLogoFailed] = useState(false);

  const connection = toolkit.my_connection;
  const isConnected = connection?.status === ComposioConnectionStatus.ACTIVE;
  const hasConnection = !!connection;
  // `is_connectable` may be absent on an early backend build — treat undefined
  // as connectable so the UI is usable before the field ships.
  const connectable = toolkit.is_connectable !== false;
  const featured = isFeaturedToolkit(toolkit);

  const connectButton = (
    <Button
      size="sm"
      className="w-full h-7 text-xs"
      disabled={!connectable || busy}
      onClick={() => onConnect(toolkit)}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
      {hasConnection ? 'Connect another' : 'Connect'}
    </Button>
  );

  return (
    <div className="border rounded-lg p-3 hover:shadow-sm transition-shadow flex flex-col">
      <div className="flex items-start justify-between mb-2">
        <div className="p-1.5 bg-muted rounded shrink-0">
          {toolkit.logo_url && !logoFailed ? (
            <img
              src={toolkit.logo_url}
              alt=""
              className="h-5 w-5 object-contain"
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <Blocks className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex items-center gap-1">
          {featured && !hasConnection && (
            <Star className="h-3 w-3 text-amber-500 fill-amber-400" aria-label="Recommended" />
          )}
          {hasConnection && <ConnectionStatusBadge status={connection?.status} />}
        </div>
      </div>

      <h3 className="text-sm font-medium mb-1 truncate" title={toolkit.name}>
        {toolkit.name}
      </h3>
      <p className="text-xs text-muted-foreground mb-3 line-clamp-2 min-h-[2rem]">
        {toolkit.description || 'Connect this app to use its actions in Celiyo.'}
      </p>

      {connection?.account_label && (
        <p className="text-[11px] text-muted-foreground mb-2 truncate" title={connection.account_label}>
          {connection.account_label}
        </p>
      )}

      <div className="mt-auto space-y-1.5">
        {isConnected ? (
          <Button
            variant="outline"
            size="sm"
            className="w-full h-7 text-xs"
            onClick={() => onManage(toolkit)}
          >
            Manage
          </Button>
        ) : connectable ? (
          <PermissionGate
            permission="integrations.connections.create"
            fallback={
              <Button variant="outline" size="sm" className="w-full h-7 text-xs" disabled>
                Connect
              </Button>
            }
          >
            {connectButton}
          </PermissionGate>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="block">
                <Button variant="outline" size="sm" className="w-full h-7 text-xs" disabled>
                  Connect
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="text-xs">Not available on your plan</p>
            </TooltipContent>
          </Tooltip>
        )}

        {hasConnection && !isConnected && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-6 text-[11px] text-muted-foreground"
            onClick={() => onManage(toolkit)}
          >
            View connection
          </Button>
        )}
      </div>
    </div>
  );
};

export default ToolkitCard;
