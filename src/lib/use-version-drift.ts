import { useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { BUILD, VERSION_ENDPOINT, isBuildInfo, isNewerBuild, type BuildInfo } from "#/lib/version";

const POLL_INTERVAL_MS = 60_000;

export type VersionDrift = {
  /** True once this tab is known to be running an outdated bundle. */
  isStale: boolean;
  /** The build the server is currently serving, when known. */
  liveBuild: BuildInfo | null;
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
 * Once stale, the next in-app navigation becomes a full document load, so
 * users pick up the new build at a natural break without losing work.
 */
export function useVersionDrift(): VersionDrift {
  const router = useRouter();
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
      // Stop Vite from throwing; the banner and next navigation handle it.
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

  // While stale, swap client-side navigations for full document loads.
  useEffect(() => {
    if (!isStale) return;
    return router.history.block({
      enableBeforeUnload: false,
      blockerFn: ({ nextLocation, action }) => {
        const href = router.history.createHref(nextLocation.href);
        if (action === "PUSH") {
          window.location.assign(href);
        } else if (action === "REPLACE") {
          window.location.replace(href);
        } else {
          // Back/forward/go: the URL has already changed, so reload in place.
          // Let the router proceed; the page unloads before it matters.
          window.location.reload();
          return false;
        }
        return true;
      },
    });
  }, [isStale, router]);

  const reload = useCallback(() => {
    window.location.reload();
  }, []);

  return { isStale, liveBuild, reload };
}
