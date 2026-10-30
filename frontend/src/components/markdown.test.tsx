import { render, screen } from "@testing-library/react";
import { it, expect } from "vitest";
import { Markdown } from "./markdown";
it("renders semantic Markdown while ignoring raw HTML and unsafe links", () => {
  const { container } = render(
    <Markdown>
      {
        "# Requisitos\n\n- Item\n\n| A | B |\n|---|---|\n| C | D |\n\n```js\nconst x = 1\n```\n\n[Documentação](https://example.com)\n\n[Inseguro](javascript:alert%281%29)\n\n<script>alert(1)</script>\n\n<img src=x onerror=alert(1) />"
      }
    </Markdown>,
  );
  expect(screen.getByRole("heading", { name: "Requisitos" })).toBeVisible();
  expect(screen.getByRole("list")).toBeVisible();
  expect(screen.getByRole("table")).toBeVisible();
  expect(container.querySelector("pre code")).toHaveTextContent("const x = 1");
  expect(screen.getByRole("link", { name: "Documentação" })).toHaveAttribute(
    "rel",
    "noopener noreferrer",
  );
  expect(screen.queryByRole("link", { name: "Inseguro" })).toBeNull();
  expect(container.querySelector("script,img")).toBeNull();
});

it("nests task document headings below the page and section titles", () => {
  render(
    <Markdown headingOffset={2}>
      {"# Documento\n\n## Requisitos\n\n### Entrega"}
    </Markdown>,
  );
  expect(
    screen.getByRole("heading", { name: "Documento", level: 3 }),
  ).toBeVisible();
  expect(
    screen.getByRole("heading", { name: "Requisitos", level: 4 }),
  ).toBeVisible();
  expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
});

it("retains task document nodes when its parent refreshes", () => {
  const view = render(
    <Markdown headingOffset={2}>
      {"# Documento\n\n[Referência](https://example.com)"}
    </Markdown>,
  );
  const title = screen.getByRole("heading", { name: "Documento" });
  const link = screen.getByRole("link", { name: "Referência" });
  view.rerender(
    <Markdown headingOffset={2}>
      {"# Documento\n\n[Referência](https://example.com)"}
    </Markdown>,
  );
  expect(screen.getByRole("heading", { name: "Documento" })).toBe(title);
  expect(screen.getByRole("link", { name: "Referência" })).toBe(link);
});

it("divides principal document sections without splitting nested content or duplicating authored rules", () => {
  const content =
    "# Documento\n\nIntrodução.\n\n## Objetivo\n\nTexto.\n\n### Detalhe\n\n- Um\n- Dois\n\n---\n\n## Critérios\n\nTexto final.";
  const view = render(
    <Markdown headingOffset={2} sectionDividers>
      {content}
    </Markdown>,
  );
  expect(screen.getByRole("heading", { name: "Documento" })).not.toHaveClass(
    "markdown-section-start",
  );
  expect(screen.getByRole("heading", { name: "Objetivo" })).toHaveClass(
    "markdown-section-start",
  );
  expect(screen.getByRole("heading", { name: "Detalhe" })).not.toHaveClass(
    "markdown-section-start",
  );
  expect(screen.getByRole("heading", { name: "Critérios" })).not.toHaveClass(
    "markdown-section-start",
  );
  expect(view.container.querySelectorAll("hr")).toHaveLength(1);
  expect(screen.getAllByRole("listitem")).toHaveLength(2);
  const heading = screen.getByRole("heading", { name: "Objetivo" });
  view.rerender(
    <Markdown headingOffset={2} sectionDividers>
      {content}
    </Markdown>,
  );
  expect(screen.getByRole("heading", { name: "Objetivo" })).toBe(heading);
});

it("handles untitled sections and leaves plain Markdown unchanged by default", () => {
  const content = "### Primeiro\n\nTexto.\n\n### Segundo\n\nOutro texto.";
  const view = render(<Markdown sectionDividers>{content}</Markdown>);
  expect(screen.getByRole("heading", { name: "Primeiro" })).not.toHaveClass(
    "markdown-section-start",
  );
  expect(screen.getByRole("heading", { name: "Segundo" })).toHaveClass(
    "markdown-section-start",
  );
  view.rerender(<Markdown>{content}</Markdown>);
  expect(view.container.querySelector(".markdown-section-start")).toBeNull();
});
