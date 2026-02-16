// src/components/SideDrawer.tsx
import * as React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Loader2, X, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

type DrawerMode = 'view' | 'edit' | 'create';

export type DrawerActionButton = {
  label: string;
  onClick: () => void;
  variant?: 'default' | 'outline' | 'destructive' | 'secondary' | 'ghost' | 'link';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  iconPosition?: 'left' | 'right';
  className?: string;
};

export type DrawerHeaderAction = {
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  label: string;
  variant?: 'ghost' | 'outline' | 'secondary';
  disabled?: boolean;
};

export interface SideDrawerProps {
  // Core state management
  open: boolean;
  onOpenChange: (open: boolean) => void;

  // Header configuration
  title: string;
  description?: string;
  mode?: DrawerMode;
  
  // Header actions (e.g., edit button, delete button)
  headerActions?: DrawerHeaderAction[];

  // Loading state
  isLoading?: boolean;
  loadingText?: string;

  // Main content
  children: React.ReactNode;

  // Footer configuration
  footerButtons?: DrawerActionButton[];
  footerAlignment?: 'left' | 'right' | 'center' | 'between';

  // Appearance
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  showBackButton?: boolean; // New: Shows back button instead of close on mobile
  preventClose?: boolean;

  // Resizable drawer
  resizable?: boolean;
  minWidth?: number;
  maxWidth?: number;
  storageKey?: string; // Key for localStorage to persist width

  // Callbacks
  onClose?: () => void;
  
  // Custom classes
  className?: string;
  contentClassName?: string;
  headerClassName?: string;
  footerClassName?: string;
}

// Size to pixel mapping
const SIZE_MAP = {
  sm: 384,
  md: 448,
  lg: 672,
  xl: 768,
  '2xl': 896,
};

/**
 * A robust, reusable side drawer component with:
 * - Resizable width with drag handle
 * - Width persistence in localStorage
 * - Back button for mobile navigation
 * - Clean separation between header, content, and footer
 * - Loading states and smooth animations
 */
export function SideDrawer({
  open,
  onOpenChange,
  title,
  description,
  mode,
  headerActions,
  isLoading = false,
  loadingText = 'Loading...',
  children,
  footerButtons,
  footerAlignment = 'right',
  size = 'lg',
  showBackButton = true,
  preventClose = false,
  resizable = true,
  minWidth = 320,
  maxWidth = 1200,
  storageKey,
  onClose,
  className,
  contentClassName,
  headerClassName,
  footerClassName,
}: SideDrawerProps) {
  // Get storage key with fallback
  const effectiveStorageKey = storageKey || `sidedrawer-width-${title.toLowerCase().replace(/\s+/g, '-')}`;
  
  // Initialize width from localStorage or default size
  const [drawerWidth, setDrawerWidth] = React.useState<number>(() => {
    if (typeof window === 'undefined') return SIZE_MAP[size];
    
    try {
      const saved = localStorage.getItem(effectiveStorageKey);
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (parsed >= minWidth && parsed <= maxWidth) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load drawer width from localStorage:', e);
    }
    
    return SIZE_MAP[size];
  });

  const [isResizing, setIsResizing] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);

  // Detect mobile
  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640); // sm breakpoint
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Save width to localStorage
  const saveWidth = React.useCallback((width: number) => {
    try {
      localStorage.setItem(effectiveStorageKey, width.toString());
    } catch (e) {
      console.warn('Failed to save drawer width to localStorage:', e);
    }
  }, [effectiveStorageKey]);

  // Handle resize
  const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
    if (!resizable) return;
    
    e.preventDefault();
    setIsResizing(true);

    const startX = e.clientX;
    const startWidth = drawerWidth;

    const handleMouseMove = (e: MouseEvent) => {
      const delta = startX - e.clientX; // Reverse delta since drawer is on right
      const newWidth = Math.min(maxWidth, Math.max(minWidth, startWidth + delta));
      setDrawerWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      saveWidth(drawerWidth);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [resizable, drawerWidth, minWidth, maxWidth, saveWidth]);

  // Footer alignment classes
  const footerAlignmentClasses = {
    left: 'justify-start',
    right: 'justify-end',
    center: 'justify-center',
    between: 'justify-between',
  };

  // Handle drawer close
  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!nextOpen && preventClose) {
        return;
      }
      
      if (!nextOpen && onClose) {
        onClose();
      }
      
      onOpenChange(nextOpen);
    },
    [onOpenChange, onClose, preventClose]
  );

  // Auto-generate description based on mode if not provided
  const autoDescription = React.useMemo(() => {
    if (description) return description;
    
    switch (mode) {
      case 'create':
        return 'Fill in the details below to create a new record';
      case 'edit':
        return 'Modify the details below to update the record';
      case 'view':
        return 'Review the details below';
      default:
        return undefined;
    }
  }, [mode, description]);

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        className={cn(
          'w-full flex flex-col p-0 gap-0',
          // Remove default max-width classes from shadcn
          '[&>button]:hidden', // Hide the default close button from SheetContent
          className
        )}
        style={{
          maxWidth: isMobile ? '100vw' : `${drawerWidth}px`,
          transition: isResizing ? 'none' : 'max-width 0.2s ease-in-out',
        }}
        onInteractOutside={(e) => {
          if (preventClose) {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          if (preventClose) {
            e.preventDefault();
          }
        }}
      >
        {/* Resize Handle */}
        {resizable && !isMobile && (
          <div
            className={cn(
              'absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/20 active:bg-primary/30 transition-colors z-50',
              isResizing && 'bg-primary/30'
            )}
            onMouseDown={handleMouseDown}
          >
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-16 bg-primary/50 rounded-r" />
          </div>
        )}

        {/* ===== HEADER ===== */}
        <div
          className={cn(
            'flex-shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
            headerClassName
          )}
        >
          <div className="px-4 sm:px-6 py-3 sm:py-4 flex items-start justify-between gap-3">
            {/* Left Side: Back/Close Button + Title */}
            <div className="flex items-start gap-3 flex-1 min-w-0">
              {/* Back Button (Mobile) or Close Button (Desktop) */}
              {!preventClose && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleOpenChange(false)}
                  className={cn(
                    'h-8 w-8 flex-shrink-0 text-muted-foreground hover:text-foreground',
                    isMobile ? 'flex' : 'hidden sm:flex'
                  )}
                  aria-label={isMobile ? 'Go back' : 'Close drawer'}
                >
                  {showBackButton && isMobile ? (
                    <ChevronLeft className="h-5 w-5" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                </Button>
              )}

              {/* Title Section */}
              <div className="flex-1 min-w-0 space-y-1">
                <SheetHeader className="text-left space-y-0 p-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <SheetTitle className="text-base sm:text-lg font-semibold tracking-tight">
                      {title}
                    </SheetTitle>
                    
                    {mode && (
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                          mode === 'create' &&
                            'bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20',
                          mode === 'edit' &&
                            'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20',
                          mode === 'view' &&
                            'bg-gray-50 text-gray-700 ring-1 ring-inset ring-gray-600/20'
                        )}
                      >
                        {mode.charAt(0).toUpperCase() + mode.slice(1)}
                      </span>
                    )}
                  </div>

                  {autoDescription && (
                    <SheetDescription className="text-xs sm:text-sm text-muted-foreground pt-1">
                      {autoDescription}
                    </SheetDescription>
                  )}
                </SheetHeader>
              </div>
            </div>

            {/* Right Side: Header Actions */}
            {headerActions && headerActions.length > 0 && (
              <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                {headerActions.map((action, idx) => {
                  const Icon = action.icon;
                  return (
                    <Button
                      key={idx}
                      variant={action.variant || 'ghost'}
                      size="icon"
                      onClick={action.onClick}
                      disabled={action.disabled}
                      className="h-7 w-7 sm:h-8 sm:w-8"
                      aria-label={action.label}
                    >
                      <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </Button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ===== CONTENT ===== */}
        <div className={cn('flex-1 min-h-0 relative', contentClassName)}>
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-sm font-medium">{loadingText}</p>
              </div>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="px-4 sm:px-6 py-4 sm:py-6">{children}</div>
            </ScrollArea>
          )}
        </div>

        {/* ===== FOOTER ===== */}
        {footerButtons && footerButtons.length > 0 && (
          <>
            <Separator />
            <div
              className={cn(
                'flex-shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
                footerClassName
              )}
            >
              <div className="px-4 sm:px-6 py-3 sm:py-4">
                <div
                  className={cn(
                    'flex flex-col-reverse sm:flex-row flex-wrap gap-2',
                    footerAlignmentClasses[footerAlignment]
                  )}
                >
                  {footerButtons.map((button, idx) => {
                    const Icon = button.icon;
                    const iconPosition = button.iconPosition || 'left';

                    return (
                      <Button
                        key={idx}
                        variant={button.variant || 'default'}
                        disabled={button.disabled || button.loading}
                        onClick={button.onClick}
                        className={cn(
                          'w-full sm:w-auto sm:min-w-[100px]',
                          button.className
                        )}
                      >
                        {button.loading && (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        )}
                        
                        {!button.loading && Icon && iconPosition === 'left' && (
                          <Icon className="h-4 w-4 mr-2" />
                        )}
                        
                        <span>{button.label}</span>
                        
                        {!button.loading && Icon && iconPosition === 'right' && (
                          <Icon className="h-4 w-4 ml-2" />
                        )}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

// Export types for consumers
export type { DrawerMode };