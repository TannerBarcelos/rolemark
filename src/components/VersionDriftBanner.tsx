import { useState } from "react";

import { useVersionDrift } from "#/hooks/use-version-drift";

export function VersionDriftBanner() {
  const { isStale, reload } = useVersionDrift();
  // Closing only hides the banner. Any reload or refresh loads the new build.
  const [closed, setClosed] = useState(false);

  if (!isStale || closed) return null;

  return (
    <div className="version-banner" role="status" aria-live="polite">
      <span>A new version of RoleMark is available.</span>
      <div className="version-banner__actions">
        <button type="button" className="version-banner__reload" onClick={reload}>
          Reload
        </button>
        <button
          type="button"
          className="version-banner__close"
          aria-label="Close"
          onClick={() => setClosed(true)}
        >
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path
              d="M4 4l8 8M12 4l-8 8"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
