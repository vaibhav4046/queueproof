const SQL_UTC_TIMESTAMP = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}(?:\.\d+)?)$/;

/**
 * SQLite CURRENT_TIMESTAMP values omit their UTC designator. Date parses those
 * values in the browser's local timezone, while the server parses them in its
 * own timezone, so the same SSR text can change during hydration.
 */
export function normaliseUtcTimestamp(value: string): string {
  return value.replace(SQL_UTC_TIMESTAMP, "$1T$2Z");
}

/** Format every supported timestamp as the existing compact UTC label. */
export function dateLabel(value?: string | null): string {
  if (!value) return "Not available";
  const parsed = new Date(normaliseUtcTimestamp(value));
  return Number.isFinite(parsed.getTime())
    ? new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      }).format(parsed)
    : value;
}
