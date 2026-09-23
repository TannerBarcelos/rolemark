import { useState } from "react";

import { useVersionDrift } from "#/hooks/use-version-drift";

export function VersionDriftBanner() {
  const { isStale, reload } = useVersionDrift();
  // Closing hides the banner for the life of the tab; a refresh loads the new build.
  const [closed, setClosed] = useState(false);

  if (!isStale || closed) return null;

  return (
    <div className="version-banner" role="status" aria-live="polite">
      <div className="version-banner__text">
        <strong>Update available</strong>
        <span>A new version of RoleMark is ready.</span>
      </div>
      <div className="version-banner__actions">
        <button type="button" className="version-banner__refresh" onClick={reload}>
          Refresh
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
