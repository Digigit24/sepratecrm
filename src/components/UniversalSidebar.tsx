import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Mail,
  Stethoscope,
  Database,
  ChevronDown,
  ChevronRight,
  Users,
  Calendar,
  ClipboardList,
  Menu,
  X,
  Building2,
  UserCheck,
  Activity,
  Kanban,
  MessageCircle,
  FileText,
  Send,
  CheckSquare,
  Award,
  User,
  ClipboardPlus,
  Microscope,
  Package,
  Receipt,
  Shield,
  Settings2,
  UserCog,
  ShieldCheck,
  Bug,
  IndianRupee,
  CreditCard,
  TrendingUp,
  Workflow,
  QrCode,
  UserPlus,
  Pill, // Added Pill icon for Pharmacy module
  ShoppingCart, // Added ShoppingCart icon for Cart
  BarChart3, // Added for Statistics
  Loader2, // Added for loading state
  Bed, // Added for IPD module
  Building, // Added for Wards
  UserRoundCheck, // Added for Admissions
  FlaskConical, // Added for Diagnostics module
  Plug, // Added for Integrations
  Zap, // Added for Workflows
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { Icon3D } from "@/components/Icon3D";

interface MenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  path?: string;
  badge?: number;
  children?: MenuItem[];
  module?: string; // Module required to access this menu item
}

const menuItems: MenuItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    path: "/",
    // No module required - Dashboard is always accessible
  },
  // {
  //   id: "inbox",
  //   label: "Inbox",
  //   icon: Mail,
  //   path: "/inbox",
  //   badge: 3,
  // },

  {
    id: "whatsapp",
    label: "WhatsApp",
    icon: MessageCircle,
    module: "whatsapp",
    children: [
      {
        id: "whatsapp-onboarding",
        label: "Onboarding",
        icon: UserPlus,
        path: "/whatsapp/onboarding",
      },
      {
        id: "whatsapp-contacts",
        label: "Contacts",
        icon: Users,
        path: "/whatsapp/contacts",
      },
      {
        id: "whatsapp-chats",
        label: "Chats",
        icon: MessageCircle,
        path: "/whatsapp/chats",
      },
      {
        id: "whatsapp-groups",
        label: "Groups",
        icon: Users,
        path: "/whatsapp/groups",
      },
      {
        id: "whatsapp-templates",
        label: "Templates",
        icon: FileText,
        path: "/whatsapp/templates",
      },
      {
        id: "whatsapp-campaigns",
        label: "Campaigns",
        icon: Send,
        path: "/whatsapp/campaigns",
      },
      {
        id: "whatsapp-flows",
        label: "Flows",
        icon: Workflow,
        path: "/whatsapp/flows",
      },
      {
        id: "whatsapp-qrcode",
        label: "QR Codes",
        icon: QrCode,
        path: "/whatsapp/qrcode",
      },
    ],
  },
  {
    id: "crm",
    label: "CRM",
    icon: Building2,
    module: "crm",
    children: [
      {
        id: "crm-leads",
        label: "Leads",
        icon: Users,
        path: "/crm/leads",
      },
      {
        id: "crm-activities",
        label: "Activities",
        icon: Activity,
        path: "/crm/activities",
      },
      {
        id: "crm-statuses",
        label: "Lead Statuses",
        icon: ClipboardList,
        path: "/crm/statuses",
      },
      // {
      //   id: "crm-pipeline",
      //   label: "Pipeline",
      //   icon: Kanban,
      //   path: "/crm/pipeline",
      // },
      {
        id: "crm-tasks",
        label: "Tasks",
        icon: CheckSquare,
        path: "/crm/tasks",
      },
      {
        id: "crm-meetings",
        label: "Meetings",
        icon: Calendar,
        path: "/crm/meetings",
      },
      {
        id: "crm-settings",
        label: "Settings",
        icon: Settings2,
        path: "/crm/settings",
      },
    ],
  },
  {
    id: "integrations",
    label: "Integrations",
    icon: Plug,
    module: "integrations",
    children: [
      {
        id: "integrations-overview",
        label: "Overview",
        icon: LayoutDashboard,
        path: "/integrations",
      },
      {
        id: "integrations-workflows",
        label: "Workflows",
        icon: Zap,
        path: "/integrations",
      },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    icon: Shield,
    module: "admin",
    children: [
      {
        id: "admin-users",
        label: "Users",
        icon: UserCog,
        path: "/admin/users",
      },
      {
        id: "admin-roles",
        label: "Roles",
        icon: ShieldCheck,
        path: "/admin/roles",
      },
      {
        id: "admin-settings",
        label: "Settings",
        icon: Settings2,
        path: "/admin/settings",
      },
      {
        id: "admin-debug",
        label: "Debug",
        icon: Bug,
        path: "/admin/debug",
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

  // Get tenant data - prioritize API data, fallback to user context
  const tenantData = currentTenant || user?.tenant;

  // Get tenant logo from settings
  // Logo can be a URL or base64 string (data:image/...;base64,...)
  const tenantLogo = tenantData?.settings?.logo && tenantData?.settings?.logo.trim() !== ''
    ? tenantData.settings.logo
    : undefined;
  const tenantName = tenantData?.name || 'HMS';

  // Filter menu items based on enabled modules
  const filteredMenuItems = menuItems.filter((item) => {
    // If no module is specified, item is always visible (e.g., Dashboard)
    if (!item.module) return true;

    // Check if user has access to the module
    return hasModuleAccess(item.module);
  });

  // Debug logging
  console.log('Tenant data:', {
    hasTenant: !!tenantData,
    hasSettings: !!tenantData?.settings,
    logoValue: tenantData?.settings?.logo,
    logoLength: tenantData?.settings?.logo?.length,
    tenantName: tenantData?.name,
    isBase64: tenantData?.settings?.logo?.startsWith('data:image'),
    fromAPI: !!currentTenant,
    isLoading: isTenantLoading
  });

  // Reset logo error when logo changes
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
    if (setMobileOpen) {
      setMobileOpen(false);
    }
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full relative">
      {/* Logo Area */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
        {!collapsed && (
          <div className="flex items-center gap-3">
            {isTenantLoading ? (
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : tenantLogo && !logoError ? (
              <img
                src={tenantLogo}
                alt={`${tenantName} logo`}
                className="w-20 h-20 object-contain rounded-lg"
                onError={handleLogoError}
              />
            ) : (
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center shrink-0">
                <Icon3D icon={Stethoscope} className="w-6 h-6" />
              </div>
            )}
          </div>
        )}
        {collapsed && (
          isTenantLoading ? (
            <div className="w-8 h-8 flex items-center justify-center mx-auto">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : tenantLogo && !logoError ? (
            <img
              src={tenantLogo}
              alt={`${tenantName} logo`}
              className="w-8 h-8 object-contain rounded-lg mx-auto"
              onError={handleLogoError}
            />
          ) : (
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center mx-auto">
              <Icon3D icon={Stethoscope} className="w-5 h-5" />
            </div>
          )
        )}
        {mobileOpen && setMobileOpen && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(false)}
            className="lg:hidden"
          >
            <Icon3D icon={X} className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Navigation Menu */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {filteredMenuItems.map((item) => {
            if (item.children) {
              // Menu item with children (collapsible)
              const isOpen = openSections.includes(item.id);
              const hasActiveChild = isParentActive(item.children);

              return (
                <Collapsible
                  key={item.id}
                  open={isOpen}
                  onOpenChange={() => toggleSection(item.id)}
                >
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className={cn(
                        "w-full justify-start gap-3 h-10 px-3",
                        hasActiveChild && "bg-sidebar-accent text-sidebar-accent-foreground",
                        collapsed && "justify-center px-2"
                      )}
                    >
                      <Icon3D icon={item.icon} className="h-5 w-5 shrink-0" />
                      {!collapsed && (
                        <>
                          <span className="flex-1 text-left">{item.label}</span>
                          {isOpen ? (
                            <Icon3D icon={ChevronDown} className="h-4 w-4 shrink-0" />
                          ) : (
                            <Icon3D icon={ChevronRight} className="h-4 w-4 shrink-0" />
                          )}
                        </>
                      )}
                    </Button>
                  </CollapsibleTrigger>

                  {!collapsed && (
                    <CollapsibleContent className="pl-4 mt-1 space-y-1">
                      {item.children.map((child) => (
                        <Link
                          key={child.id}
                          to={child.path || "#"}
                          onClick={closeMobileSidebar}
                        >
                          <Button
                            variant="ghost"
                            className={cn(
                              "w-full justify-start gap-3 h-9 px-3",
                              isActive(child.path) &&
                                "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                            )}
                          >
                            <Icon3D icon={child.icon} className="h-4 w-4 shrink-0" />
                            <span className="text-sm">{child.label}</span>
                          </Button>
                        </Link>
                      ))}
                    </CollapsibleContent>
                  )}
                </Collapsible>
              );
            }

            // Regular menu item
            return (
              <Link
                key={item.id}
                to={item.path || "#"}
                onClick={closeMobileSidebar}
              >
                <Button
                  variant="ghost"
                  className={cn(
                    "w-full justify-start gap-3 h-10 px-3",
                    isActive(item.path) &&
                      "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
                    collapsed && "justify-center px-2"
                  )}
                >
                  <Icon3D icon={item.icon} className="h-5 w-5 shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="flex-1 text-left">{item.label}</span>
                      {item.badge && (
                        <Badge variant="destructive" className="min-w-[20px] justify-center">
                          {item.badge}
                        </Badge>
                      )}
                    </>
                  )}
                </Button>
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Gradient Blob - Bottom Left Corner */}
      <div className="absolute bottom-0 left-0 w-80 h-80 pointer-events-none overflow-hidden">
        <div
          className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full opacity-30 blur-3xl"
          style={{
            background: 'linear-gradient(135deg, #a78bfa 0%, #60a5fa 50%, #818cf8 100%)',
          }}
        />
      </div>

      {/* Collapse Button (Desktop only) */}
      {!mobileOpen && onCollapse && (
        <div className="p-3 border-t border-sidebar-border relative z-10">
          <Button
            variant="ghost"
            onClick={onCollapse}
            className={cn(
              "w-full justify-start gap-3 h-10",
              collapsed && "justify-center"
            )}
          >
            <Icon3D icon={Menu} className="h-5 w-5 shrink-0" />
            {!collapsed && <span>Collapse</span>}
          </Button>
        </div>
      )}
    </div>
  );

  // Render both mobile and desktop sidebars
  // CSS classes control which one is visible based on screen size
  return (
    <>
      {/* Mobile Overlay - only show on mobile when drawer is open */}
      {mobileOpen && setMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar (Drawer) - hidden on desktop (lg:hidden) */}
      {setMobileOpen && (
        <aside
          className={cn(
            "fixed top-0 left-0 h-full w-72 bg-sidebar text-sidebar-foreground border-r border-sidebar-border z-50 transition-transform duration-300 lg:hidden",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <SidebarContent />
        </aside>
      )}

      {/* Desktop Sidebar - hidden on mobile (hidden lg:block) */}
      <aside
        className={cn(
          "h-screen bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300 hidden lg:block",
          collapsed ? "w-16" : "w-64"
        )}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
