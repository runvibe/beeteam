import { MAX_MERMAID_CHARS, mermaidSourceFailure } from "./mermaid-policy";

export interface MermaidImage {
  src: string;
  width: number;
  description: string;
}
let queue: Promise<unknown> = Promise.resolve();
let sequence = 0;

// Import only once a visible diagram requests rendering. Serialize initialization
// and rendering together because Mermaid owns global configuration and a queue.
export function renderMermaid(
  source: string,
  theme: "light" | "dark",
  signal: AbortSignal,
): Promise<MermaidImage> {
  const render = async () => {
    signal.throwIfAborted();
    if (mermaidSourceFailure(source))
      throw new Error("mermaid_source_rejected");
    const [{ default: mermaid }, { default: DOMPurify }] = await Promise.all([
      import("mermaid"),
      import("dompurify"),
    ]);
    signal.throwIfAborted();
    const id = `bee-mermaid-${++sequence}`;
    const container = document.createElement("div");
    container.className = "mermaid-measurement";
    container.setAttribute("aria-hidden", "true");
    document.body.append(container);
    try {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: theme === "dark" ? "dark" : "neutral",
        htmlLabels: false,
        flowchart: { htmlLabels: false },
        maxTextSize: MAX_MERMAID_CHARS,
        maxEdges: 100,
        suppressErrorRendering: true,
        fontFamily: "sans-serif",
        // The source policy also rejects frontmatter/directives before parsing.
        secure: [
          "secure",
          "securityLevel",
          "startOnLoad",
          "maxTextSize",
          "maxEdges",
          "suppressErrorRendering",
          "htmlLabels",
          "flowchart",
          "theme",
          "themeCSS",
          "themeVariables",
          "dompurifyConfig",
        ],
      });
      const { svg } = await mermaid.render(id, source, container);
      signal.throwIfAborted();
      const safe = DOMPurify.sanitize(svg, {
        USE_PROFILES: { svg: true, svgFilters: true },
        FORBID_TAGS: [
          "a",
          "foreignObject",
          "script",
          "image",
          "use",
          "animate",
          "animateMotion",
          "animateTransform",
          "set",
        ],
        FORBID_ATTR: ["href", "xlink:href", "tabindex"],
      });
      const doc = new DOMParser().parseFromString(safe, "image/svg+xml");
      const root = doc.documentElement;
      if (root.localName !== "svg" || doc.querySelector("parsererror"))
        throw new Error("mermaid_svg_invalid");
      const box = root
        .getAttribute("viewBox")
        ?.split(/[\s,]+/)
        .map(Number);
      const width = box?.[2],
        height = box?.[3];
      if (
        !width ||
        !height ||
        !Number.isFinite(width) ||
        !Number.isFinite(height) ||
        width < 0 ||
        height < 0
      )
        throw new Error("mermaid_svg_size_invalid");
      root.setAttribute("width", String(width));
      root.setAttribute("height", String(height));
      const description = [
        root.querySelector("title")?.textContent,
        root.querySelector("desc")?.textContent,
      ]
        .filter(Boolean)
        .join(". ");
      // Image context disables scripts, links, foreign DOM and external resources.
      // Never insert the generated SVG into the application's live DOM or bind callbacks.
      return {
        src: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new XMLSerializer().serializeToString(root))}`,
        width,
        description,
      };
    } finally {
      container.remove();
    }
  };
  const pending = queue.then(render);
  queue = pending.catch(() => undefined);
  return pending;
}
