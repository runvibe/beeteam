import { expect, it, vi } from "vitest";
import { chatDateRange } from "./chat-date-range";
it("uses local midnight and the next calendar day as exclusive end", () => {
  expect(chatDateRange("2026-10-27", "2026-10-27")).toEqual({
    valid: true,
    createdFrom: new Date(2026, 9, 27).toISOString(),
    createdBefore: new Date(2026, 9, 28).toISOString(),
  });
  expect(chatDateRange("2026-12-31", "2026-12-31").createdBefore).toBe(
    new Date(2027, 0, 1).toISOString(),
  );
  expect(chatDateRange("2024-02-29", "2024-02-29").createdBefore).toBe(
    new Date(2024, 2, 1).toISOString(),
  );
});
it.each([
  ["2026-02-30", ""],
  ["bad", ""],
  ["2026-10-28", "2026-10-27"],
])("rejects invalid or reversed dates %s/%s", (from, until) => {
  expect(chatDateRange(from, until)).toEqual({
    valid: false,
    createdFrom: undefined,
    createdBefore: undefined,
  });
});
it("supports independently open ends", () => {
  expect(chatDateRange("", "")).toEqual({
    valid: true,
    createdFrom: undefined,
    createdBefore: undefined,
  });
  expect(chatDateRange("", "2026-10-27").createdFrom).toBeUndefined();
  expect(chatDateRange("2026-10-27", "").createdBefore).toBeUndefined();
});

it("ends a day whose midnight was skipped without including the next hour", () => {
  vi.stubEnv("TZ", "America/Sao_Paulo");
  try {
    expect(chatDateRange("2018-11-04", "2018-11-04")).toEqual({
      valid: true,
      createdFrom: "2018-11-04T03:00:00.000Z",
      createdBefore: "2018-11-05T02:00:00.000Z",
    });
  } finally {
    vi.unstubAllEnvs();
  }
});

it.each([
  ["2026-03-08", 23],
  ["2026-11-01", 25],
] as const)("uses the actual DST duration for %s", (day, hours) => {
  vi.stubEnv("TZ", "America/New_York");
  try {
    const range = chatDateRange(day, day);
    expect(
      (Date.parse(range.createdBefore!) - Date.parse(range.createdFrom!)) /
        3600000,
    ).toBe(hours);
  } finally {
    vi.unstubAllEnvs();
  }
});
