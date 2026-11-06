import { afterEach, expect, it, vi } from "vitest";
import { revealTheme } from "./theme-reveal";

afterEach(() => vi.restoreAllMocks());

it("reveals from the trigger center far enough to cover the farthest corner", async () => {
  const root = document.documentElement;
  vi.spyOn(root, "clientWidth", "get").mockReturnValue(800);
  vi.spyOn(root, "clientHeight", "get").mockReturnValue(600);
  const trigger = document.createElement("button");
  vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue(new DOMRect(20, 40, 40, 20));
  let finish!: () => void;
  const finished = new Promise<void>((resolve) => { finish = resolve; });
  const update = vi.fn();
  Object.defineProperty(document, "startViewTransition", {
    configurable: true,
    value: (apply: () => void) => {
      apply();
      return { ready: Promise.resolve(), finished, skipTransition: vi.fn() };
    },
  });
  try {
    revealTheme(trigger, update);
    expect(update).toHaveBeenCalledOnce();
    expect(root.style.getPropertyValue("--bee-reveal-x")).toBe("40px");
    expect(root.style.getPropertyValue("--bee-reveal-y")).toBe("50px");
    expect(root.style.getPropertyValue("--bee-reveal-radius"))
      .toBe(Math.ceil(Math.hypot(760, 550)) + "px");
    expect(root).toHaveAttribute("data-theme-reveal");
    finish();
    await finished;
    expect(root).not.toHaveAttribute("data-theme-reveal");
  } finally {
    Reflect.deleteProperty(document, "startViewTransition");
  }
});
