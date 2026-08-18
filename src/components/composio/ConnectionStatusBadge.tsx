// src/components/composio/ConnectionStatusBadge.tsx
// One Badge per ComposioConnectionStatus. Colours follow the density redesign:
// green = healthy, amber = needs the user's attention, red = broken.

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ComposioConnectionStatus } from '@/types/composio.types';

interface StatusPresentation {
  label: string;
  className: string;
}

const PRESENTATION: Record<string, StatusPresentation> = {
  [ComposioConnectionStatus.ACTIVE]: {
    label: 'Connected',
    className: 'bg-green-100 text-green-800 border-green-200',
  },
  [ComposioConnectionStatus.PENDING]: {
    label: 'Pending',
    className: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  [ComposioConnectionStatus.INITIALIZING]: {
    label: 'Connecting…',
    className: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  [ComposioConnectionStatus.INACTIVE]: {
    label: 'Disabled',
    className: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  [ComposioConnectionStatus.EXPIRED]: {
    label: 'Expired',
    className: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  [ComposioConnectionStatus.REVOKED]: {
    label: 'Revoked',
    className: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  [ComposioConnectionStatus.FAILED]: {
    label: 'Failed',
    className: 'bg-red-100 text-red-800 border-red-200',
  },
  [ComposioConnectionStatus.DELETED]: {
    label: 'Removed',
    className: 'bg-muted text-muted-foreground border-border',
  },
};

interface ConnectionStatusBadgeProps {
  status?: ComposioConnectionStatus | string | null;
  className?: string;
}

export const ConnectionStatusBadge = ({ status, className }: ConnectionStatusBadgeProps) => {
  const presentation =
    PRESENTATION[(status as string) || ''] ?? {
      label: status ? String(status) : 'Unknown',
      className: 'bg-muted text-muted-foreground border-border',
    };

  return (
    <Badge variant="outline" className={cn('text-[10px] font-medium', presentation.className, className)}>
      {presentation.label}
    </Badge>
  );
};

export default ConnectionStatusBadge;
