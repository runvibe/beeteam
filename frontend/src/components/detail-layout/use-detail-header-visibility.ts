import { useEffect, useRef, useState } from "react";
export function useDetailHeaderVisibility() {
  const primary = useRef<HTMLDivElement>(null);
  const hero = useRef<HTMLDivElement>(null);
  const [pastHeader, setPastHeader] = useState(false);
  useEffect(() => {
    const root = primary.current;
    const target = hero.current;
    if (!root || !target || typeof IntersectionObserver === "undefined") return;
    const media = window.matchMedia("(min-width: 1056px)");
    let observer: IntersectionObserver | undefined;
    const observe = () => {
      observer?.disconnect();
      setPastHeader(false);
      if (!media.matches) return;
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry)
            setPastHeader(
              !entry.isIntersecting &&
                entry.boundingClientRect.bottom <= (entry.rootBounds?.top ?? 0),
            );
        },
        { root, threshold: 0 },
      );
      observer.observe(target);
    };
    observe();
    media.addEventListener("change", observe);
    return () => {
      observer?.disconnect();
      media.removeEventListener("change", observe);
    };
  }, []);
  return { primary, hero, pastHeader };
}
