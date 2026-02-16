import { Settings, User, LogOut, ChevronDown, Sun, Moon, Bell, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "next-themes";
import { authService } from "@/services/authService";
import { useWebSocket } from "@/context/WebSocketProvider";
import { useIsMobile } from "@/hooks/use-is-mobile";

const routeTitles: Record<string, string> = {
  "/": "Dashboard",
  "/inbox": "Inbox",
  "/opd": "OPD",
  "/patients": "Patient Master",
  "/opd/consultation": "OPD Consultations",
};

const getDynamicTitle = (pathname: string): string | null => {
  if (pathname.startsWith("/opd/consultation/")) return "OPD Consultations";
  if (pathname.startsWith("/patients/") && pathname !== "/patients") return "Patient Details Page";
  return null;
};

const getTimeBasedGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good Morning";
  if (hour >= 12 && hour < 17) return "Good Afternoon";
  if (hour >= 17 && hour < 21) return "Good Evening";
  return "Good Night";
};

interface UniversalHeaderProps {
  onMenuClick: () => void;
}

export const UniversalHeader = ({ onMenuClick }: UniversalHeaderProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const { newMessageCount, clearNewMessageCount, socketStatus } = useWebSocket();
  const isMobile = useIsMobile();

  const rawUsername = user?.first_name || user?.email?.split('@')[0] || 'User';
  const username = rawUsername.charAt(0).toUpperCase() + rawUsername.slice(1).toLowerCase();

  const getPageTitle = (): string => {
    const exactMatch = routeTitles[location.pathname];
    if (exactMatch) return exactMatch;
    const dynamicMatch = getDynamicTitle(location.pathname);
    if (dynamicMatch) return dynamicMatch;
    return "HMS";
  };

  const pageTitle = getPageTitle();

  const handleLogout = () => { logout(); };

  const handleThemeToggle = () => {
    const newTheme = resolvedTheme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    authService.updateUserPreferences({ theme: newTheme });
  };

  const handleNotificationClick = () => {
    navigate('/whatsapp/chats');
    clearNewMessageCount();
  };

  return (
    <header className="h-14 border-b border-border bg-background px-4 md:px-5 flex items-center justify-between">
      {/* Left */}
      <div className="flex items-center gap-3">
        {isMobile && (
          <button
            onClick={onMenuClick}
            className="p-1.5 rounded-lg hover:bg-accent"
          >
            <Menu className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
        <div>
          <h1 className="text-sm font-semibold text-foreground">{pageTitle}</h1>
          <p className="text-xs text-muted-foreground hidden sm:block">
            {username}, {getTimeBasedGreeting()}
          </p>
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-1.5">
        {/* WebSocket Status */}
        <div className="flex items-center gap-1.5 px-2" title={`WebSocket: ${socketStatus}`}>
          <div className={`h-1.5 w-1.5 rounded-full ${
            socketStatus === 'open' ? 'bg-emerald-500' :
            socketStatus === 'connecting' ? 'bg-amber-500 animate-pulse' :
            socketStatus === 'error' ? 'bg-red-500' :
            'bg-gray-300'
          }`} />
          <span className="text-[11px] text-muted-foreground hidden md:inline">
            {socketStatus === 'open' ? 'Live' :
             socketStatus === 'connecting' ? 'Connecting' :
             socketStatus === 'error' ? 'Error' :
             'Offline'}
          </span>
        </div>

        {/* Notifications */}
        <button
          onClick={handleNotificationClick}
          className="relative p-2 rounded-lg hover:bg-accent transition-colors"
        >
          <Bell className="w-4 h-4 text-muted-foreground" />
          {newMessageCount > 0 && (
            <span className="absolute top-1 right-1 h-3.5 w-3.5 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center font-medium">
              {newMessageCount}
            </span>
          )}
        </button>

        {/* Settings */}
        <button className="p-2 rounded-lg hover:bg-accent transition-colors">
          <Settings className="w-4 h-4 text-muted-foreground" />
        </button>

        {/* Theme Toggle */}
        <button
          onClick={handleThemeToggle}
          className="p-2 rounded-lg hover:bg-accent transition-colors"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-muted-foreground" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-muted-foreground" />
        </button>

        {/* Profile */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-accent transition-colors">
              <div className="w-6 h-6 rounded-full bg-accent flex items-center justify-center">
                <span className="text-[11px] font-medium text-foreground">
                  {username.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="hidden md:inline text-xs text-foreground">{username}</span>
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>
              <div className="flex flex-col gap-0.5">
                <p className="text-sm font-medium">{username}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer text-sm">
              <User className="mr-2 h-3.5 w-3.5" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer text-sm">
              <Settings className="mr-2 h-3.5 w-3.5" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-red-600 focus:text-red-600 text-sm"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-3.5 w-3.5" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
