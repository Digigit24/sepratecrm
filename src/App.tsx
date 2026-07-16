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
import { CRMLeadGroups } from "./pages/CRMLeadGroups";
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
import BotFlows from "./pages/BotFlows";
import BotFlowBuilder from "./pages/BotFlowBuilder";
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
import { CRMCampaigns } from "./pages/CRMCampaigns";
import { CRMCampaignDetail } from "./pages/CRMCampaignDetail";
import { CRMSequences } from "./pages/CRMSequences";
import { CallLogsPage } from "./pages/telephony/CallLogsPage";
import { SMSLogsPage } from "./pages/telephony/SMSLogsPage";
import { CallerIDsPage } from "./pages/telephony/CallerIDsPage";
import { BreaksPage } from "./pages/telephony/BreaksPage";
import { CallbacksPage } from "./pages/telephony/CallbacksPage";

import { WebSocketProvider } from "./context/WebSocketProvider";
import { RealtimeChatProvider } from "./context/RealtimeChatProvider";
import { OAuthCallback } from "./pages/OAuthCallback";
import { TelephonyProvider } from "./context/TelephonyProvider";
import { Softphone } from "./components/telephony/Softphone";
import { useAuth } from "@/hooks/useAuth";

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

// Mounts the in-browser softphone provider + widget, but only when the
// tenant/user has the telephony module. Otherwise renders children untouched.
const TelephonyShell = ({ children }: { children: React.ReactNode }) => {
  const { hasModuleAccess } = useAuth();
  if (!hasModuleAccess("telephony")) return <>{children}</>;
  return (
    <TelephonyProvider>
      {children}
      <Softphone />
    </TelephonyProvider>
  );
};

const AppLayout = () => {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(!isMobile);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <TelephonyShell>
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
              <Route path="/crm/leads" element={<ModuleProtectedRoute requiredModule="crm" requiredPermission="crm.leads.view"><CRMLeads /></ModuleProtectedRoute>} />
              <Route path="/crm/leads/:leadId" element={<ModuleProtectedRoute requiredModule="crm" requiredPermission="crm.leads.view"><LeadDetailsPage /></ModuleProtectedRoute>} />
              <Route path="/crm/groups" element={<ModuleProtectedRoute requiredModule="crm" requiredPermission="crm.settings.view"><CRMLeadGroups /></ModuleProtectedRoute>} />
              <Route path="/crm/activities" element={<ModuleProtectedRoute requiredModule="crm" requiredPermission="crm.activities.view"><CRMActivities /></ModuleProtectedRoute>} />
              <Route path="/crm/statuses" element={<ModuleProtectedRoute requiredModule="crm" requiredPermission="crm.settings.view"><CRMLeadStatuses /></ModuleProtectedRoute>} />
              <Route path="/crm/settings" element={<ModuleProtectedRoute requiredModule="crm" requiredPermission="crm.settings.view"><CRMFieldConfigurations /></ModuleProtectedRoute>} />
              <Route path="/crm/tasks" element={<ModuleProtectedRoute requiredModule="crm" requiredPermission="crm.tasks.view"><CRMTasks /></ModuleProtectedRoute>} />
              <Route path="/crm/meetings" element={<ModuleProtectedRoute requiredModule="crm" requiredPermission="crm.meetings.view"><Meetings /></ModuleProtectedRoute>} />
              <Route path="/crm/pipeline" element={<ModuleProtectedRoute requiredModule="crm" requiredPermission="crm.leads.view"><Navigate to="/crm/leads" replace /></ModuleProtectedRoute>} />
              <Route path="/crm/campaigns" element={<ModuleProtectedRoute requiredModule="whatsapp" requiredPermission="whatsapp.campaigns.view"><CRMCampaigns /></ModuleProtectedRoute>} />
              <Route path="/crm/campaigns/:campaignId" element={<ModuleProtectedRoute requiredModule="whatsapp" requiredPermission="whatsapp.campaigns.view"><CRMCampaignDetail /></ModuleProtectedRoute>} />
              <Route path="/crm/sequences" element={<ModuleProtectedRoute requiredModule="whatsapp" requiredPermission="whatsapp.settings.view"><CRMSequences /></ModuleProtectedRoute>} />

              {/* WhatsApp Routes */}
              <Route path="/whatsapp/onboarding" element={<ModuleProtectedRoute requiredModule="whatsapp" requiredPermission="whatsapp.settings.view"><WhatsAppOnboarding /></ModuleProtectedRoute>} />
              <Route path="/whatsapp/contacts" element={<ModuleProtectedRoute requiredModule="whatsapp" requiredPermission="whatsapp.messages.view"><Contacts /></ModuleProtectedRoute>} />
              <Route path="/whatsapp/chats" element={<ModuleProtectedRoute requiredModule="whatsapp" requiredPermission="whatsapp.messages.view"><Chats /></ModuleProtectedRoute>} />
              <Route path="/whatsapp/groups" element={<ModuleProtectedRoute requiredModule="whatsapp" requiredPermission="whatsapp.messages.view"><Groups /></ModuleProtectedRoute>} />
              <Route path="/whatsapp/templates" element={<ModuleProtectedRoute requiredModule="whatsapp" requiredPermission="whatsapp.templates.view"><Templates /></ModuleProtectedRoute>} />
              <Route path="/whatsapp/campaigns" element={<ModuleProtectedRoute requiredModule="whatsapp" requiredPermission="whatsapp.campaigns.view"><Campaigns /></ModuleProtectedRoute>} />
              <Route path="/whatsapp/flows" element={<ModuleProtectedRoute requiredModule="whatsapp" requiredPermission="whatsapp.settings.view"><Flows /></ModuleProtectedRoute>} />
              <Route path="/whatsapp/flows/:flow_id" element={<ModuleProtectedRoute requiredModule="whatsapp" requiredPermission="whatsapp.settings.view"><FlowEditor /></ModuleProtectedRoute>} />
              <Route path="/whatsapp/bot-flows" element={<ModuleProtectedRoute requiredModule="whatsapp" requiredPermission="whatsapp.settings.view"><BotFlows /></ModuleProtectedRoute>} />
              <Route path="/whatsapp/bot-flows/:flowId" element={<ModuleProtectedRoute requiredModule="whatsapp" requiredPermission="whatsapp.settings.view"><BotFlowBuilder /></ModuleProtectedRoute>} />
              <Route path="/whatsapp/qrcode" element={<ModuleProtectedRoute requiredModule="whatsapp" requiredPermission="whatsapp.settings.view"><QRCodes /></ModuleProtectedRoute>} />
              <Route path="/whatsapp/scheduling" element={<ModuleProtectedRoute requiredModule="whatsapp" requiredPermission="whatsapp.settings.view"><Scheduling /></ModuleProtectedRoute>} />

              {/* Admin Routes */}
              <Route path="/admin/users" element={<ModuleProtectedRoute requiredModule="admin" requiredPermission="admin.users.view"><Users /></ModuleProtectedRoute>} />
              <Route path="/admin/roles" element={<ModuleProtectedRoute requiredModule="admin" requiredPermission="admin.roles.view"><Roles /></ModuleProtectedRoute>} />
              <Route path="/admin/settings" element={<ModuleProtectedRoute requiredModule="admin" requiredPermission="admin.settings.view"><AdminSettings /></ModuleProtectedRoute>} />
              <Route path="/admin/debug" element={<ModuleProtectedRoute requiredModule="admin" requiredPermission="admin.settings.view"><Debug /></ModuleProtectedRoute>} />

              {/* Integration Routes */}
              <Route path="/integrations" element={<ModuleProtectedRoute requiredModule="integrations" requiredPermission="integrations.connections.view"><Integrations /></ModuleProtectedRoute>} />
              <Route path="/integrations/workflows/new" element={<ModuleProtectedRoute requiredModule="integrations" requiredPermission="integrations.workflows.create"><WorkflowEditor /></ModuleProtectedRoute>} />
              <Route path="/integrations/workflows/:workflowId" element={<ModuleProtectedRoute requiredModule="integrations" requiredPermission="integrations.workflows.edit"><WorkflowEditor /></ModuleProtectedRoute>} />
              <Route path="/integrations/workflows/:workflowId/logs" element={<ModuleProtectedRoute requiredModule="integrations" requiredPermission="integrations.workflows.view"><WorkflowLogs /></ModuleProtectedRoute>} />
              <Route path="/integrations/oauth/callback" element={<ModuleProtectedRoute requiredModule="integrations" requiredPermission="integrations.connections.view"><OAuthCallback /></ModuleProtectedRoute>} />

              {/* Telephony Routes */}
              <Route path="/telephony/calls" element={<ModuleProtectedRoute requiredModule="telephony" requiredPermission="telephony.calls.view"><CallLogsPage /></ModuleProtectedRoute>} />
              <Route path="/telephony/sms" element={<ModuleProtectedRoute requiredModule="telephony" requiredPermission="telephony.sms.view"><SMSLogsPage /></ModuleProtectedRoute>} />
              <Route path="/telephony/caller-ids" element={<ModuleProtectedRoute requiredModule="telephony" requiredPermission="telephony.settings.view"><CallerIDsPage /></ModuleProtectedRoute>} />
              <Route path="/telephony/breaks" element={<ModuleProtectedRoute requiredModule="telephony" requiredPermission="telephony.agents.view"><BreaksPage /></ModuleProtectedRoute>} />
              <Route path="/telephony/callbacks" element={<ModuleProtectedRoute requiredModule="telephony" requiredPermission="telephony.callbacks.view"><CallbacksPage /></ModuleProtectedRoute>} />

              {/* 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
        </div>
      </div>
    </TelephonyShell>
  );
};

const App = () => {
  // useState so App re-renders on login/logout — plain authService.isAuthenticated()
  // is stale after logout and causes a Navigate loop with ProtectedRoute.
  const [isAuthenticated, setIsAuthenticated] = useState(() => authService.isAuthenticated());

  useEffect(() => {
    const handler = () => setIsAuthenticated(authService.isAuthenticated());
    window.addEventListener('celiyo:user-updated', handler);
    return () => window.removeEventListener('celiyo:user-updated', handler);
  }, []);

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
