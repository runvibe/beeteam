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
