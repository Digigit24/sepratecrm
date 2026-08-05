import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { Bell, BellRing, CheckCheck, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-is-mobile';
import { useNotifications } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';
import type { CRMNotification } from '@/types/notificationTypes';

const NotificationBell = ({ count }: { count: number }) => (
  <button
    type="button"
    className="relative rounded-lg p-2 transition-colors hover:bg-accent"
    aria-label={count ? `${count} unread notifications` : 'Notifications'}
  >
    <Bell className="h-4 w-4 text-muted-foreground" />
    {count > 0 && (
      <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground ring-2 ring-background">
        {count > 99 ? '99+' : count}
      </span>
    )}
  </button>
);

export const NotificationCenter = () => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const openNotification = useCallback((notification: CRMNotification) => {
    setOpen(false);
    if (notification.action_url) navigate(notification.action_url);
  }, [navigate]);

  const {
    notifications,
    unreadCount,
    isLoading,
    error,
    markRead,
    markAllRead,
    markSeen,
  } = useNotifications({ unreadOnly, onNotification: openNotification });

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) void markSeen();
  };

  const handleItemClick = async (notification: CRMNotification) => {
    await markRead(notification);
    openNotification(notification);
  };

  const panel = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3.5">
        <div>
          <h2 className="text-sm font-semibold">Notifications</h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {unreadCount ? `${unreadCount} unread reminder${unreadCount === 1 ? '' : 's'}` : 'You are all caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-[11px]" onClick={() => void markAllRead()}>
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all read
          </Button>
        )}
      </div>

      <div className="flex gap-1 border-b px-3 py-2">
        {([false, true] as const).map((onlyUnread) => (
          <button
            type="button"
            key={String(onlyUnread)}
            onClick={() => setUnreadOnly(onlyUnread)}
            className={cn(
              'rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
              unreadOnly === onlyUnread ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted',
            )}
          >
            {onlyUnread ? 'Unread' : 'All'}
          </button>
        ))}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {isLoading && !notifications ? (
          <div className="flex h-40 items-center justify-center text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : error ? (
          <div className="px-6 py-12 text-center text-xs text-muted-foreground">
            Notifications could not be loaded. They will retry automatically.
          </div>
        ) : notifications?.results.length ? (
          <div className="divide-y">
            {notifications.results.map((notification) => (
              <button
                type="button"
                key={notification.id}
                onClick={() => void handleItemClick(notification)}
                className={cn(
                  'group flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60',
                  !notification.is_read && 'bg-primary/[0.045]',
                )}
              >
                <span className={cn(
                  'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                  notification.is_read ? 'bg-muted text-muted-foreground' : 'bg-primary/10 text-primary',
                )}>
                  <BellRing className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className={cn('truncate text-xs', !notification.is_read && 'font-semibold')}>
                      {notification.title}
                    </span>
                    {!notification.is_read && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-[11px] leading-4 text-muted-foreground">
                    {notification.body}
                  </span>
                  <span className="mt-1.5 block text-[10px] text-muted-foreground/80">
                    {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                  </span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex h-52 flex-col items-center justify-center px-6 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
              <Bell className="h-5 w-5 text-muted-foreground" />
            </span>
            <p className="mt-3 text-xs font-medium">{unreadOnly ? 'No unread notifications' : 'No notifications yet'}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">Follow-up reminders will appear here.</p>
          </div>
        )}
      </ScrollArea>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetTrigger asChild><span><NotificationBell count={unreadCount} /></span></SheetTrigger>
        <SheetContent side="right" className="w-[92vw] p-0 sm:max-w-sm">{panel}</SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild><span><NotificationBell count={unreadCount} /></span></PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="h-[min(560px,calc(100vh-5rem))] w-[380px] overflow-hidden rounded-xl p-0 shadow-xl">
        {panel}
      </PopoverContent>
    </Popover>
  );
};

