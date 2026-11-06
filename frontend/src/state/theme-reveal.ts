import "./theme-reveal.css";

let active: ViewTransition | undefined;
let fallback: HTMLElement | undefined;

/** Explicit user actions opt in. Initial theme, system and storage events apply directly. */
export function revealTheme(control: Element, apply: () => void): void {
  const doc = control.ownerDocument;
  const root = doc.documentElement;
  const { left, top, width, height } = control.getBoundingClientRect();
  const x = left + width / 2;
  const y = top + height / 2;
  const radius = Math.ceil(Math.hypot(
    Math.max(x, root.clientWidth - x),
    Math.max(y, root.clientHeight - y),
  ));
  root.style.setProperty("--bee-reveal-x", x + "px");
  root.style.setProperty("--bee-reveal-y", y + "px");
  root.style.setProperty("--bee-reveal-radius", radius + "px");
  fallback?.remove();
  active?.skipTransition();

  if (typeof doc.startViewTransition === "function") {
    root.dataset.themeReveal = "";
    const transition = doc.startViewTransition(apply);
    active = transition;
    const cleanup = () => {
      if (active !== transition) return;
      active = undefined;
      delete root.dataset.themeReveal;
    };
    void transition.ready.catch(() => {}); // Interruption skips the snapshots.
    void transition.finished.then(cleanup, cleanup);
    return;
  }

  // Older WebViews use a lightweight matte in the outgoing background color.
  const matte = doc.createElement("div");
  matte.className = "bee-theme-reveal-matte";
  matte.setAttribute("aria-hidden", "true");
  matte.style.backgroundColor = getComputedStyle(doc.body).backgroundColor;
  apply();
  const win = doc.defaultView;
  if (!win?.requestAnimationFrame || radius === 0) return;
  doc.body.append(matte);
  fallback = matte;
  const start = win.performance.now();
  function draw(now: number) {
    if (!matte.isConnected) return;
    const progress = Math.min(1, (now - start) / 480);
    const r = radius * (1 - Math.pow(1 - progress, 2));
    matte.style.maskImage = `radial-gradient(circle at ${x}px ${y}px, transparent ${r}px, black ${r + 1}px)`;
    if (progress < 1) win!.requestAnimationFrame(draw);
    else {
      matte.remove();
      if (fallback === matte) fallback = undefined;
    }
  }
  win.requestAnimationFrame(draw);
}
