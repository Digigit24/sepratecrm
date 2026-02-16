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

// Map routes to titles
const routeTitles: Record<string, string> = {
  "/": "Dashboard",
  "/inbox": "Inbox",
  "/opd": "OPD",
  "/patients": "Patient Master",
  "/opd/consultation": "OPD Consultations",
};

// Dynamic route patterns (order matters - check from most specific to least)
const getDynamicTitle = (pathname: string): string | null => {
  if (pathname.startsWith("/opd/consultation/")) {
    return "OPD Consultations";
  }
  if (pathname.startsWith("/patients/") && pathname !== "/patients") {
    return "Patient Details Page";
  }
  return null;
};

// Get time-based greeting
const getTimeBasedGreeting = (): string => {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) {
    return "Good Morning";
  } else if (hour >= 12 && hour < 17) {
    return "Good Afternoon";
  } else if (hour >= 17 && hour < 21) {
    return "Good Evening";
  } else {
    return "Good Night";
  }
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

  // Get username from email or use first name if available
  const rawUsername = user?.first_name || user?.email?.split('@')[0] || 'User';
  // Capitalize first letter of username
  const username = rawUsername.charAt(0).toUpperCase() + rawUsername.slice(1).toLowerCase();
  const greeting = `👋 ${username}, ${getTimeBasedGreeting()}!`;

  // Get page title: check exact match first, then dynamic patterns, then fallback to "HMS"
  const getPageTitle = (): string => {
    const exactMatch = routeTitles[location.pathname];
    if (exactMatch) return exactMatch;

    const dynamicMatch = getDynamicTitle(location.pathname);
    if (dynamicMatch) return dynamicMatch;

    return "HMS";
  };

  const pageTitle = getPageTitle();

  const handleLogout = () => {
    logout();
  };

  const handleThemeToggle = () => {
    const newTheme = resolvedTheme === "dark" ? "light" : "dark";
    console.log('🎨 Theme toggle:', { current: resolvedTheme, new: newTheme });

    // Set theme in next-themes
    setTheme(newTheme);

    // Save to user preferences
    authService.updateUserPreferences({ theme: newTheme });
  };
  
  const handleNotificationClick = () => {
    navigate('/whatsapp/chats');
    clearNewMessageCount();
  }

  return (
    <header className="h-16 border-b border-border bg-background px-4 md:px-6 flex items-center justify-between">
      {/* Left Side - Logo and Title */}
      <div className="flex items-center gap-3">
        {isMobile && (
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            onClick={onMenuClick}
          >
            <Menu size={20} />
          </Button>
        )}
        <h1 className="text-xl font-semibold">{pageTitle}</h1>
      </div>

      {/* Right Side - Settings and Profile */}
      <div className="flex items-center gap-2">
        {/* WebSocket Status Indicator */}
        <div className="flex items-center gap-2 px-2" title={`WebSocket: ${socketStatus}`}>
          <div className={`h-2 w-2 rounded-full transition-colors ${
            socketStatus === 'open' ? 'bg-green-500 animate-pulse' :
            socketStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' :
            socketStatus === 'error' ? 'bg-red-500' :
            'bg-gray-400'
          }`} />
          <span className="text-xs text-muted-foreground hidden md:inline">
            {socketStatus === 'open' ? 'Connected' :
             socketStatus === 'connecting' ? 'Connecting...' :
             socketStatus === 'error' ? 'Error' :
             'Disconnected'}
          </span>
        </div>

        {/* Notification Button */}
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full"
          aria-label="Notifications"
          onClick={handleNotificationClick}
        >
          <Bell size={20} className="text-muted-foreground" />
          {newMessageCount > 0 && (
            <span className="absolute top-0 right-0 h-4 w-4 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
              {newMessageCount}
            </span>
          )}
        </Button>

        {/* Settings Button */}
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label="Settings"
        >
          <Settings size={20} className="text-muted-foreground" />
        </Button>

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full"
          aria-label="Toggle theme"
          onClick={handleThemeToggle}
        >
          <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>

        {/* Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-2 rounded-full px-3"
            >
              
              <span className="hidden md:inline text-sm">
                {user?.email}
              </span>
              <ChevronDown size={16} className="text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium">
                  {user?.email} 
                </p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer">
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-red-600 focus:text-red-600"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};