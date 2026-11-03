import { expect, it } from "vitest";
import { observedDuration } from "./interval-format";
it("distinguishes missing duration from real zero and preserves decimal integer precision", () => {
  expect(observedDuration(null)).toBe("Não informada");
  expect(observedDuration(undefined)).toBe("Não informada");
  expect(observedDuration("0")).toBe("0 ms");
  expect(observedDuration("1234")).toBe("1 s 234 ms");
  expect(observedDuration("3661000")).toBe("1 h 1 min 1 s");
  expect(observedDuration("9007199254740993")).toBe(
    "2.501.999.792 h 59 min 993 ms",
  );
});
