import type { Role } from "@/lib/practice";

/**
 * The first-login guided tour. Each step points at an element marked with
 * `data-tour="<target>"`; a step with no target (or whose target isn't on
 * screen, e.g. the menu on a phone) is shown as a card in the middle.
 */
export interface TourStep {
  target?: string;
  title: string;
  body: string;
}

export interface TourContext {
  role: Role;
  /** Owner/staff who also see patients (they get a "My quotes" filter). */
  treatsPatients: boolean;
  /** Dentally is connected, so "From Dentally" is in the menu. */
  dentallyConnected: boolean;
  /** A dentist-first account still waiting for the practice owner. */
  awaitingApproval: boolean;
}

export function tourSteps(ctx: TourContext): TourStep[] {
  const dentist = ctx.role === "dentist";
  const owner = ctx.role === "owner";
  const steps: TourStep[] = [];

  steps.push({
    title: "Welcome to TreatmentTrack",
    body: dentist
      ? "Here's a one-minute tour of how to follow up the patients you've quoted. You can skip it at any time."
      : "Here's a one-minute tour of how to follow up patients who were quoted for treatment but haven't booked. You can skip it at any time.",
  });

  if (ctx.awaitingApproval) {
    steps.push({
      target: "approval-banner",
      title: "First, get the practice owner's approval",
      body: "Messages go out in the practice's name, so nothing is sent until the owner approves. Click \"Ask for approval\" to get a link to send them. You can add quotes in the meantime.",
    });
  }

  steps.push({
    target: "nav-/treatments/new",
    title: "Add a quote",
    body: dentist
      ? "Click Add treatment when one of your patients is quoted but doesn't book. Enter their details, confirm they were offered an opt-out, and polite follow-ups go out automatically on your schedule. If they say \"not until after Christmas\", choose a start date."
      : "Click Add treatment when a patient is quoted but doesn't book. Enter their details, confirm they were offered an opt-out, and polite follow-ups go out automatically on your schedule. If they say \"not until after Christmas\", choose a start date.",
  });

  steps.push({
    target: "nav-/treatments/import",
    title: "Already have a list?",
    body: "Click Import CSV to upload a spreadsheet of quotes — for example an export from your practice software. You'll see every row checked before anything is saved.",
  });

  if (ctx.dentallyConnected) {
    steps.push({
      target: "nav-/treatments/dentally",
      title: "Quotes from Dentally",
      body: "Unbooked treatment plans from Dentally appear here. Tick the ones where the patient was offered an opt-out and click Start follow-up.",
    });
  }

  steps.push({
    target: "open-quotes",
    title: dentist ? "Your open quotes" : "Your call list",
    body: "Every open quote is listed here, highest value first — the ones most worth a phone call today.",
  });

  steps.push({
    target: "outcome-buttons",
    title: "When the patient decides",
    body: "Click Booked, Declined or Lost and their follow-up messages stop straight away. If they want to wait — \"after Christmas\" — click Pause… and pick a date. Clicked the wrong one? Reopen it from Recently closed.",
  });

  steps.push({
    target: "nav-/cases",
    title: "Track the treatment",
    body: dentist
      ? "Once a patient books, they appear on My cases — e.g. implant: consultation → consent signed → placed → healing → scan → crown fitted → completed. Drag the card along (or use its arrows) as each stage is done; anyone overdue is flagged."
      : "Once a patient books, they appear on the Cases board — e.g. implant: consultation → consent signed → placed → healing → scan → crown fitted → completed. Drag the card along (or use its arrows) as each stage is done; anyone overdue is flagged.",
  });

  steps.push({
    target: "pipeline",
    title: "See what's at stake",
    body: "Pipeline value is everything still being followed up. Recovered this month is what's been booked.",
  });

  if (!dentist && ctx.treatsPatients) {
    steps.push({
      target: "dentist-filter",
      title: "Just your patients",
      body: "Use this to show only your own quotes, or another dentist's.",
    });
  }

  steps.push({
    target: "nav-/visits/new",
    title: "Log a visit",
    body: "After a hygiene or extraction visit, log it here. If it suggests further treatment, it's only followed up when the patient has agreed to that separately.",
  });

  steps.push({
    target: "nav-/reports",
    title: dentist ? "Your results" : "See what's working",
    body: dentist
      ? "My reports shows your booking rate and the money your follow-ups have recovered."
      : "Reports shows your booking rate, money recovered, and which treatments and dentists convert best.",
  });

  if (owner) {
    steps.push({
      target: "nav-/settings",
      title: "Messages and channels",
      body: "In Settings choose when messages go (e.g. 3 days, 1 week, 1 month), text and/or email, and the wording of each message. An opt-out is always added for you. You can also change the stages on each Cases board.",
    });
    steps.push({
      target: "nav-/team",
      title: "Bring in your team",
      body: "Invite staff and dentists here. Dentists only ever see their own patients and figures.",
    });
  }

  steps.push({
    target: "tour-replay",
    title: "That's it",
    body: "You're ready to add your first quote. You can take this tour again any time from here.",
  });

  return steps;
}
