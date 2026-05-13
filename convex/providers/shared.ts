/**
 * Shared, runtime-agnostic helpers for provider modules. Anything here must
 * work in both the default Convex runtime and the Node-only one (no
 * `"use node"` directive).
 */

/** Cloudinary credential blob stored in vault. */
export type CloudinarySecret = {
  cloud_name: string;
  api_key: string;
  api_secret: string;
};

/** Parses the vault-stored secret for a Cloudinary credential. */
export function parseCloudinarySecret(raw: string): CloudinarySecret {
  const parsed = JSON.parse(raw) as Partial<CloudinarySecret>;
  if (!parsed.cloud_name || !parsed.api_key || !parsed.api_secret) {
    throw new Error(
      "Cloudinary credentials are missing required fields (cloud_name, api_key, api_secret)",
    );
  }
  return {
    cloud_name: parsed.cloud_name,
    api_key: parsed.api_key,
    api_secret: parsed.api_secret,
  };
}
