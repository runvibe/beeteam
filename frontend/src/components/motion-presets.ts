import type { CSSProperties } from "react";

// Seconds for Motion; CSS values below come from the same timing scale.
export const motionTiming = {
  feedback: 0.16,
  enter: 0.18,
  exit: 0.1,
  resize: 0.22,
};
export const filterSpring = {
  type: "spring" as const,
  stiffness: 380,
  damping: 32,
  mass: 0.8,
};
export const motionCssVariables = {
  "--motion-feedback": `${motionTiming.feedback}s`,
  "--motion-exit": `${motionTiming.exit}s`,
  "--motion-resize": `${motionTiming.resize}s`,
} as CSSProperties;

export function feedbackTransition(reduced: boolean | null, delay = 0) {
  return {
    duration: reduced ? 0 : motionTiming.feedback,
    delay: reduced ? 0 : delay,
    ease: "easeOut" as const,
  };
}

export function surfaceMotion(reduced: boolean | null) {
  return {
    initial: {
      opacity: reduced ? 1 : 0,
      y: reduced ? 0 : 4,
      scale: reduced ? 1 : 0.98,
    },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: {
      duration: reduced ? 0 : motionTiming.enter,
      ease: "easeOut" as const,
    },
    exit: {
      opacity: 0,
      y: reduced ? 0 : 4,
      scale: reduced ? 1 : 0.98,
      transition: { duration: reduced ? 0 : motionTiming.exit, delay: 0 },
    },
  };
}
