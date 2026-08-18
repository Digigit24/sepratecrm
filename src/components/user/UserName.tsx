// src/components/user/UserName.tsx
//
// Renders a user UUID as a human name. This component (and <UserAvatar>) is
// the ONLY approved way to put an owner / assignee / reporter / created-by id
// on screen — rendering `{lead.owner_user_id}` directly is the bug this
// module exists to prevent.
//
// States it handles so no call site has to:
//   null / undefined / ''          -> `fallback` ("Unassigned"), muted
//   directory still loading        -> skeleton shimmer (never a UUID flash)
//   403 / no directory access      -> `forbiddenFallback` ("—"), muted, no toast
//   id not in the directory        -> "Unknown user"; the UUID is preserved in
//                                     the title attribute so support can still
//                                     trace it
//   deactivated user               -> name + " (inactive)"

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useUserDirectory,
  UNASSIGNED_LABEL,
  UNKNOWN_USER_LABEL,
} from '@/hooks/useUserDirectory';

export interface UserNameProps {
  id?: string | null;
  /** Shown when `id` is null/empty. */
  fallback?: string;
  /** Shown when the account has no directory access (403). */
  forbiddenFallback?: string;
  className?: string;
  /** Append the email in muted text after the name. */
  showEmail?: boolean;
  /** Suffix deactivated users with "(inactive)". Default true. */
  showInactive?: boolean;
}

export function UserName({
  id,
  fallback = UNASSIGNED_LABEL,
  forbiddenFallback = '—',
  className,
  showEmail = false,
  showInactive = true,
}: UserNameProps) {
  const { getUser, isLoading, isForbidden } = useUserDirectory();

  if (!id) {
    return (
      <span className={cn('truncate text-muted-foreground', className)}>{fallback}</span>
    );
  }

  if (isForbidden) {
    // Expected for accounts without directory access. Stay quiet and short.
    return (
      <span className={cn('truncate text-muted-foreground', className)} title={id}>
        {forbiddenFallback}
      </span>
    );
  }

  const user = getUser(id);

  if (!user && isLoading) {
    return <Skeleton className={cn('h-4 w-24', className)} />;
  }

  if (!user) {
    return (
      <span className={cn('truncate text-muted-foreground', className)} title={id}>
        {UNKNOWN_USER_LABEL}
      </span>
    );
  }

  return (
    <span className={cn('truncate', className)} title={user.email || id}>
      {user.name}
      {showInactive && !user.isActive && (
        <span className="ml-1 text-xs text-muted-foreground">(inactive)</span>
      )}
      {showEmail && user.email && user.email !== user.name && (
        <span className="ml-1 text-xs text-muted-foreground">{user.email}</span>
      )}
    </span>
  );
}

export default UserName;
