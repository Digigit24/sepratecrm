// src/components/user/UserAvatar.tsx
//
// Avatar for a user UUID, built on the shadcn/radix primitives in
// components/ui/avatar.tsx. `showName` composes it with <UserName> — that
// combination is what table cells and select options use.

import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { hexToRgba } from '@/lib/hexBadge';
import { useUserDirectory, UNASSIGNED_LABEL } from '@/hooks/useUserDirectory';
import { UserName } from './UserName';

export type UserAvatarSize = 'xs' | 'sm' | 'md';

const SIZE_CLASSES: Record<UserAvatarSize, string> = {
  xs: 'h-5 w-5 text-[9px]',
  sm: 'h-6 w-6 text-[10px]',
  md: 'h-8 w-8 text-xs',
};

// Deterministic per-user palette, same tinting approach as hexBadgeStyle():
// a 10% background wash with the full-strength hue as the text colour.
const AVATAR_PALETTE = [
  '#2563eb', // blue
  '#7c3aed', // violet
  '#db2777', // pink
  '#dc2626', // red
  '#ea580c', // orange
  '#ca8a04', // amber
  '#16a34a', // green
  '#0891b2', // cyan
  '#4f46e5', // indigo
  '#0d9488', // teal
];

/** Stable hash so a given user always gets the same colour across sessions. */
function paletteHexFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

export interface UserAvatarProps {
  id?: string | null;
  size?: UserAvatarSize;
  /** Render the resolved name next to the avatar. */
  showName?: boolean;
  /** Label used when `id` is null/empty (only rendered with `showName`). */
  fallback?: string;
  className?: string;
  /** Extra classes for the name span when `showName` is set. */
  nameClassName?: string;
}

export function UserAvatar({
  id,
  size = 'sm',
  showName = false,
  fallback = UNASSIGNED_LABEL,
  className,
  nameClassName,
}: UserAvatarProps) {
  const { getUser, isLoading, isForbidden } = useUserDirectory();
  const user = id ? getUser(id) : undefined;

  // Unassigned: no avatar at all — a coloured circle would imply a person.
  if (!id) {
    return showName ? (
      <span className={cn('truncate text-muted-foreground', className, nameClassName)}>
        {fallback}
      </span>
    ) : null;
  }

  const resolving = !user && isLoading && !isForbidden;

  const circle = resolving ? (
    <Skeleton className={cn('shrink-0 rounded-full', SIZE_CLASSES[size], className)} />
  ) : (
    <Avatar className={cn('shrink-0', SIZE_CLASSES[size], className)}>
      {user?.avatarUrl ? <AvatarImage src={user.avatarUrl} alt={user.name} /> : null}
      <AvatarFallback
        className="font-medium"
        style={
          user
            ? {
                backgroundColor: hexToRgba(paletteHexFor(user.id), 0.12),
                color: paletteHexFor(user.id),
              }
            : undefined
        }
      >
        {/* Unresolvable id (deleted user / no directory access) -> neutral '?'. */}
        {user?.initials ?? '?'}
      </AvatarFallback>
    </Avatar>
  );

  if (!showName) return circle;

  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {circle}
      <UserName id={id} fallback={fallback} className={cn('min-w-0', nameClassName)} />
    </span>
  );
}

export default UserAvatar;
