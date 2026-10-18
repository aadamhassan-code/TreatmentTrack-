import { describe, expect, it } from "vitest";
import { isPlatformAdminEmail, parseAdminEmails, reportWindows } from "@/lib/admin";

describe("platform admin allowlist", () => {
  it("parses a comma-separated list, ignoring case, spaces and junk", () => {
    const list = parseAdminEmails(" Hamza@Example.com, aadam@example.com ,, not-an-email ");
    expect(list.has("hamza@example.com")).toBe(true);
    expect(list.has("aadam@example.com")).toBe(true);
    expect(list.size).toBe(2);
  });

  it("is closed by default: no env var means nobody is an admin", () => {
    const list = parseAdminEmails(undefined);
    expect(isPlatformAdminEmail("anyone@example.com", list)).toBe(false);
  });

  it("matches emails case-insensitively and rejects everyone else", () => {
    const list = parseAdminEmails("owner@practice.co.uk");
    expect(isPlatformAdminEmail("OWNER@practice.co.uk", list)).toBe(true);
    expect(isPlatformAdminEmail("other@practice.co.uk", list)).toBe(false);
    expect(isPlatformAdminEmail(null, list)).toBe(false);
    expect(isPlatformAdminEmail(undefined, list)).toBe(false);
  });
});

describe("reportWindows", () => {
  it("returns ISO timestamps exactly 7 and 30 days back", () => {
    const { d7, d30 } = reportWindows(new Date("2026-10-19T00:00:00.000Z"));
    expect(d7).toBe("2026-10-12T00:00:00.000Z");
    expect(d30).toBe("2026-09-19T00:00:00.000Z");
  });
});
