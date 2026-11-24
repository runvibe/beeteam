import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";

function installStyles(path: string) {
  const style = document.createElement("style");
  style.textContent = readFileSync(path, "utf8");
  document.head.append(style);
  return () => style.remove();
}

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

it("keeps the breadcrumb filling the content header", () => {
  const removeStyles = installStyles("src/features/chat-side-panel.css");
  try {
    render(
      <div className="icon-navigation">
        <div className="main-shell">
          <header className="topbar">
            <nav className="context-path" aria-label="Path">
              A path
            </nav>
          </header>
        </div>
      </div>,
    );
    expect(
      getComputedStyle(screen.getByRole("navigation", { name: "Path" }))
        .flexGrow,
    ).toBe("1");
  } finally {
    removeStyles();
  }
});

it("keeps a long breadcrumb on one line beside the Hive navigation", () => {
  const removeOperations = installStyles("src/operations.css");
  const removeWorkspace = installStyles("src/features/chat-side-panel.css");
  try {
    render(
      <div className="icon-navigation">
        <div className="main-shell">
          <header className="topbar">
            <nav className="context-path" aria-label="Path">
              <ol>
                <li>
                  <a href="/boards">Boards</a>
                </li>
                <li>
                  <span aria-current="page">A long task name</span>
                </li>
              </ol>
            </nav>
          </header>
        </div>
      </div>,
    );
    const path = screen.getByRole("navigation", { name: "Path" });
    expect(getComputedStyle(path.querySelector("ol")!).flexWrap).toBe("nowrap");
    const current = path.querySelector('[aria-current="page"]')!;
    expect(getComputedStyle(current).whiteSpace).toBe("nowrap");
    expect(getComputedStyle(current).textOverflow).toBe("ellipsis");
  } finally {
    removeWorkspace();
    removeOperations();
  }
});

it.each([
  [false, "1", "2"],
  [true, "2", "3"],
] as const)(
  "keeps narrow Hive navigation and controls usable beside the native titlebar (details: %s)",
  (hasDetails, navigationRow, controlsRow) => {
    const removeApp = installStyles("src/App.css");
    const removeNavigation = installStyles("src/navigation.css");
    const removeHive = installStyles("src/features/hive-navigation.css");
    const compactStyles = document.createElement("style");
    document.documentElement.dataset.desktopTitlebar = "macos";
    try {
      const sheet = document.styleSheets.item(document.styleSheets.length - 1)!;
      const desktop = Array.from(sheet.cssRules).find(
        (rule): rule is CSSMediaRule =>
          rule instanceof CSSMediaRule &&
          rule.conditionText === "(min-width: 851px)",
      );
      const compact = Array.from(desktop!.cssRules).find(
        (rule) =>
          rule.cssText.startsWith(
            "@container workspace-content (max-width: 400px)",
          ),
      ) as CSSGroupingRule | undefined;
      compactStyles.textContent = Array.from(
        compact?.cssRules ?? [],
        (rule) => rule.cssText,
      ).join("\n");
      document.head.append(compactStyles);
      render(
        <div className="icon-navigation">
          <div className="chat-workspace" data-window-leading-panel="content">
            <div className="main-shell" data-hive>
              <header className="topbar">
                <nav className="hive-navigation" aria-label="Hive">
                  Hive
                </nav>
                <nav className="context-path" aria-label="Path">
                  Path
                </nav>
                <div
                  className="header-filter-slot"
                  role="group"
                  aria-label="Filters"
                >
                  <button>Filter</button>
                  {hasDetails && (
                    <button className="detail-info-button">Details</button>
                  )}
                </div>
                <button className="content-panel-close">Close</button>
              </header>
            </div>
          </div>
        </div>,
      );
      const header = document.querySelector(".topbar")!;
      expect(getComputedStyle(header).display).toBe("grid");
      expect(
        getComputedStyle(screen.getByRole("navigation", { name: "Hive" }))
          .gridRow,
      ).toBe(navigationRow);
      expect(
        getComputedStyle(screen.getByRole("group", { name: "Filters" })).gridRow,
      ).toBe(controlsRow);
      expect(
        getComputedStyle(screen.getByRole("button", { name: "Close" })).gridRow,
      ).toBe(controlsRow);
    } finally {
      delete document.documentElement.dataset.desktopTitlebar;
      compactStyles.remove();
      removeHive();
      removeNavigation();
      removeApp();
    }
  },
);

it("supports touch dragging from the breadcrumb without blocking header filters", () => {
  const removeStyles = installStyles("src/features/chat-side-panel.css");
  try {
    render(
      <div className="chat-workspace" data-dockable="true">
        <div className="main-shell">
          <header className="topbar" data-dock-handle="content">
            <nav className="context-path" aria-label="Path">A path</nav>
            <div className="header-filter-slot" role="group" aria-label="Filters">
              <button>Filter</button>
            </div>
          </header>
        </div>
      </div>,
    );
    expect(
      getComputedStyle(screen.getByRole("navigation", { name: "Path" }))
        .touchAction,
    ).toBe("none");
    expect(
      getComputedStyle(screen.getByRole("group", { name: "Filters" }))
        .touchAction,
    ).not.toBe("none");
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

it("reserves header space for the fixed compact detail button", () => {
  const removeStyles = installStyles(
    "src/components/detail-layout/detail-layout.css",
  );
  try {
    const { container } = render(
      <div className="icon-navigation">
        <div className="main-shell">
          <header className="topbar">
            <nav className="context-path" aria-label="Path">
              A long path
            </nav>
            <div className="header-filter-slot">
              <button className="detail-info-button">Details</button>
            </div>
          </header>
        </div>
      </div>,
    );
    const header = container.querySelector(".topbar")!;
    const path = screen.getByRole("navigation", { name: "Path" });
    expect(getComputedStyle(header).paddingRight).toContain("52px");
    expect(getComputedStyle(path).overflow).toBe("hidden");
    screen.getByRole("button", { name: "Details" }).hidden = true;
    expect(getComputedStyle(header).paddingRight).not.toContain("52px");
  } finally {
    removeStyles();
  }
});

it("keeps the breadcrumb on its own row in very narrow desktop content", () => {
  const workspaceStyles = readFileSync(
    "src/features/chat-side-panel.css",
    "utf8",
  );
  const detailStyles = readFileSync(
    "src/components/detail-layout/detail-layout.css",
    "utf8",
  );
  expect(workspaceStyles).toContain(
    "container: workspace-content / inline-size",
  );
  expect(detailStyles).toContain(
    "@container workspace-content (max-width: 280px)",
  );
  expect(detailStyles).toContain("grid-column: 1 / -1");
  expect(detailStyles).toContain("grid-row: 2");
});

it("keeps Hive navigation above the breadcrumb in very narrow detail headers", () => {
  const removeStyles = installStyles(
    "src/components/detail-layout/detail-layout.css",
  );
  const compactStyles = document.createElement("style");
  try {
    const sheet = document.styleSheets.item(document.styleSheets.length - 1)!;
    const desktop = Array.from(sheet.cssRules).find(
      (rule): rule is CSSMediaRule =>
        rule instanceof CSSMediaRule &&
        rule.conditionText === "(min-width: 851px)",
    );
    const compact = Array.from(desktop!.cssRules).find(
      (rule) =>
        rule.cssText.startsWith(
          "@container workspace-content (max-width: 280px)",
        ),
    ) as CSSGroupingRule;
    compactStyles.textContent = Array.from(
      compact.cssRules,
      (rule) => rule.cssText,
    ).join("\n");
    document.head.append(compactStyles);
    render(
      <div className="icon-navigation">
        <div className="main-shell" data-hive>
          <header className="topbar">
            <nav className="hive-navigation" aria-label="Hive">
              Hive
            </nav>
            <nav className="context-path" aria-label="Path">
              Path
            </nav>
            <div className="header-filter-slot">
              <button className="detail-info-button">Details</button>
            </div>
            <button className="content-panel-close">Close</button>
          </header>
        </div>
      </div>,
    );
    const hiveRow = Number(
      getComputedStyle(screen.getByRole("navigation", { name: "Hive" }))
        .gridRow,
    );
    const pathRow = Number(
      getComputedStyle(screen.getByRole("navigation", { name: "Path" }))
        .gridRow,
    );
    expect(hiveRow).toBeGreaterThan(0);
    expect(hiveRow).toBeLessThan(pathRow);
  } finally {
    compactStyles.remove();
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
