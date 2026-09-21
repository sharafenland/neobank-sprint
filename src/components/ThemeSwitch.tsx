"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";
export const THEME_KEY = "nbs.theme";

/**
 * A lecture hall is usually dim and a group's laptop usually is not, so the
 * two ends of the room want opposite themes. The choice is stored per device.
 * The initial paint is handled by the inline script in the layout, so nothing
 * flashes and the server and client agree on the first render.
 */
export function ThemeSwitch() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const attr = document.documentElement.getAttribute("data-theme");
    if (attr === "light" || attr === "dark") setTheme(attr);
    else setTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }, []);

  function choose(next: Theme) {
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem(THEME_KEY, next); } catch { /* private mode */ }
  }

  return (
    <div className="themeswitch" role="group" aria-label="Colour theme">
      <button type="button" aria-pressed={theme === "light"} onClick={() => choose("light")}>
        <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="8" cy="8" r="3.2" />
          <path d="M8 1v1.6M8 13.4V15M1 8h1.6M13.4 8H15M3 3l1.1 1.1M11.9 11.9L13 13M13 3l-1.1 1.1M4.1 11.9L3 13" strokeLinecap="round" />
        </svg>
        Light
      </button>
      <button type="button" aria-pressed={theme === "dark"} onClick={() => choose("dark")}>
        <svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
          <path d="M13.2 9.6A5.6 5.6 0 0 1 6.4 2.8a5.6 5.6 0 1 0 6.8 6.8Z" strokeLinejoin="round" />
        </svg>
        Dark
      </button>
    </div>
  );
}
