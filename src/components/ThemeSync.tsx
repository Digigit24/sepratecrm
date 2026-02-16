// src/components/ThemeSync.tsx
import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { authService } from '@/services/authService';

/**
 * Component to sync user preferences theme with next-themes
 * Must be placed inside ThemeProvider
 */
export const ThemeSync = () => {
  const { setTheme, resolvedTheme } = useTheme();

  useEffect(() => {
    // Get user preferences from authService
    const user = authService.getUser();
    const userTheme = user?.preferences?.theme;

    console.log('🎨 ThemeSync: Checking user theme preference', {
      userTheme,
      currentTheme: resolvedTheme,
    });

    // If user has a theme preference, apply it
    if (userTheme && userTheme !== resolvedTheme) {
      console.log(`🎨 ThemeSync: Setting theme to ${userTheme}`);
      setTheme(userTheme);
    }
  }, [setTheme, resolvedTheme]);

  return null; // This component doesn't render anything
};
