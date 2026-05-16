export const APP_VERSION = process.env["NEXT_PUBLIC_APP_VERSION"] ?? "0.0.0";

export const APP_BUILD = process.env["NEXT_PUBLIC_BUILD_NUMBER"] ?? "dev";

export const APP_BUILD_SHA = process.env["NEXT_PUBLIC_BUILD_SHA"] ?? "dev";

export const APP_VERSION_LABEL = `v${APP_VERSION}`;

export const APP_RELEASE_LABEL = `${APP_VERSION_LABEL} · build ${APP_BUILD}`;
