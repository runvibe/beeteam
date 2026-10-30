import { useLayoutEffect } from "react";
import { useAnimationControls, useReducedMotion } from "motion/react";

export const filterSpring = {
  type: "spring" as const,
  stiffness: 380,
  damping: 32,
  mass: 0.8,
};
export function pageMotionIdentity(url: string, resolvedId?: string) {
  const [, resource = "boards", alias = ""] = url.split("?")[0].split("/");
  return `${resource || "boards"}/${resolvedId || alias}`;
}

/** Animate the existing main surface; never retain or remount route children. */
export function usePageEntrance(identity: string) {
  const controls = useAnimationControls();
  const reduced = useReducedMotion();
  useLayoutEffect(() => {
    controls.stop();
    controls.set({ opacity: reduced ? 1 : 0.72 });
    const frame = requestAnimationFrame(() => {
      void controls.start({
        opacity: 1,
        transition: { duration: reduced ? 0 : 0.18, ease: "easeOut" },
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      controls.stop();
    };
  }, [identity, reduced, controls]);
  return controls;
}
