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
