// usePermission — typed single-permission check for runtime UI gating.
// Parity with celiyohms' src/hooks/use-permission.ts. Reads the current user's
// permissions through useAuth (which resolves via src/lib/permissions.ts).

import { useAuth } from "@/hooks/useAuth";
import type { PermissionKey } from "@/types/permissions";

export function usePermission(key: PermissionKey): boolean {
  const { hasPermission } = useAuth();
  return hasPermission(key);
}
