import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Home, 
  MessageCircle, 
  Phone, 
  Settings, 
  LayoutDashboard, 
  Clipboard 
} from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggleCollapse }) => {
  const location = useLocation();

  const sidebarItems = [
    { 
      name: "Dashboard", 
      icon: LayoutDashboard, 
      path: "/",
      section: "Main"
    },
    { 
      name: "Channels", 
      icon: null, 
      type: "header",
      section: "Main"
    },
    { 
      name: "WhatsApp", 
      icon: Phone, 
      path: "/channels/whatsapp",
      section: "Channels"
    },
    { 
      name: "Instagram", 
      icon: MessageCircle, 
      path: "/channels/instagram",
      section: "Channels"
    },
    { 
      name: "Website", 
      icon: Home, 
      path: "/channels/website",
      section: "Channels"
    },
    { 
      name: "Operations", 
      icon: null, 
      type: "header",
      section: "Operations"
    },
    { 
      name: "OPD", 
      icon: Clipboard, 
      path: "/opd",
      section: "Operations"
    }
  ];

  const renderSidebarItem = (item: any) => {
    if (item.type === 'header') {
      return (
        <div 
          key={item.name} 
          className="text-xs text-gray-500 mt-4 mb-2 px-4"
        >
          {!collapsed && item.name}
        </div>
      );
    }

    const Icon = item.icon;
    const isActive = location.pathname === item.path;

    return (
      <Link
        key={item.name}
        to={item.path}
        className={`
          flex items-center p-2 rounded-md transition-colors duration-200
          ${isActive ? 'bg-gray-200' : 'hover:bg-gray-100'}
        `}
      >
        {Icon && <Icon className="w-5 h-5 mr-3" />}
        {!collapsed && <span>{item.name}</span>}
      </Link>
    );
  };

  return (
    <div 
      className={`
        bg-white border-r transition-width duration-300
        ${collapsed ? 'w-16' : 'w-64'}
        flex flex-col h-full p-4
      `}
    >
      <div className="flex justify-between items-center mb-6">
        {!collapsed && <h2 className="text-xl font-bold">Chat App</h2>}
        <button 
          onClick={onToggleCollapse} 
          className="p-2 rounded-full hover:bg-gray-100"
        >
          {collapsed ? '→' : '←'}
        </button>
      </div>

      <nav className="space-y-2">
        {sidebarItems.map(renderSidebarItem)}
      </nav>

      <div className="mt-auto">
        <button className="w-full flex items-center p-2 hover:bg-gray-100 rounded-md">
          <Settings className="w-5 h-5 mr-3" />
          {!collapsed && <span>Settings</span>}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;