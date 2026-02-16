import { Home, Users, MessageCircle, Settings, Phone, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useState } from "react";

const channels = [
  { name: "WhatsApp", icon: <Phone size={16} />, id: "whatsapp" },
  { name: "Instagram", icon: <MessageCircle size={16} />, id: "instagram" },
  { name: "Website", icon: <Home size={16} />, id: "website" },
];

const labels = [
  { name: "Leads" },
  { name: "Support" },
  { name: "Internal" },
];

export const ChatSidebar = ({
  collapsed,
  onCollapse,
  mobileOpen,
  setMobileOpen,
}: {
  collapsed: boolean;
  onCollapse: () => void;
  mobileOpen?: boolean;
  setMobileOpen?: (open: boolean) => void;
}) => {
  const isMobile = useIsMobile();

  const sidebarContent = (
    <div className={`flex flex-col h-full bg-white ${collapsed && !isMobile ? "w-20" : "w-56"} min-h-screen`}>
      <div className="flex items-center justify-between h-16 border-b border-black/10 px-2">
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-black w-10 h-10 flex items-center justify-center text-white font-bold text-lg">
            C
          </div>
        </div>
        {!isMobile && (
          <button
            className="p-2 hover:bg-black/5 rounded"
            onClick={onCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Menu size={20} className="text-black/60" />
          </button>
        )}
      </div>
      <nav className="flex-1 flex flex-col gap-2 mt-4 px-2">
        <div>
          <div className="text-xs font-semibold mb-2 text-black/60">Channels</div>
          <ul className="space-y-1">
            {channels.map((c) => (
              <li key={c.id} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-black/5 cursor-pointer">
                <span>{c.icon}</span>
                {!collapsed && <span className="hidden md:inline text-sm">{c.name}</span>}
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-6">
          <div className="text-xs font-semibold mb-2 text-black/60">Labels</div>
          <ul className="space-y-1">
            {labels.map((l) => (
              <li key={l.name} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-black/5 cursor-pointer">
                <span className="w-2 h-2 rounded-full bg-black/40 inline-block" />
                {!collapsed && <span className="hidden md:inline text-sm">{l.name}</span>}
              </li>
            ))}
          </ul>
        </div>
      </nav>
      <div className="flex flex-col gap-4 items-center justify-end h-20 border-t border-black/10 mt-auto">
       
        <button className="p-2 hover:bg-black/5 rounded">
          <Settings  className="text-black/60" />
        </button>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <button className="p-2 m-2 fixed top-2 left-2 z-30 bg-white rounded shadow border border-black/10">
            <Menu size={24} />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-56 max-w-full">
          {sidebarContent}
        </SheetContent>
      </Sheet>
    );
  }

  return sidebarContent;
};