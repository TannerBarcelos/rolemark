import { useCallback, useEffect, useRef, useState } from "react";

import { BUILD, VERSION_ENDPOINT, isBuildInfo, isNewerBuild, type BuildInfo } from "#/lib/version";

const POLL_INTERVAL_MS = 60_000;

export type VersionDrift = {
  /** True once this tab is known to be running an outdated bundle. */
  isStale: boolean;
  reload: () => void;
};

async function fetchLiveBuild(signal: AbortSignal): Promise<BuildInfo | null> {
  try {
    const res = await fetch(VERSION_ENDPOINT, { cache: "no-store", signal });
    if (!res.ok) return null;
    const body: unknown = await res.json();
    return isBuildInfo(body) ? body : null;
  } catch {
    // Offline, aborted, or mid-deploy. Try again on the next tick.
    return null;
  }
}

/**
 * Detects when the bundle in this tab is older than the build the server is
 * serving. Checks on an interval while the tab is visible, whenever the tab
 * regains focus, and immediately when a lazy chunk fails to load (the usual
 * symptom of a deploy removing old assets).
 *
 * Detection only: the tab keeps running its current bundle until the user
 * chooses to reload.
 */
export function useVersionDrift(): VersionDrift {
  const [liveBuild, setLiveBuild] = useState<BuildInfo | null>(null);
  const [chunkLoadFailed, setChunkLoadFailed] = useState(false);
  const inFlight = useRef<AbortController | null>(null);

  const check = useCallback(async () => {
    if (inFlight.current) return;
    const controller = new AbortController();
    inFlight.current = controller;
    const build = await fetchLiveBuild(controller.signal);
    inFlight.current = null;
    if (build) setLiveBuild(build);
  }, []);

  useEffect(() => {
    // Dev rebuilds are handled by HMR; the build is fixed per dev server.
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
      // Stop Vite from throwing; the banner offers the reload.
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

  const isStale = chunkLoadFailed || (liveBuild !== null && isNewerBuild(liveBuild, BUILD));

  const reload = useCallback(() => {
    window.location.reload();
  }, []);

  return { isStale, reload };
}
