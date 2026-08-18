// src/components/user/index.ts
// Barrel for the shared user-directory display layer.
export { UserName } from './UserName';
export type { UserNameProps } from './UserName';
export { UserAvatar } from './UserAvatar';
export type { UserAvatarProps, UserAvatarSize } from './UserAvatar';
export {
  useUserDirectory,
  USER_DIRECTORY_KEY,
  UNASSIGNED_LABEL,
  UNKNOWN_USER_LABEL,
  resolveUserName,
  resolveInitials,
} from '@/hooks/useUserDirectory';
export type { DirectoryUser, UserDirectory } from '@/hooks/useUserDirectory';
