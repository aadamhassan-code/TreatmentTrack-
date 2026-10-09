/**
 * Keywords that mean "stop messaging me". Twilio and UK carriers treat
 * these as standard opt-out words. We also accept a reply that *starts*
 * with "stop" or "unsubscribe" ("Stop texting me please") — when in doubt,
 * opting someone out is the safe side of PECR.
 */
const STOP_KEYWORDS = new Set(["stop", "stopall", "unsubscribe", "cancel", "end", "quit", "optout"]);
const STOP_PREFIXES = ["stop", "unsubscribe"];

export function isStopMessage(body: string): boolean {
  const words = body
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return false;
  if (words.length === 1) return STOP_KEYWORDS.has(words[0]);
  if (words.join("") === "optout") return true;
  return STOP_PREFIXES.includes(words[0]);
}
