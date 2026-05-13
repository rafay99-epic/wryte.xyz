/**
 * Timezone helpers built on the browser's Intl APIs.
 *
 * The CMS stores all timestamps as Unix milliseconds (UTC). Display and
 * scheduling are interpreted in a project-level IANA timezone. When the
 * project doesn't specify one, we fall back to the browser's resolved
 * timezone so behaviour matches the legacy implementation.
 */

/** Return the browser's resolved IANA timezone, e.g. "America/Los_Angeles". */
export function getBrowserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** Resolve the effective timezone for a project: stored value or browser. */
export function resolveTimezone(projectTimezone?: string | null): string {
  if (projectTimezone && projectTimezone.length > 0) return projectTimezone;
  return getBrowserTimezone();
}

/** All IANA timezones supported by the runtime. */
export function listTimezones(): string[] {
  const supported = (
    Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
  ).supportedValuesOf;
  if (typeof supported === "function") return supported("timeZone");
  // Browser doesn't expose supportedValuesOf — fall back to a curated subset.
  return FALLBACK_TIMEZONES;
}

interface TzParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/**
 * Extract the wall-clock parts of a UTC timestamp as observed in the given
 * timezone. The result reflects what a clock in that timezone would read.
 */
export function getPartsInTimezone(
  timestamp: number,
  timeZone: string,
): TzParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map: Record<string, string> = {};
  for (const part of formatter.formatToParts(new Date(timestamp))) {
    map[part.type] = part.value;
  }
  // Some locales return "24" for midnight — normalize to 0 so subsequent
  // Date.UTC math doesn't shift into the next day.
  let hour = Number.parseInt(map["hour"] ?? "0", 10);
  if (hour === 24) hour = 0;
  return {
    year: Number.parseInt(map["year"] ?? "1970", 10),
    month: Number.parseInt(map["month"] ?? "1", 10),
    day: Number.parseInt(map["day"] ?? "1", 10),
    hour,
    minute: Number.parseInt(map["minute"] ?? "0", 10),
    second: Number.parseInt(map["second"] ?? "0", 10),
  };
}

/**
 * Convert a wall-clock time *in the given timezone* to a UTC millisecond
 * timestamp. Handles DST boundaries with a second-pass correction.
 */
export function zonedTimeToUtc(
  year: number,
  month: number, // 1-12
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): number {
  const targetUtc = Date.UTC(year, month - 1, day, hour, minute);
  const firstPass = getPartsInTimezone(targetUtc, timeZone);
  const firstAsUtc = Date.UTC(
    firstPass.year,
    firstPass.month - 1,
    firstPass.day,
    firstPass.hour,
    firstPass.minute,
    firstPass.second,
  );
  const offset = firstAsUtc - targetUtc;
  let result = targetUtc - offset;

  // DST boundary: the offset at `result` may differ from the offset at the
  // initial guess. If so, recompute the offset and adjust once more.
  const secondPass = getPartsInTimezone(result, timeZone);
  if (
    secondPass.year !== year ||
    secondPass.month !== month ||
    secondPass.day !== day ||
    secondPass.hour !== hour ||
    secondPass.minute !== minute
  ) {
    const secondAsUtc = Date.UTC(
      secondPass.year,
      secondPass.month - 1,
      secondPass.day,
      secondPass.hour,
      secondPass.minute,
      secondPass.second,
    );
    const offset2 = secondAsUtc - result;
    result = result - (offset2 - offset);
  }
  return result;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Format a UTC timestamp as YYYY-MM-DD in the given timezone. */
export function formatLocalDate(timestamp: number, timeZone: string): string {
  const p = getPartsInTimezone(timestamp, timeZone);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

/** Format a UTC timestamp as YYYY-MM-DDTHH:mm in the given timezone. */
export function formatLocalDatetime(
  timestamp: number,
  timeZone: string,
): string {
  const p = getPartsInTimezone(timestamp, timeZone);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}T${pad2(p.hour)}:${pad2(p.minute)}`;
}

/**
 * Human-readable UTC offset for a timezone at the given instant, e.g.
 * "UTC-08:00" for Los Angeles in winter. Defaults to "now" — pass a
 * timestamp if you need the offset on a specific date (for DST awareness).
 */
export function getTimezoneOffsetLabel(
  timeZone: string,
  timestamp: number = Date.now(),
): string {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
  });
  for (const part of formatter.formatToParts(new Date(timestamp))) {
    if (part.type === "timeZoneName") {
      // "GMT-08:00" → "UTC-08:00"; "GMT" alone → "UTC+00:00"
      const raw = part.value;
      if (raw === "GMT") return "UTC+00:00";
      return raw.replace("GMT", "UTC");
    }
  }
  return "UTC+00:00";
}

/**
 * Returns the city portion of an IANA id for compact display, e.g.
 * "America/Los_Angeles" → "Los Angeles", "Etc/UTC" → "UTC".
 */
export function getTimezoneCityLabel(timeZone: string): string {
  const lastSegment = timeZone.split("/").pop() ?? timeZone;
  return lastSegment.replace(/_/g, " ");
}

/**
 * Last-resort list when `Intl.supportedValuesOf` isn't available — keeps
 * the picker usable on older runtimes. Real browsers ship ~400 entries.
 */
const FALLBACK_TIMEZONES: string[] = [
  "UTC",
  "Africa/Cairo",
  "Africa/Johannesburg",
  "Africa/Lagos",
  "America/Anchorage",
  "America/Bogota",
  "America/Buenos_Aires",
  "America/Chicago",
  "America/Denver",
  "America/Halifax",
  "America/Lima",
  "America/Los_Angeles",
  "America/Mexico_City",
  "America/New_York",
  "America/Phoenix",
  "America/Sao_Paulo",
  "America/Toronto",
  "Asia/Bangkok",
  "Asia/Dubai",
  "Asia/Hong_Kong",
  "Asia/Jakarta",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Kuala_Lumpur",
  "Asia/Manila",
  "Asia/Seoul",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Taipei",
  "Asia/Tehran",
  "Asia/Tokyo",
  "Australia/Melbourne",
  "Australia/Perth",
  "Australia/Sydney",
  "Europe/Amsterdam",
  "Europe/Athens",
  "Europe/Berlin",
  "Europe/Dublin",
  "Europe/Helsinki",
  "Europe/Istanbul",
  "Europe/Lisbon",
  "Europe/London",
  "Europe/Madrid",
  "Europe/Moscow",
  "Europe/Paris",
  "Europe/Rome",
  "Europe/Stockholm",
  "Europe/Vienna",
  "Europe/Warsaw",
  "Europe/Zurich",
  "Pacific/Auckland",
  "Pacific/Honolulu",
];
