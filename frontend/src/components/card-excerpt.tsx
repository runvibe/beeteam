import { useLayoutEffect, useRef, useState } from "react";

/** Keeps the full text accessible; only its visual preview is clipped. */
export function CardExcerpt({ text }: { text: string | null | undefined }) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState(false);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () =>
      setOverflow(node.scrollHeight > node.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    if (node.firstElementChild) observer.observe(node.firstElementChild);
    return () => observer.disconnect();
  }, [text]);
  return (
    <div ref={ref} className="card-excerpt" data-overflow={overflow}>
      <span>{text}</span>
    </div>
  );
}
