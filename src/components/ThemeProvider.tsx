'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}

export default function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [theme, setTheme] = useState<Theme>('light');

  // Read initial theme from the DOM (set by blocking script before hydration)
  useEffect(() => {
    const current = document.documentElement.getAttribute(
      'data-theme'
    ) as Theme | null;
    if (current === 'dark' || current === 'light') {
      setTheme(current);
    }
  }, []);

  // Follow system preference changes when no manual preference is stored
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    function onChange(e: MediaQueryListEvent) {
      if (!localStorage.getItem('theme')) {
        const next: Theme = e.matches ? 'dark' : 'light';
        setTheme(next);
        document.documentElement.setAttribute('data-theme', next);
      }
    }
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'light' ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
