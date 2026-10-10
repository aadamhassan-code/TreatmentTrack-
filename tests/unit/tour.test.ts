import { describe, expect, test } from "vitest";
import { tourSteps, type TourContext } from "@/lib/tour";

const base: TourContext = { role: "staff", treatsPatients: false, dentallyConnected: false, awaitingApproval: false };
const targets = (ctx: TourContext) => tourSteps(ctx).map((s) => s.target ?? "(centre)");

describe("guided tour steps", () => {
  test("starts with a welcome and ends pointing at the replay button", () => {
    const t = targets(base);
    expect(t[0]).toBe("(centre)");
    expect(t.at(-1)).toBe("tour-replay");
  });

  test("owners also learn about Settings and Team; staff don't", () => {
    expect(targets({ ...base, role: "owner" })).toEqual(expect.arrayContaining(["nav-/settings", "nav-/team"]));
    expect(targets(base)).not.toContain("nav-/team");
  });

  test("dentists get their own wording and no team step", () => {
    const steps = tourSteps({ ...base, role: "dentist" });
    expect(steps.find((s) => s.target === "open-quotes")?.title).toBe("Your open quotes");
    expect(steps.map((s) => s.target)).not.toContain("nav-/team");
    expect(steps.map((s) => s.target)).not.toContain("dentist-filter");
  });

  test("only shows steps for things that are on screen for this person", () => {
    expect(targets(base)).not.toContain("nav-/treatments/dentally");
    expect(targets({ ...base, dentallyConnected: true })).toContain("nav-/treatments/dentally");
    expect(targets({ ...base, treatsPatients: true })).toContain("dentist-filter");
  });

  test("a dentist-first account waiting for approval is shown how to ask, straight after the welcome", () => {
    expect(targets({ ...base, role: "owner", awaitingApproval: true })[1]).toBe("approval-banner");
  });
});
