// src/components/ThemeSync.tsx
import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { authService } from '@/services/authService';
import { sanitizeThemeValue } from '@/lib/storageGuard';

/**
 * Component to sync user preferences theme with next-themes
 * Must be placed inside ThemeProvider
 *
 * IMPORTANT: the raw preference value is NEVER passed to setTheme directly.
 * next-themes persists whatever it receives into localStorage and applies it
 * via classList.add — an unvalidated legacy value (object, quoted string,
 * arbitrary text) would poison 'celiyo-theme' and crash every future load.
 * sanitizeThemeValue guarantees only 'light' | 'dark' can get through.
 */
export const ThemeSync = () => {
  const { setTheme, resolvedTheme } = useTheme();

  useEffect(() => {
    try {
      // Get user preferences from authService (accepts legacy formats)
      const user = authService.getUser();
      const userTheme = sanitizeThemeValue(user?.preferences?.theme);

      // Only apply valid, changed values — invalid ones are ignored and the
      // current (default) theme stays in effect.
      if (userTheme && userTheme !== resolvedTheme) {
        setTheme(userTheme);
      }
    } catch {
      // A bad preference must never break rendering — keep current theme.
    }
  }, [setTheme, resolvedTheme]);

  return null; // This component doesn't render anything
};
