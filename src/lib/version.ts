declare const __APP_BUILD_ID__: string;
declare const __APP_BUILD_SEQ__: number;

export type BuildInfo = {
  /** Commit SHA (or other label) of the build. Identity, not ordering. */
  id: string;
  /** Monotonic build number (CI run number; 0 for local builds). Orders builds. */
  seq: number;
};

/** Build baked into this bundle at build time. */
export const BUILD: BuildInfo = { id: __APP_BUILD_ID__, seq: __APP_BUILD_SEQ__ };

export const VERSION_ENDPOINT = "/api/version";

export function isBuildInfo(value: unknown): value is BuildInfo {
  if (typeof value !== "object" || value === null) return false;
  const { id, seq } = value as Record<string, unknown>;
  return typeof id === "string" && typeof seq === "number";
}

/** True when `live` is a strictly newer build than `running`. */
export function isNewerBuild(live: BuildInfo, running: BuildInfo): boolean {
  return live.seq > running.seq;
}
