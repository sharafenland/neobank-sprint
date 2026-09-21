"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchView, type View } from "@/lib/client";

/**
 * Polls the session. Two seconds is fast enough that a room of students never
 * notices, and slow enough that thirty devices cost almost nothing on Neon.
 */
export function useGame(code: string, intervalMs = 2000) {
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchView(code);
      if (alive.current) { setView(next); setError(null); }
    } catch (err) {
      if (alive.current) setError(err instanceof Error ? err.message : "Connection lost");
    }
  }, [code]);

  useEffect(() => {
    alive.current = true;
    refresh();
    const id = setInterval(refresh, intervalMs);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      alive.current = false;
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh, intervalMs]);

  return { view, error, refresh };
}
