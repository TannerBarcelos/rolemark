import { useCallback, useEffect, useRef, useState } from "react";

import { BUILD_ID, VERSION_ENDPOINT, type VersionResponse } from "#/lib/version";

const POLL_INTERVAL_MS = 60_000;

export type VersionDrift = {
  /** True once the server reports a build that differs from this bundle. */
  isStale: boolean;
  /** The build ID the server is currently serving, when known. */
  liveBuildId: string | null;
  reload: () => void;
};

async function fetchLiveBuildId(signal: AbortSignal): Promise<string | null> {
  try {
    const res = await fetch(VERSION_ENDPOINT, { cache: "no-store", signal });
    if (!res.ok) return null;
    const body = (await res.json()) as Partial<VersionResponse>;
    return typeof body.buildId === "string" ? body.buildId : null;
  } catch {
    // Offline, aborted, or mid-deploy. Try again on the next tick.
    return null;
  }
}

/**
 * Detects skew between the bundle running in this tab and the build the
 * server is serving. Checks on an interval while the tab is visible, whenever
 * the tab regains focus, and immediately when a lazy chunk fails to load
 * (the usual symptom of a deploy removing old assets).
 */
export function useVersionDrift(): VersionDrift {
  const [liveBuildId, setLiveBuildId] = useState<string | null>(null);
  const [chunkLoadFailed, setChunkLoadFailed] = useState(false);
  const inFlight = useRef<AbortController | null>(null);

  const check = useCallback(async () => {
    if (inFlight.current) return;
    const controller = new AbortController();
    inFlight.current = controller;
    const id = await fetchLiveBuildId(controller.signal);
    inFlight.current = null;
    if (id) setLiveBuildId(id);
  }, []);

  useEffect(() => {
    // Dev rebuilds are handled by HMR; the build ID is fixed per dev server.
    if (import.meta.env.DEV) return;

    void check();

    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => {
      if (timer === undefined) timer = setInterval(() => void check(), POLL_INTERVAL_MS);
    };
    const stop = () => {
      clearInterval(timer);
      timer = undefined;
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void check();
        start();
      } else {
        stop();
      }
    };
    const onFocus = () => void check();
    const onPreloadError = (event: Event) => {
      // Stop Vite from throwing; the banner offers the fix instead.
      event.preventDefault();
      setChunkLoadFailed(true);
      void check();
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("vite:preloadError", onPreloadError);

    return () => {
      stop();
      inFlight.current?.abort();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("vite:preloadError", onPreloadError);
    };
  }, [check]);

  const reload = useCallback(() => {
    window.location.reload();
  }, []);

  const isStale = chunkLoadFailed || (liveBuildId !== null && liveBuildId !== BUILD_ID);

  return { isStale, liveBuildId, reload };
}
