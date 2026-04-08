'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import type { ThemeId } from '@/lib/themes';

const ThemeContext = createContext<{ theme: ThemeId; setTheme: (t: ThemeId) => void }>({
  theme: 'dark', setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>('dark');

  useEffect(() => {
    const saved = localStorage.getItem('clawport-theme') as ThemeId | null;
    if (saved) apply(saved);
  }, []);

  function apply(t: ThemeId) {
    setThemeState(t);
    localStorage.setItem('clawport-theme', t);
    const html = document.documentElement;
    html.setAttribute('data-theme', t);
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme: apply }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
