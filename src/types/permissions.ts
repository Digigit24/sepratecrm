// Canonical typed permission keys for sepratecrm runtime gating.
//
// Source of truth is the GENERATED constants file
// (src/constants/permissions.ts, emitted from
// superadmin/apps/common/permissions_catalog.yaml). This module simply
// re-exports the derived types so components import permission types from a
// stable `@/types/permissions` path — mirroring celiyohms' structure.

import { PERMISSIONS } from "@/constants/permissions";
export {
  PERMISSIONS,
} from "@/constants/permissions";
export type {
  PermissionKey,
  PermissionValue,
  PermissionScope,
  PermissionGrant,
} from "@/constants/permissions";

import type { PermissionKey } from "@/constants/permissions";

/**
 * Accepts any catalog `PermissionKey` (with editor autocomplete) while still
 * permitting arbitrary strings at call sites that build keys dynamically
 * (e.g. sidebar nav config, route guards). Prefer `PERMISSIONS[...]` so typos
 * fail at compile time.
 */
export type PermissionKeyInput = PermissionKey | (string & {});

/** Runtime check that a string is a known catalog permission key. */
export function isKnownPermission(key: string): key is PermissionKey {
  return Object.prototype.hasOwnProperty.call(PERMISSIONS, key);
}
