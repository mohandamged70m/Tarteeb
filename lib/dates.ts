/** Timezone-aware date helpers. No date library — Intl + weekday math only. */

export function todayInTimezone(timezone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function weekdayInTimezone(timezone: string, now = new Date()): number {
  // 0=Sunday..6=Saturday
  const name = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  }).format(now);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(name);
}

const DAY_MS = 86_400_000;

function toUTCDate(iso: string): number {
  return Date.parse(iso + "T12:00:00Z");
}

function fromUTCDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/**
 * Resolve "Friday" / "next Friday" style references.
 * Convention (documented in AI_WORKFLOW + shown to user as interpretation):
 * - "Friday" / "this Friday" → the coming Friday (today if today is Friday).
 * - "next Friday" → the Friday of next week (coming Friday + 7d if that Friday
 *   is within 7 days, matching common Egyptian-Arabic usage "الجمعة الجاية").
 * Returns null when the weekday cannot be determined.
 */
export function resolveWeekday(
  targetWeekday: number,
  qualifier: "this" | "next" | "none",
  todayISO: string,
  todayWeekday: number
): string {
  let delta = (targetWeekday - todayWeekday + 7) % 7;
  if (qualifier === "next") {
    delta = delta === 0 ? 7 : delta + 7 <= 7 ? 7 : delta;
    // Simpler: next X = coming X plus 7 days unless coming X is today.
    const coming = (targetWeekday - todayWeekday + 7) % 7;
    delta = coming === 0 ? 7 : coming + 7;
    if (delta > 7) delta = coming + 7 > 14 ? coming + 7 : coming + 7;
    delta = coming + 7;
  }
  return fromUTCDate(toUTCDate(todayISO) + delta * DAY_MS);
}

export const WEEKDAYS_EN = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export const WEEKDAYS_AR: Record<string, number> = {
  "الأحد": 0,
  "الاحد": 0,
  "الاثنين": 1,
  "الإثنين": 1,
  "التلات": 2,
  "الثلاثاء": 2,
  "الاربع": 3,
  "الأربعاء": 3,
  "الاربعاء": 3,
  "الخميس": 4,
  "الجمعة": 5,
  "الجمعه": 5,
  "السبت": 6,
};

export function formatLong(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso + "T12:00:00Z"));
}

export function isValidIANA(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
