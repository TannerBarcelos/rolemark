import { useState } from "react";

import { useVersionDrift } from "#/lib/use-version-drift";

export function VersionDriftBanner() {
  const { isStale, liveBuildId, reload } = useVersionDrift();
  // Dismissal is per live build, so a newer deploy shows the banner again.
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);

  if (!isStale || (dismissedFor !== null && dismissedFor === liveBuildId)) return null;

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
          onClick={() => setDismissedFor(liveBuildId)}
        >
          Later
        </button>
      </div>
    </div>
  );
}
