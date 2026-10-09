import { expect, test } from "vitest";
import { parseAuthHash } from "@/lib/auth-hash";

test("reads invite tokens from the URL hash", () => {
  expect(parseAuthHash("#access_token=a&refresh_token=r&type=invite&expires_in=3600")).toEqual({
    kind: "tokens",
    accessToken: "a",
    refreshToken: "r",
  });
});

test("password-reset links work the same way", () => {
  expect(parseAuthHash("#access_token=a&refresh_token=r&type=recovery")?.kind).toBe("tokens");
});

test("expired links surface Supabase's error", () => {
  expect(
    parseAuthHash("#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired")
  ).toEqual({ kind: "error", error: "Email link is invalid or has expired" });
});

test("ordinary visits to /login are not treated as invite links", () => {
  expect(parseAuthHash("")).toBeNull();
  expect(parseAuthHash("#access_token=a&refresh_token=r&type=magiclink")).toBeNull();
});
