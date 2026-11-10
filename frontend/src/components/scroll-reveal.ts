/** Reveal within the strip without moving the surrounding page. */
export function revealInScrollStrip(
  viewport: HTMLElement,
  target: HTMLElement,
) {
  const bounds = viewport.getBoundingClientRect();
  const item = target.getBoundingClientRect();
  if (item.left < bounds.left) viewport.scrollLeft += item.left - bounds.left;
  else if (item.right > bounds.right)
    viewport.scrollLeft += item.right - bounds.right;
}
