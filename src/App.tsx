// src/App.tsx - CRM + WhatsApp Application
import { useState, useEffect, lazy, Suspense } from "react";
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

// Eagerly loaded: entry pages every session needs immediately
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import NotFound from "./pages/NotFound";

// Route-level code splitting: every other page loads on demand, so the
// initial bundle no longer ships the flow editors, campaign builders, etc.
const CRMLeads = lazy(() => import("./pages/CRMLeads").then(m => ({ default: m.CRMLeads })));
const CRMLeadGroups = lazy(() => import("./pages/CRMLeadGroups").then(m => ({ default: m.CRMLeadGroups })));
const CRMActivities = lazy(() => import("./pages/CRMActivities").then(m => ({ default: m.CRMActivities })));
const CRMLeadStatuses = lazy(() => import("./pages/CRMLeadStatuses").then(m => ({ default: m.CRMLeadStatuses })));
const CRMFieldConfigurations = lazy(() => import("./pages/CRMFieldConfigurations").then(m => ({ default: m.CRMFieldConfigurations })));
const CRMTasks = lazy(() => import("./pages/CRMTasks").then(m => ({ default: m.CRMTasks })));
const Meetings = lazy(() => import("./pages/Meetings").then(m => ({ default: m.Meetings })));
const LeadDetailsPage = lazy(() => import("./pages/LeadDetailsPage").then(m => ({ default: m.LeadDetailsPage })));
const Contacts = lazy(() => import("./pages/Contacts"));
const Chats = lazy(() => import("./pages/Chats"));
const Groups = lazy(() => import("./pages/Groups"));
const Templates = lazy(() => import("./pages/Templates"));
const Campaigns = lazy(() => import("./pages/Campaigns"));
const Flows = lazy(() => import("./pages/Flows"));
const FlowEditor = lazy(() => import("./pages/FlowEditor"));
const BotFlows = lazy(() => import("./pages/BotFlows"));
const BotFlowBuilder = lazy(() => import("./pages/BotFlowBuilder"));
const QRCodes = lazy(() => import("./pages/QRCodes"));
const WhatsAppOnboarding = lazy(() => import("./pages/WhatsAppOnboarding"));
const Scheduling = lazy(() => import("./pages/Scheduling"));
const Users = lazy(() => import("./pages/Users").then(m => ({ default: m.Users })));
const Roles = lazy(() => import("./pages/Roles").then(m => ({ default: m.Roles })));
const Debug = lazy(() => import("./pages/Debug").then(m => ({ default: m.Debug })));
const AdminSettings = lazy(() => import("./pages/AdminSettings").then(m => ({ default: m.AdminSettings })));
const Integrations = lazy(() => import("./pages/Integrations"));
const WorkflowEditor = lazy(() => import("./pages/WorkflowEditor"));
const WorkflowLogs = lazy(() => import("./pages/WorkflowLogs").then(m => ({ default: m.WorkflowLogs })));
const CRMCampaigns = lazy(() => import("./pages/CRMCampaigns").then(m => ({ default: m.CRMCampaigns })));
const CRMCampaignDetail = lazy(() => import("./pages/CRMCampaignDetail").then(m => ({ default: m.CRMCampaignDetail })));
const CRMSequences = lazy(() => import("./pages/CRMSequences").then(m => ({ default: m.CRMSequences })));
const CallLogsPage = lazy(() => import("./pages/telephony/CallLogsPage").then(m => ({ default: m.CallLogsPage })));
const SMSLogsPage = lazy(() => import("./pages/telephony/SMSLogsPage").then(m => ({ default: m.SMSLogsPage })));
const CallerIDsPage = lazy(() => import("./pages/telephony/CallerIDsPage").then(m => ({ default: m.CallerIDsPage })));
const BreaksPage = lazy(() => import("./pages/telephony/BreaksPage").then(m => ({ default: m.BreaksPage })));
const CallbacksPage = lazy(() => import("./pages/telephony/CallbacksPage").then(m => ({ default: m.CallbacksPage })));
const TelephonyDashboardPage = lazy(() => import("./pages/telephony/TelephonyDashboardPage").then(m => ({ default: m.TelephonyDashboardPage })));
const CampaignsPage = lazy(() => import("./pages/telephony/CampaignsPage").then(m => ({ default: m.CampaignsPage })));
const RealEstateProjectsPage = lazy(() => import("./pages/real-estate/ProjectsPage").then(m => ({ default: m.ProjectsPage })));
const RealEstateProjectDetailPage = lazy(() => import("./pages/real-estate/ProjectDetailPage").then(m => ({ default: m.ProjectDetailPage })));
const OAuthCallback = lazy(() => import("./pages/OAuthCallback").then(m => ({ default: m.OAuthCallback })));

import { ThemeSync } from "@/components/ThemeSync";
import { WebSocketProvider } from "./context/WebSocketProvider";
import { RealtimeChatProvider } from "./context/RealtimeChatProvider";
import { TelephonyProvider } from "./context/TelephonyProvider";
import { ChatProvider } from "./context/ChatProvider";
import { CopilotPanel } from "@/components/copilot/CopilotPanel";
import { GlobalLeadDrawer } from "@/components/GlobalLeadDrawer";
import { Softphone } from "./components/telephony/Softphone";
import { useAuth } from "@/hooks/useAuth";

// Lightweight fallback shown while a lazy route chunk downloads
const RouteFallback = () => (
  <div className="flex items-center justify-center h-full w-full py-24">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);

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
      <ChatProvider>
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
            <Suspense fallback={<RouteFallback />}>
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
              {/* DEPRECATED: legacy WhatsApp Campaigns page did a client-side per-recipient
                  send loop (no campaign row, dropped scheduling). Superseded by the
                  server-backed /crm/campaigns. Route kept as a redirect; page file retained. */}
              <Route path="/whatsapp/campaigns" element={<Navigate to="/crm/campaigns" replace />} />
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
              <Route path="/telephony/dashboard" element={<ModuleProtectedRoute requiredModule="telephony" requiredPermission="telephony.analytics.view"><TelephonyDashboardPage /></ModuleProtectedRoute>} />
              <Route path="/telephony/campaigns" element={<ModuleProtectedRoute requiredModule="telephony" requiredPermission="telephony.campaigns.view"><CampaignsPage /></ModuleProtectedRoute>} />

              {/* Real Estate Routes */}
              <Route path="/real-estate/projects" element={<ModuleProtectedRoute requiredModule="real_estate"><RealEstateProjectsPage /></ModuleProtectedRoute>} />
              <Route path="/real-estate/projects/:id" element={<ModuleProtectedRoute requiredModule="real_estate"><RealEstateProjectDetailPage /></ModuleProtectedRoute>} />

              {/* 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
          </main>
        </div>
        {/* AI copilot right slide-out panel (toggled from the header bot button) */}
        <CopilotPanel />
      </div>
      {/* App-wide Lead Details drawer — openable from any page via useLeadDrawerStore */}
      <GlobalLeadDrawer />
      </ChatProvider>
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
