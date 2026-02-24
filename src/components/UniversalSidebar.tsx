import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Stethoscope,
  ChevronDown,
  Users,
  Calendar,
  ClipboardList,
  X,
  Building2,
  Activity,
  MessageCircle,
  FileText,
  Send,
  CheckSquare,
  Settings2,
  UserCog,
  ShieldCheck,
  Bug,
  Workflow,
  QrCode,
  UserPlus,
  Shield,
  Plug,
  Zap,
  Loader2,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";

interface MenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  path?: string;
  badge?: number;
  children?: MenuItem[];
  module?: string;
}

interface MenuSection {
  label?: string;
  items: MenuItem[];
}

const menuSections: MenuSection[] = [
  {
    items: [
      {
        id: "dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        path: "/",
      },
    ],
  },
  {
    label: "COMMUNICATION",
    items: [
      {
        id: "whatsapp",
        label: "WhatsApp",
        icon: MessageCircle,
        module: "whatsapp",
        children: [
          { id: "whatsapp-onboarding", label: "Onboarding", icon: UserPlus, path: "/whatsapp/onboarding" },
          { id: "whatsapp-contacts", label: "Contacts", icon: Users, path: "/whatsapp/contacts" },
          { id: "whatsapp-chats", label: "Chats", icon: MessageCircle, path: "/whatsapp/chats" },
          { id: "whatsapp-groups", label: "Groups", icon: Users, path: "/whatsapp/groups" },
          { id: "whatsapp-templates", label: "Templates", icon: FileText, path: "/whatsapp/templates" },
          { id: "whatsapp-campaigns", label: "Campaigns", icon: Send, path: "/whatsapp/campaigns" },
          { id: "whatsapp-flows", label: "Flows", icon: Workflow, path: "/whatsapp/flows" },
          { id: "whatsapp-qrcode", label: "QR Codes", icon: QrCode, path: "/whatsapp/qrcode" },
        ],
      },
    ],
  },
  {
    label: "DATABASE",
    items: [
      {
        id: "crm",
        label: "CRM",
        icon: Building2,
        module: "crm",
        children: [
          { id: "crm-leads", label: "Leads", icon: Users, path: "/crm/leads" },
          { id: "crm-activities", label: "Activities", icon: Activity, path: "/crm/activities" },
          { id: "crm-statuses", label: "Lead Statuses", icon: ClipboardList, path: "/crm/statuses" },
          { id: "crm-tasks", label: "Tasks", icon: CheckSquare, path: "/crm/tasks" },
          { id: "crm-meetings", label: "Meetings", icon: Calendar, path: "/crm/meetings" },
          { id: "crm-settings", label: "Settings", icon: Settings2, path: "/crm/settings" },
        ],
      },
    ],
  },
  {
    label: "SYSTEM",
    items: [
      {
        id: "integrations",
        label: "Integrations",
        icon: Plug,
        module: "integrations",
        children: [
          { id: "integrations-overview", label: "Overview", icon: LayoutDashboard, path: "/integrations" },
          { id: "integrations-workflows", label: "Workflows", icon: Zap, path: "/integrations" },
        ],
      },
      {
        id: "admin",
        label: "Admin",
        icon: Shield,
        module: "admin",
        children: [
          { id: "admin-users", label: "Users", icon: UserCog, path: "/admin/users" },
          { id: "admin-roles", label: "Roles", icon: ShieldCheck, path: "/admin/roles" },
          { id: "admin-settings", label: "Settings", icon: Settings2, path: "/admin/settings" },
          { id: "admin-debug", label: "Debug", icon: Bug, path: "/admin/debug" },
        ],
      },
    ],
  },
];

interface UniversalSidebarProps {
  collapsed?: boolean;
  onCollapse?: () => void;
  mobileOpen?: boolean;
  setMobileOpen?: (open: boolean) => void;
}

export function UniversalSidebar({
  collapsed = false,
  onCollapse,
  mobileOpen = false,
  setMobileOpen,
}: UniversalSidebarProps) {
  const location = useLocation();
  const { user, hasModuleAccess } = useAuth();
  const { useCurrentTenant } = useTenant();
  const { data: currentTenant, isLoading: isTenantLoading } = useCurrentTenant();
  const [openSections, setOpenSections] = useState<string[]>(["masters"]);
  const [logoError, setLogoError] = useState(false);

  const tenantData = currentTenant || user?.tenant;
  const tenantLogo = tenantData?.settings?.logo && tenantData?.settings?.logo.trim() !== ''
    ? tenantData.settings.logo
    : undefined;
  const tenantName = tenantData?.name || 'HMS';

  const filterMenuItem = (item: MenuItem): boolean => {
    if (!item.module) return true;
    return hasModuleAccess(item.module);
  };

  useEffect(() => {
    setLogoError(false);
  }, [tenantLogo]);

  const handleLogoError = () => {
    console.error('Failed to load tenant logo:', tenantLogo);
    setLogoError(true);
  };

  const toggleSection = (sectionId: string) => {
    setOpenSections((prev) =>
      prev.includes(sectionId)
        ? prev.filter((id) => id !== sectionId)
        : [...prev, sectionId]
    );
  };

  const isActive = (path?: string) => {
    if (!path) return false;
    return location.pathname === path;
  };

  const isParentActive = (children?: MenuItem[]) => {
    if (!children) return false;
    return children.some((child) => child.path && location.pathname === child.path);
  };

  const closeMobileSidebar = () => {
    if (setMobileOpen) setMobileOpen(false);
  };

  const renderMenuItem = (item: MenuItem) => {
    if (item.children) {
      const isOpen = openSections.includes(item.id);
      const hasActiveChild = isParentActive(item.children);

      return (
        <Collapsible
          key={item.id}
          open={isOpen}
          onOpenChange={() => toggleSection(item.id)}
        >
          <CollapsibleTrigger asChild>
            <button
              className={cn(
                "w-full flex items-center gap-3 h-9 px-3 rounded-lg text-[13px] font-medium transition-all duration-150",
                "text-muted-foreground hover:text-foreground hover:bg-muted/80",
                hasActiveChild && "text-foreground",
                collapsed && "justify-center px-2"
              )}
            >
              <item.icon className={cn(
                "h-[18px] w-[18px] shrink-0 transition-colors",
                hasActiveChild && "sidebar-active-icon"
              )} />
              {!collapsed && (
                <>
                  <span className="flex-1 text-left">{item.label}</span>
                  <ChevronDown className={cn(
                    "h-3.5 w-3.5 shrink-0 text-muted-foreground/60 transition-transform duration-200",
                    !isOpen && "-rotate-90"
                  )} />
                </>
              )}
            </button>
          </CollapsibleTrigger>

          {!collapsed && (
            <CollapsibleContent className="mt-0.5">
              <div className="ml-3 pl-3 border-l border-border/60 space-y-0.5">
                {item.children.map((child) => (
                  <Link
                    key={child.id}
                    to={child.path || "#"}
                    onClick={closeMobileSidebar}
                  >
                    <div
                      className={cn(
                        "flex items-center gap-3 h-8 px-3 rounded-lg text-[13px] transition-all duration-150",
                        "text-muted-foreground hover:text-foreground hover:bg-muted/80",
                        isActive(child.path) &&
                          "text-foreground sidebar-active font-medium -ml-[13px] pl-[23px]"
                      )}
                    >
                      <child.icon className={cn(
                        "h-[16px] w-[16px] shrink-0",
                        isActive(child.path) && "sidebar-active-icon"
                      )} />
                      <span>{child.label}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </CollapsibleContent>
          )}
        </Collapsible>
      );
    }

    return (
      <Link
        key={item.id}
        to={item.path || "#"}
        onClick={closeMobileSidebar}
      >
        <div
          className={cn(
            "flex items-center gap-3 h-9 px-3 rounded-lg text-[13px] font-medium transition-all duration-150",
            "text-muted-foreground hover:text-foreground hover:bg-muted/80",
            isActive(item.path) &&
              "text-foreground sidebar-active -ml-0.5 pl-[10px]",
            collapsed && "justify-center px-2"
          )}
        >
          <item.icon className={cn(
            "h-[18px] w-[18px] shrink-0",
            isActive(item.path) && "sidebar-active-icon"
          )} />
          {!collapsed && (
            <span className="flex-1 text-left">{item.label}</span>
          )}
        </div>
      </Link>
    );
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo Area */}
      <div className="h-14 flex items-center justify-center px-4 border-b border-border/40 relative">
        {!collapsed && (
          <div className="flex items-center justify-center flex-1">
            {isTenantLoading ? (
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            ) : tenantLogo && !logoError ? (
              <img
                src={tenantLogo}
                alt={`${tenantName} logo`}
                className="h-8 w-auto max-w-[120px] object-contain rounded-lg"
                onError={handleLogoError}
              />
            ) : (
              <div className="w-8 h-8 bg-foreground rounded-lg flex items-center justify-center shrink-0">
                <Stethoscope className="w-4 h-4 text-background" />
              </div>
            )}
          </div>
        )}
        {collapsed && (
          isTenantLoading ? (
            <div className="w-7 h-7 flex items-center justify-center mx-auto">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          ) : tenantLogo && !logoError ? (
            <img
              src={tenantLogo}
              alt={`${tenantName} logo`}
              className="w-7 h-7 object-contain rounded-lg mx-auto"
              onError={handleLogoError}
            />
          ) : (
            <div className="w-7 h-7 bg-foreground rounded-lg flex items-center justify-center mx-auto">
              <Stethoscope className="w-3.5 h-3.5 text-background" />
            </div>
          )
        )}
        {mobileOpen && setMobileOpen && (
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden absolute right-3 p-1.5 rounded-md hover:bg-accent"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 px-3 py-2">
        <nav className="space-y-1">
          {menuSections.map((section, sectionIdx) => {
            const filteredItems = section.items.filter(filterMenuItem);
            if (filteredItems.length === 0) return null;

            return (
              <div key={sectionIdx} className={cn(sectionIdx > 0 && "pt-4")}>
                {/* Section Label */}
                {section.label && !collapsed && (
                  <div className="px-3 pb-2">
                    <span className="text-[10px] font-semibold tracking-widest text-muted-foreground/50 uppercase">
                      {section.label}
                    </span>
                  </div>
                )}
                {section.label && collapsed && (
                  <div className="flex justify-center pb-2">
                    <div className="w-5 h-px bg-border" />
                  </div>
                )}

                <div className="space-y-0.5">
                  {filteredItems.map(renderMenuItem)}
                </div>
              </div>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Collapse Button */}
      {!mobileOpen && onCollapse && (
        <div className="p-3 border-t border-border/40">
          <button
            onClick={onCollapse}
            className={cn(
              "w-full flex items-center gap-3 h-9 px-3 rounded-lg text-[13px] font-medium transition-all duration-150",
              "text-muted-foreground hover:text-foreground hover:bg-muted/80",
              collapsed && "justify-center"
            )}
          >
            {collapsed ? (
              <PanelLeft className="h-[18px] w-[18px] shrink-0" />
            ) : (
              <>
                <PanelLeftClose className="h-[18px] w-[18px] shrink-0" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile Overlay */}
      {mobileOpen && setMobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      {setMobileOpen && (
        <aside
          className={cn(
            "fixed top-0 left-0 h-full w-64 bg-background border-r border-border/40 z-50 transition-transform duration-300 lg:hidden shadow-xl",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <SidebarContent />
        </aside>
      )}

      {/* Desktop Sidebar */}
      <aside
        className={cn(
          "h-screen bg-background border-r border-border/40 transition-all duration-300 hidden lg:block",
          collapsed ? "w-16" : "w-60"
        )}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
