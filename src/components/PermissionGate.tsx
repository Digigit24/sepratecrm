// PermissionGate — declaratively render children only when the current user
// holds the given permission. Parity with celiyohms'
// src/components/shared/PermissionGate.tsx. Keys are typed against the
// generated catalog, so an invalid permission fails at compile time.

import type { ReactNode } from "react";
import { usePermission } from "@/hooks/usePermission";
import type { PermissionKey } from "@/types/permissions";

interface PermissionGateProps {
  permission: PermissionKey;
  fallback?: ReactNode;
  children: ReactNode;
}

export function PermissionGate({ permission, fallback = null, children }: PermissionGateProps) {
  const allowed = usePermission(permission);
  return <>{allowed ? children : fallback}</>;
}
