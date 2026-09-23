import { useVersionDrift } from "#/hooks/use-version-drift";

export function VersionDriftBanner() {
  const { isStale, reload } = useVersionDrift();

  if (!isStale) return null;

  return (
    <div className="version-banner" role="status" aria-live="polite">
      <div className="version-banner__text">
        <strong>Update available</strong>
        <span>A new version of RoleMark is ready.</span>
      </div>
      <button type="button" className="version-banner__refresh" onClick={reload}>
        Refresh
      </button>
    </div>
  );
}
