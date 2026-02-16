// src/App.tsx - CRM + WhatsApp Application
import { useState, useEffect } from "react";
import { SWRConfig } from "swr";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { UniversalSidebar } from "@/components/UniversalSidebar";
import { UniversalHeader } from "@/components/UniversalHeader";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ModuleProtectedRoute } from "@/components/ModuleProtectedRoute";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { swrConfig } from "@/lib/swrConfig";
import { authService } from "@/services/authService";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";
import { CRMLeads } from "./pages/CRMLeads";
import { CRMActivities } from "./pages/CRMActivities";
import { CRMLeadStatuses } from "./pages/CRMLeadStatuses";
import { CRMFieldConfigurations } from "./pages/CRMFieldConfigurations";
import { CRMTasks } from "./pages/CRMTasks";
import { Meetings } from "./pages/Meetings";
import { LeadDetailsPage } from "./pages/LeadDetailsPage";
import Contacts from "./pages/Contacts";
import Chats from "./pages/Chats";
import Groups from "./pages/Groups";
import Templates from "./pages/Templates";
import Campaigns from "./pages/Campaigns";
import Flows from "./pages/Flows";
import FlowEditor from "./pages/FlowEditor";
import QRCodes from "./pages/QRCodes";
import WhatsAppOnboarding from "./pages/WhatsAppOnboarding";
import Scheduling from "./pages/Scheduling";

import { ThemeSync } from "@/components/ThemeSync";
import { Users } from "./pages/Users";
import { Roles } from "./pages/Roles";
import { Debug } from "./pages/Debug";
import { AdminSettings } from "./pages/AdminSettings";
import Integrations from "./pages/Integrations";
import WorkflowEditor from "./pages/WorkflowEditor";
import { WorkflowLogs } from "./pages/WorkflowLogs";

import { WebSocketProvider } from "./context/WebSocketProvider";
import { RealtimeChatProvider } from "./context/RealtimeChatProvider";
import { OAuthCallback } from "./pages/OAuthCallback";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
      staleTime: 30000,
    },
  },
});

const AppLayout = () => {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <>
      <ThemeSync />
      <div className="flex h-screen overflow-hidden bg-background">
        <UniversalSidebar
          mobileOpen={sidebarOpen}
          setMobileOpen={setSidebarOpen}
          collapsed={sidebarCollapsed}
          onCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
        <div className="flex flex-col flex-1 overflow-hidden">
          <UniversalHeader onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
          <main className="flex-1 overflow-auto">
            <Routes>
              <Route path="/" element={<Dashboard />} />

              {/* CRM Routes */}
              <Route path="/crm/leads" element={<ModuleProtectedRoute requiredModule="crm"><CRMLeads /></ModuleProtectedRoute>} />
              <Route path="/crm/leads/:leadId" element={<ModuleProtectedRoute requiredModule="crm"><LeadDetailsPage /></ModuleProtectedRoute>} />
              <Route path="/crm/activities" element={<ModuleProtectedRoute requiredModule="crm"><CRMActivities /></ModuleProtectedRoute>} />
              <Route path="/crm/statuses" element={<ModuleProtectedRoute requiredModule="crm"><CRMLeadStatuses /></ModuleProtectedRoute>} />
              <Route path="/crm/settings" element={<ModuleProtectedRoute requiredModule="crm"><CRMFieldConfigurations /></ModuleProtectedRoute>} />
              <Route path="/crm/tasks" element={<ModuleProtectedRoute requiredModule="crm"><CRMTasks /></ModuleProtectedRoute>} />
              <Route path="/crm/meetings" element={<ModuleProtectedRoute requiredModule="crm"><Meetings /></ModuleProtectedRoute>} />
              <Route path="/crm/pipeline" element={<ModuleProtectedRoute requiredModule="crm"><Navigate to="/crm/leads" replace /></ModuleProtectedRoute>} />

              {/* WhatsApp Routes */}
              <Route path="/whatsapp/onboarding" element={<ModuleProtectedRoute requiredModule="whatsapp"><WhatsAppOnboarding /></ModuleProtectedRoute>} />
              <Route path="/whatsapp/contacts" element={<ModuleProtectedRoute requiredModule="whatsapp"><Contacts /></ModuleProtectedRoute>} />
              <Route path="/whatsapp/chats" element={<ModuleProtectedRoute requiredModule="whatsapp"><Chats /></ModuleProtectedRoute>} />
              <Route path="/whatsapp/groups" element={<ModuleProtectedRoute requiredModule="whatsapp"><Groups /></ModuleProtectedRoute>} />
              <Route path="/whatsapp/templates" element={<ModuleProtectedRoute requiredModule="whatsapp"><Templates /></ModuleProtectedRoute>} />
              <Route path="/whatsapp/campaigns" element={<ModuleProtectedRoute requiredModule="whatsapp"><Campaigns /></ModuleProtectedRoute>} />
              <Route path="/whatsapp/flows" element={<ModuleProtectedRoute requiredModule="whatsapp"><Flows /></ModuleProtectedRoute>} />
              <Route path="/whatsapp/flows/:flow_id" element={<ModuleProtectedRoute requiredModule="whatsapp"><FlowEditor /></ModuleProtectedRoute>} />
              <Route path="/whatsapp/qrcode" element={<ModuleProtectedRoute requiredModule="whatsapp"><QRCodes /></ModuleProtectedRoute>} />
              <Route path="/whatsapp/scheduling" element={<ModuleProtectedRoute requiredModule="whatsapp"><Scheduling /></ModuleProtectedRoute>} />

              {/* Admin Routes */}
              <Route path="/admin/users" element={<ModuleProtectedRoute requiredModule="admin"><Users /></ModuleProtectedRoute>} />
              <Route path="/admin/roles" element={<ModuleProtectedRoute requiredModule="admin"><Roles /></ModuleProtectedRoute>} />
              <Route path="/admin/settings" element={<ModuleProtectedRoute requiredModule="admin"><AdminSettings /></ModuleProtectedRoute>} />
              <Route path="/admin/debug" element={<ModuleProtectedRoute requiredModule="admin"><Debug /></ModuleProtectedRoute>} />

              {/* Integration Routes */}
              <Route path="/integrations" element={<ModuleProtectedRoute requiredModule="integrations"><Integrations /></ModuleProtectedRoute>} />
              <Route path="/integrations/workflows/new" element={<ModuleProtectedRoute requiredModule="integrations"><WorkflowEditor /></ModuleProtectedRoute>} />
              <Route path="/integrations/workflows/:workflowId" element={<ModuleProtectedRoute requiredModule="integrations"><WorkflowEditor /></ModuleProtectedRoute>} />
              <Route path="/integrations/workflows/:workflowId/logs" element={<ModuleProtectedRoute requiredModule="integrations"><WorkflowLogs /></ModuleProtectedRoute>} />
              <Route path="/integrations/oauth/callback" element={<ModuleProtectedRoute requiredModule="integrations"><OAuthCallback /></ModuleProtectedRoute>} />

              {/* 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
        </div>
      </div>
    </>
  );
};

const App = () => {
  const isAuthenticated = authService.isAuthenticated();

  useEffect(() => {
    if (isAuthenticated) {
      authService.applyStoredPreferences();
    }
  }, [isAuthenticated]);

  return (
    <SWRConfig value={swrConfig}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <WebSocketProvider>
            <BrowserRouter>
              <Routes>
                <Route
                  path="/login"
                  element={
                    isAuthenticated ? <Navigate to="/" replace /> : <Login />
                  }
                />
                <Route
                  path="/*"
                  element={
                    <ProtectedRoute>
                      <RealtimeChatProvider>
                        <AppLayout />
                      </RealtimeChatProvider>
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </BrowserRouter>
          </WebSocketProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </SWRConfig>
  );
};

export default App;
