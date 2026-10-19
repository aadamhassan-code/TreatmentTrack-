import { describe, expect, it } from "vitest";
import { isPublicPath } from "@/proxy";

describe("isPublicPath", () => {
  it("lets signed-out visitors reach every marketing and legal page", () => {
    for (const p of [
      "/",
      "/pricing",
      "/request-callback",
      "/privacy",
      "/terms",
      "/dpa",
      "/security",
      "/login",
      "/signup",
      "/signup/success",
      "/approve/some-token",
      "/offline.html",
    ]) {
      expect(isPublicPath(p), p).toBe(true);
    }
  });

  it("leaves API routes to their own auth (signatures, cron secret, session)", () => {
    expect(isPublicPath("/api/stripe/webhook")).toBe(true);
    expect(isPublicPath("/api/cron/send-sequence")).toBe(true);
  });

  it("protects every app page by default, including ones added later", () => {
    for (const p of [
      "/dashboard",
      "/treatments",
      "/treatments/dentally",
      "/visits/new",
      "/settings",
      "/reports",
      "/team",
      "/approval",
      "/cases", // the one the old allow-list missed
      "/admin",
      "/some-future-section",
    ]) {
      expect(isPublicPath(p), p).toBe(false);
    }
  });

  it("does not treat lookalike prefixes as public", () => {
    expect(isPublicPath("/pricing-internal")).toBe(false);
    expect(isPublicPath("/loginadmin")).toBe(false);
  });
});
