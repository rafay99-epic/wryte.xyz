export function getBrowserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function resolveTimezone(projectTimezone?: string | null): string {
  if (projectTimezone && projectTimezone.length > 0) return projectTimezone;
  return getBrowserTimezone();
}

export function listTimezones(): string[] {
  if (typeof Intl.supportedValuesOf === "function") {
    return Intl.supportedValuesOf("timeZone");
  }
  return FALLBACK_TIMEZONES;
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>();
const offsetFormatters = new Map<string, Intl.DateTimeFormat>();

function cachedFormatter(
  cache: Map<string, Intl.DateTimeFormat>,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  let formatter = cache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", { ...options, timeZone });
    cache.set(timeZone, formatter);
  }
  return formatter;
}

const PARTS_OPTIONS: Intl.DateTimeFormatOptions = {
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
};

const OFFSET_OPTIONS: Intl.DateTimeFormatOptions = {
  timeZoneName: "longOffset",
};

type TzParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export function getPartsInTimezone(
  timestamp: number,
  timeZone: string,
): TzParts {
  const formatter = cachedFormatter(partsFormatters, timeZone, PARTS_OPTIONS);
  const map: Record<string, string> = {};
  for (const part of formatter.formatToParts(new Date(timestamp))) {
    map[part.type] = part.value;
  }
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

export function zonedTimeToUtc(
  year: number,
  month: number,
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

export function formatLocalDate(timestamp: number, timeZone: string): string {
  const p = getPartsInTimezone(timestamp, timeZone);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
}

export function formatLocalDatetime(
  timestamp: number,
  timeZone: string,
): string {
  const p = getPartsInTimezone(timestamp, timeZone);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}T${pad2(p.hour)}:${pad2(p.minute)}`;
}

export function getTimezoneOffsetLabel(
  timeZone: string,
  timestamp: number = Date.now(),
): string {
  const formatter = cachedFormatter(offsetFormatters, timeZone, OFFSET_OPTIONS);
  for (const part of formatter.formatToParts(new Date(timestamp))) {
    if (part.type === "timeZoneName") {
      const raw = part.value;
      if (raw === "GMT") return "UTC+00:00";
      return raw.replace("GMT", "UTC");
    }
  }
  return "UTC+00:00";
}

export function getTimezoneCityLabel(timeZone: string): string {
  const lastSegment = timeZone.split("/").pop() ?? timeZone;
  return lastSegment.replace(/_/g, " ");
}

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
