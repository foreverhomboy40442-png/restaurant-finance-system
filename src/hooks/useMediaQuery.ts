import { useEffect, useState } from 'react';

/**
 * 監聽 CSS media query，用於 RWD 條件渲染（比純 Tailwind 斷點更可靠）。
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const handleChange = () => setMatches(mediaQuery.matches);

    handleChange();
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [query]);

  return matches;
}

/** 桌面版 Sidebar 顯示斷點（≥768px） */
export const DESKTOP_NAV_QUERY = '(min-width: 768px)';
