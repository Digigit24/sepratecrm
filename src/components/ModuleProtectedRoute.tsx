import { useAuth } from "@/hooks/useAuth";
import { Loader2, ShieldAlert } from "lucide-react";
import type { PermissionKey } from "@/types/permissions";

interface ModuleProtectedRouteProps {
  requiredModule: string;
  requiredPermission?: PermissionKey;
  children: React.ReactNode;
}

export const ModuleProtectedRoute = ({
  requiredModule,
  requiredPermission,
  children,
}: ModuleProtectedRouteProps) => {
  const { hasModuleAccess, hasPermission, isAdminLike, isLoading } = useAuth();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const allowed = isAdminLike() || (
    hasModuleAccess(requiredModule) && (!requiredPermission || hasPermission(requiredPermission))
  );

  if (!allowed) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="max-w-md rounded-lg border bg-card p-6 text-center shadow-sm">
          <ShieldAlert className="mx-auto mb-3 h-9 w-9 text-muted-foreground" />
          <h1 className="text-lg font-semibold">Permission not granted for this module</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your current role does not include access to this section.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
