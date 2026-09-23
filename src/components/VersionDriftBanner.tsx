import { useState } from "react";

import { useVersionDrift } from "#/hooks/use-version-drift";

export function VersionDriftBanner() {
  const { isStale, liveBuild, reload } = useVersionDrift();
  // "Later" hides the banner until a newer deploy lands. The tab stays on its
  // current build until the user reloads.
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);

  const dismissKey = liveBuild?.id ?? "unknown";

  if (!isStale || dismissedFor === dismissKey) return null;

  return (
    <div className="version-banner" role="status" aria-live="polite">
      <span>A new version of RoleMark is available.</span>
      <div className="version-banner__actions">
        <button type="button" className="version-banner__reload" onClick={reload}>
          Reload
        </button>
        <button
          type="button"
          className="version-banner__dismiss"
          onClick={() => setDismissedFor(dismissKey)}
        >
          Later
        </button>
      </div>
    </div>
  );
}
