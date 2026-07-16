import type { User } from '@/types/authTypes';
import type { PermissionKeyInput } from '@/types/permissions';

export type PermissionValue = boolean | string | null | undefined;

export const resolvePermissionValue = (
  permissions: Record<string, unknown> | undefined,
  permissionKey: PermissionKeyInput
): PermissionValue => {
  if (!permissions || !permissionKey) return false;

  if (Object.prototype.hasOwnProperty.call(permissions, permissionKey)) {
    return permissions[permissionKey] as PermissionValue;
  }

  const parts = permissionKey.split('.');
  let current: unknown = permissions;

  for (const part of parts) {
    if (!current || typeof current !== 'object' || !Object.prototype.hasOwnProperty.call(current, part)) {
      return false;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current as PermissionValue;
};

/**
 * Visibility-level grant check: is this permission granted at all?
 * `true` / `all` / `own` / `team` all count as "granted" for the purpose of
 * showing a control. Per-row entitlement for `own`/`team` is enforced
 * separately by `hasPermissionForResource`. Free-text truthy strings like
 * 'true'/'yes' are intentionally NOT accepted — only the canonical scope
 * values from the schema are valid.
 */
export const isPermissionGrantedValue = (value: PermissionValue): boolean => {
  if (value === true) return true;
  if (typeof value === 'string') {
    // 'team' is transitional (no client-side membership data yet); kept as a
    // grant during migration, consistent with the HMS frontend.
    return ['all', 'team', 'own'].includes(value.toLowerCase());
  }
  return false;
};

/** Normalize a raw permission value to its scope, or null when not granted. */
export const getPermissionScope = (
  value: PermissionValue
): 'all' | 'team' | 'own' | null => {
  if (value === true || value === 'all') return 'all';
  if (value === 'team') return 'team';
  if (value === 'own') return 'own';
  return null;
};

export const isAdminUser = (user: User | null | undefined): boolean => {
  if (!user) return false;
  if (user.is_super_admin || user.isSuperAdmin) return true;

  const permissions = user.permissions || {};
  const fullAccess = resolvePermissionValue(permissions, 'admin.full_access');
  const fullAccessEnabled = resolvePermissionValue(permissions, 'admin.full_access.enabled');
  return fullAccess === true || fullAccessEnabled === true;
};

/**
 * Visibility-level check — use for nav items, tabs, and "can this control be
 * shown at all" decisions. Does NOT verify per-row ownership for `own` scope.
 */
export const hasUserPermission = (
  user: User | null | undefined,
  permissionKey: PermissionKeyInput
): boolean => {
  if (isAdminUser(user)) return true;
  return isPermissionGrantedValue(resolvePermissionValue(user?.permissions, permissionKey));
};

/**
 * Scope-aware entitlement check for a SPECIFIC resource/row. Use for per-row
 * edit/delete controls so that `own`-scoped users only act on their own rows.
 *
 * - `all`  → always allowed
 * - `team` → allowed (transitional; no client-side team membership yet)
 * - `own`  → allowed only when the resource owner matches the current user.
 *            Fails CLOSED when ownership cannot be determined.
 */
export const hasPermissionForResource = (
  user: User | null | undefined,
  permissionKey: PermissionKeyInput,
  resourceOwnerId?: string | number | null,
  currentUserId?: string | number | null
): boolean => {
  if (isAdminUser(user)) return true;

  const scope = getPermissionScope(resolvePermissionValue(user?.permissions, permissionKey));
  if (scope === null) return false;
  if (scope === 'all' || scope === 'team') return true;

  // scope === 'own'
  const ownerId = resourceOwnerId ?? null;
  if (ownerId === null || ownerId === undefined) return false; // fail closed
  const selfId = currentUserId ?? user?.id ?? null;
  if (selfId === null || selfId === undefined) return false;
  return String(ownerId) === String(selfId);
};
