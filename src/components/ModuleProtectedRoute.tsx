import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

interface ModuleProtectedRouteProps {
  requiredModule: string;
  children: React.ReactNode;
}

export const ModuleProtectedRoute = ({
  requiredModule,
  children,
}: ModuleProtectedRouteProps) => {
  const { hasModuleAccess, loading } = useAuth();

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Check if user has access to the required module
  if (!hasModuleAccess(requiredModule)) {
    // Redirect to dashboard if module is not enabled
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
