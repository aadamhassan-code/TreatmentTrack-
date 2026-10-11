/** Follow-up schedules: how many messages, and how many days after the quote each goes. */

export const MAX_MESSAGES = 6;
export const MAX_DAYS = 365;
export const DEFAULT_SEQUENCE_DAYS = [3, 7, 14, 30];

export const SCHEDULE_PRESETS: { name: string; description: string; days: number[] }[] = [
  { name: "Standard", description: "3 days, 1 week, 2 weeks, 1 month", days: [3, 7, 14, 30] },
  { name: "Gentle", description: "3 days, 1 week, 1 month", days: [3, 7, 30] },
  { name: "Persistent", description: "3 days, 1 week, 2 weeks, 1, 2 and 3 months", days: [3, 7, 14, 30, 60, 90] },
];

/** Returns a plain-English problem with the schedule, or null if it's fine. */
export function scheduleProblem(days: number[]): string | null {
  if (days.length === 0) return "Add at least one message.";
  if (days.length > MAX_MESSAGES) return `You can have up to ${MAX_MESSAGES} messages.`;
  for (const d of days) {
    if (!Number.isInteger(d) || d < 1 || d > MAX_DAYS) return `Each message must be between 1 and ${MAX_DAYS} days after the quote.`;
  }
  for (let i = 1; i < days.length; i++) {
    if (days[i] <= days[i - 1]) return "Each message must come after the one before it.";
  }
  return null;
}

/** "3 days", "1 week", "2 weeks", "1 month", "45 days". */
export function describeDays(days: number): string {
  if (days === 1) return "1 day";
  if (days % 30 === 0) return days === 30 ? "1 month" : `${days / 30} months`;
  if (days % 7 === 0) return days === 7 ? "1 week" : `${days / 7} weeks`;
  return `${days} days`;
}

/**
 * When each message goes. Normally message n goes `days[n]` days after
 * `start`. After a pause (`startNow`), the first message goes on the resume
 * date itself and the rest keep their spacing after it.
 */
export function planSchedule(
  days: number[],
  start: Date,
  opts: { startNow?: boolean } = {}
): { step: number; at: Date }[] {
  const offset = opts.startNow ? days[0] : 0;
  return days.map((d, i) => ({ step: i + 1, at: new Date(start.getTime() + (d - offset) * 86_400_000) }));
}
