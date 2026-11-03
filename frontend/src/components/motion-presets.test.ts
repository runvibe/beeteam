import { expect, it } from "vitest";
import { surfaceMotion, feedbackTransition } from "./motion-presets";

it("removes displacement, scaling, delay and duration for reduced motion", () => {
  const preset = surfaceMotion(true);
  expect(preset.initial).toMatchObject({ opacity: 1, y: 0, scale: 1 });
  expect(preset.animate).toMatchObject({ opacity: 1, y: 0, scale: 1 });
  expect(preset.exit).toMatchObject({ y: 0, scale: 1 });
  expect(preset.transition).toMatchObject({ duration: 0 });
  expect(feedbackTransition(true, 0.18)).toMatchObject({
    duration: 0,
    delay: 0,
  });
});

it("uses a short exit without delaying dismissal", () => {
  const preset = surfaceMotion(false);
  expect(preset.exit.transition.duration).toBeLessThan(
    preset.transition.duration,
  );
  expect(preset.exit.transition.delay ?? 0).toBe(0);
});
