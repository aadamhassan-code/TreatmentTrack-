import { beforeAll, describe, expect, test } from "vitest";
import { randomBytes } from "node:crypto";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

beforeAll(() => {
  process.env.INTEGRATIONS_ENCRYPTION_KEY = randomBytes(32).toString("base64");
});

describe("secret encryption", () => {
  test("round-trips, and never stores the key in plain text", () => {
    const stored = encryptSecret("dentally-key-123");
    expect(stored).not.toContain("dentally-key-123");
    expect(decryptSecret(stored)).toBe("dentally-key-123");
  });

  test("encrypting the same value twice gives different results", () => {
    expect(encryptSecret("x")).not.toBe(encryptSecret("x"));
  });

  test("a tampered value is rejected", () => {
    const [v, iv, tag, data] = encryptSecret("secret").split(":");
    const flipped = Buffer.from(data, "base64");
    flipped[0] ^= 1;
    expect(() => decryptSecret([v, iv, tag, flipped.toString("base64")].join(":"))).toThrow();
  });

  test("a missing or wrong-length key is refused", () => {
    const saved = process.env.INTEGRATIONS_ENCRYPTION_KEY;
    process.env.INTEGRATIONS_ENCRYPTION_KEY = "short";
    expect(() => encryptSecret("x")).toThrow(/32 random bytes/);
    process.env.INTEGRATIONS_ENCRYPTION_KEY = saved;
  });
});
