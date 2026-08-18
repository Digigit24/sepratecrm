// src/components/composio/DisconnectConfirmDialog.tsx
// Destructive confirm before removing a Composio connection.

import { Loader2 } from 'lucide-react';
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

interface DisconnectConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  toolkitName: string;
  accountLabel?: string | null;
  isPending?: boolean;
  onConfirm: () => void;
  /** Copy tweak for the tenant-admin "revoke someone else's connection" case. */
  variant?: 'disconnect' | 'revoke';
}

export const DisconnectConfirmDialog = ({
  open,
  onOpenChange,
  toolkitName,
  accountLabel,
  isPending = false,
  onConfirm,
  variant = 'disconnect',
}: DisconnectConfirmDialogProps) => {
  const isRevoke = variant === 'revoke';

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-sm">
            {isRevoke ? `Revoke ${toolkitName} access?` : `Disconnect ${toolkitName}?`}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-xs">
            {isRevoke
              ? `This removes ${toolkitName}${accountLabel ? ` (${accountLabel})` : ''} for its owner.`
              : `Celiyo will lose access to ${toolkitName}${accountLabel ? ` (${accountLabel})` : ''}.`}{' '}
            Any automations using this connection will stop working. You can reconnect at any time.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-7 text-xs" disabled={isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className="h-7 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
            disabled={isPending}
            onClick={(event) => {
              // Keep the dialog open while the request is in flight so the
              // spinner is visible; the caller closes it on settle.
              event.preventDefault();
              onConfirm();
            }}
          >
            {isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
            {isRevoke ? 'Revoke' : 'Disconnect'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DisconnectConfirmDialog;
