declare const __APP_BUILD_ID__: string;
declare const __APP_BUILD_TIME__: number;

export type BuildInfo = {
  /** Commit SHA (or other label) of the build. Identity, not ordering. */
  id: string;
  /** Epoch ms when the build was made. Used to order builds. */
  time: number;
};

/** Build baked into this bundle at build time. */
export const BUILD: BuildInfo = { id: __APP_BUILD_ID__, time: __APP_BUILD_TIME__ };

export const VERSION_ENDPOINT = "/api/version";

export function isBuildInfo(value: unknown): value is BuildInfo {
  if (typeof value !== "object" || value === null) return false;
  const { id, time } = value as Record<string, unknown>;
  return typeof id === "string" && typeof time === "number";
}

/** True when `live` is a strictly newer build than `running`. */
export function isNewerBuild(live: BuildInfo, running: BuildInfo): boolean {
  return live.time > running.time;
}
