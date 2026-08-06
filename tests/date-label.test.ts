import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dateLabel, normaliseUtcTimestamp } from "../app/date-label";

describe("hydration-safe UTC date labels", () => {
  const originalTimezone = process.env.TZ;

  beforeAll(() => {
    // Reproduces a browser outside UTC. Without SQL timestamp normalisation,
    // 06:55 is parsed as local time and rendered as 03:55 UTC in this zone.
    process.env.TZ = "Asia/Jerusalem";
  });

  afterAll(() => {
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
  });

  it("treats a timezone-less SQLite CURRENT_TIMESTAMP as UTC", () => {
    expect(normaliseUtcTimestamp("2026-08-03 06:55:47")).toBe("2026-08-03T06:55:47Z");
    expect(dateLabel("2026-08-03 06:55:47")).toBe("3 Aug 2026, 06:55");
  });

  it("preserves timestamps that already declare their timezone", () => {
    expect(normaliseUtcTimestamp("2026-08-03T06:55:47Z")).toBe("2026-08-03T06:55:47Z");
    expect(normaliseUtcTimestamp("2026-08-03T09:55:47+03:00")).toBe("2026-08-03T09:55:47+03:00");
    expect(dateLabel("2026-08-03T09:55:47+03:00")).toBe("3 Aug 2026, 06:55");
  });

  it("keeps invalid and missing values honest", () => {
    expect(dateLabel("not-a-timestamp")).toBe("not-a-timestamp");
    expect(dateLabel(null)).toBe("Not available");
    expect(dateLabel("")).toBe("Not available");
  });
});
