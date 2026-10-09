export type AuthHash =
  | { kind: "tokens"; accessToken: string; refreshToken: string }
  | { kind: "error"; error: string }
  | null;

/**
 * Supabase invite and password-reset emails link back to /login with the
 * login tokens in the URL hash (#access_token=…&refresh_token=…&type=invite),
 * or an error (#error_description=…) if the link expired.
 */
export function parseAuthHash(hash: string): AuthHash {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const errorDescription = params.get("error_description");
  if (errorDescription) return { kind: "error", error: errorDescription };
  const type = params.get("type");
  if (type !== "invite" && type !== "recovery") return null;
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) return null;
  return { kind: "tokens", accessToken, refreshToken };
}
