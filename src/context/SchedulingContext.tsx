// ==================== SCHEDULING CONTEXT ====================
// Context provider for WhatsApp message scheduling

import React, { createContext, useContext, useEffect, useCallback, useMemo } from 'react';
import { useScheduling, type UseSchedulingReturn } from '@/hooks/useScheduling';

// ==================== CONTEXT ====================

const SchedulingContext = createContext<UseSchedulingReturn | null>(null);

// ==================== PROVIDER PROPS ====================

interface SchedulingProviderProps {
  children: React.ReactNode;
  /**
   * Auto-fetch scheduled messages and events on mount
   * @default false
   */
  autoFetch?: boolean;
  /**
   * Auto-refresh interval in milliseconds
   * Set to 0 to disable auto-refresh
   * @default 0
   */
  refreshInterval?: number;
}

// ==================== PROVIDER ====================

export function SchedulingProvider({
  children,
  autoFetch = false,
  refreshInterval = 0,
}: SchedulingProviderProps) {
  const scheduling = useScheduling();

  const {
    getScheduledMessages,
    getScheduledEvents,
    getQueueStats,
    getHealth,
    isVendorConfigured,
  } = scheduling;

  // Initial fetch on mount
  useEffect(() => {
    if (autoFetch && isVendorConfigured) {
      // Fetch data on mount
      getScheduledMessages('scheduled');
      getScheduledEvents('active');
      getQueueStats();
      getHealth();
    }
  }, [autoFetch, isVendorConfigured, getScheduledMessages, getScheduledEvents, getQueueStats, getHealth]);

  // Auto-refresh interval
  useEffect(() => {
    if (refreshInterval > 0 && isVendorConfigured) {
      const intervalId = setInterval(() => {
        getScheduledMessages('scheduled');
        getScheduledEvents('active');
        getQueueStats();
      }, refreshInterval);

      return () => clearInterval(intervalId);
    }
  }, [refreshInterval, isVendorConfigured, getScheduledMessages, getScheduledEvents, getQueueStats]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => scheduling, [scheduling]);

  return (
    <SchedulingContext.Provider value={contextValue}>
      {children}
    </SchedulingContext.Provider>
  );
}

// ==================== HOOK ====================

/**
 * Hook to access the scheduling context
 * Must be used within a SchedulingProvider
 */
export function useSchedulingContext(): UseSchedulingReturn {
  const context = useContext(SchedulingContext);

  if (!context) {
    throw new Error('useSchedulingContext must be used within a SchedulingProvider');
  }

  return context;
}

// ==================== EXPORTS ====================

export { SchedulingContext };
export default SchedulingProvider;
