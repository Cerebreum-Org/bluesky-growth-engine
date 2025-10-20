'use client';

import { createContext, useContext, useEffect, useState } from 'react';

interface DarkModeContextType {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

const DarkModeContext = createContext<DarkModeContextType | undefined>(undefined);

export function DarkModeProvider({ children }: { children: React.ReactNode }) {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check localStorage for saved preference or system preference
    const stored = localStorage.getItem('darkMode');
    if (stored) {
      setIsDarkMode(JSON.parse(stored));
    } else {
      setIsDarkMode(window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
  }, []);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
      if (isDarkMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [isDarkMode, mounted]);

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  // Always provide context, but with loading state
  const contextValue = {
    isDarkMode: mounted ? isDarkMode : false,
    toggleDarkMode: mounted ? toggleDarkMode : () => {}
  };

  return (
    <DarkModeContext.Provider value={contextValue}>
      {children}
    </DarkModeContext.Provider>
  );
}

export function useDarkMode() {
  const context = useContext(DarkModeContext);
  if (context === undefined) {
    // Provide fallback instead of throwing error
    console.warn('useDarkMode must be used within a DarkModeProvider, using fallback');
    return {
      isDarkMode: false,
      toggleDarkMode: () => {}
    };
  }
  return context;
}
