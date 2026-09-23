declare const __APP_BUILD_ID__: string;

/** Build ID baked into this bundle at build time. */
export const BUILD_ID: string = __APP_BUILD_ID__;

export const VERSION_ENDPOINT = "/api/version";

export type VersionResponse = { buildId: string };
