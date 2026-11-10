import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

function installStyles(path: string) {
  const style = document.createElement("style");
  style.textContent = readFileSync(path, "utf8");
  document.head.append(style);
  return () => style.remove();
}

it("keeps home headings and destination links within narrow content", () => {
  const removeStyles = installStyles("src/launch/connected-home.css");
  try {
    render(
      <section className="connected-home">
        <h1>A long home heading</h1>
        <nav className="home-destinations">
          <a href="/guide">A long documentation link</a>
        </nav>
      </section>,
    );
    expect(getComputedStyle(screen.getByRole("heading")).overflowWrap).toBe(
      "anywhere",
    );
    const link = getComputedStyle(screen.getByRole("link"));
    expect(link.maxWidth).toBe("100%");
    expect(link.whiteSpace).toBe("normal");
  } finally {
    removeStyles();
  }
});

it("allows header filters to scroll when desktop content becomes narrow", () => {
  const removeStyles = installStyles("src/navigation.css");
  try {
    render(
      <div className="header-filter-slot">
        <div className="compact-filter-bar">
          <div className="filter-controls-row" role="group">
            <button>Filter</button>
          </div>
        </div>
      </div>,
    );
    const row = getComputedStyle(screen.getByRole("group"));
    expect(row.overflowX).toBe("auto");
    expect(row.scrollbarWidth).toBe("thin");
  } finally {
    removeStyles();
  }
});

it("keeps the fixed detail button on the content side of a right-docked chat", () => {
  const removeStyles = installStyles(
    "src/components/detail-layout/detail-layout.css",
  );
  const inheritedTransitions = document.createElement("style");
  inheritedTransitions.textContent =
    ".transition-all { transition-property: all; }";
  document.head.append(inheritedTransitions);
  try {
    render(
      <div
        className="chat-workspace"
        data-chat-open="true"
        data-chat-side="right"
      >
        <button className="detail-info-button transition-all">Details</button>
      </div>,
    );
    const button = getComputedStyle(screen.getByRole("button"));
    expect(button.position).toBe("fixed");
    expect(button.right).toContain("--chat-panel-width");
    const transitionedProperties = button.transitionProperty
      .split(",")
      .map((value) => value.trim());
    expect(transitionedProperties).not.toContain("all");
    expect(transitionedProperties).not.toContain("right");
  } finally {
    inheritedTransitions.remove();
    removeStyles();
  }
});

it("hides background detail controls while the mobile chat overlay is open", () => {
  const removeStyles = installStyles(
    "src/components/detail-layout/detail-layout.css",
  );
  const activeMediaStyles = document.createElement("style");
  try {
    const sheet = document.styleSheets.item(document.styleSheets.length - 1)!;
    const mobile = Array.from(sheet.cssRules).find(
      (rule): rule is CSSMediaRule =>
        rule instanceof CSSMediaRule &&
        rule.conditionText === "(max-width: 850px)",
    );
    expect(mobile).toBeDefined();
    activeMediaStyles.textContent = Array.from(
      mobile!.cssRules,
      (rule) => rule.cssText,
    ).join("\n");
    document.head.append(activeMediaStyles);
    const { container } = render(
      <div className="chat-workspace" data-chat-open="true">
        <button className="detail-info-button">Details</button>
      </div>,
    );
    const workspace = container.firstElementChild!;
    const button = container.querySelector("button")!;
    expect(getComputedStyle(button).display).toBe("none");
    workspace.setAttribute("data-chat-open", "false");
    expect(getComputedStyle(button).display).toBe("inline-flex");
  } finally {
    activeMediaStyles.remove();
    removeStyles();
  }
});

it("keeps a safe-area-aware half-rem gutter on compact details", () => {
  const styles = readFileSync(
    "src/components/detail-layout/detail-layout.css",
    "utf8",
  );
  const detailGutter = styles.match(
    /\.icon-navigation main:has\(> \.detail-page\) \{([^}]*)\}/,
  );
  expect(detailGutter?.[1]).toContain(
    "padding-right: max(0.5rem, env(safe-area-inset-right));",
  );
});

it("lays out compact desktop details in one column and exposes their controls", () => {
  const removeStyles = installStyles(
    "src/components/detail-layout/detail-layout.css",
  );
  try {
    render(
      <>
        <button className="detail-info-button">Details</button>
        <section className="detail-page" data-detail-compact="true">
          <div className="detail-columns">
            <header className="detail-context-screen-header">Context</header>
          </div>
        </section>
      </>,
    );
    const columns = document.querySelector(".detail-columns")!;
    expect(getComputedStyle(columns).gridTemplateColumns).toBe(
      "minmax(0, 1fr)",
    );
    expect(getComputedStyle(screen.getByRole("button")).display).toBe(
      "inline-flex",
    );
    expect(
      getComputedStyle(document.querySelector(".detail-context-screen-header")!)
        .display,
    ).toBe("grid");
  } finally {
    removeStyles();
  }
});

it("wraps detail records rather than clipping their badges in narrow content", () => {
  const removeStyles = installStyles(
    "src/components/detail-layout/detail-layout.css",
  );
  try {
    render(
      <section className="detail-page" data-detail-compact="true">
        <div className="record-row">
          <button>Agent name</button>
          <span>Leader</span>
        </div>
      </section>,
    );
    expect(
      getComputedStyle(document.querySelector(".record-row")!).flexWrap,
    ).toBe("wrap");
  } finally {
    removeStyles();
  }
});
