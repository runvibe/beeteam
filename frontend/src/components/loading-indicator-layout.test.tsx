import { readFileSync } from "node:fs";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { LoadingIndicator } from "./loading-indicator";

it("contains its absolutely positioned accessible text inside the loading box", () => {
  const style = document.createElement("style");
  style.textContent = readFileSync(
    "src/components/loading-indicator.css",
    "utf8",
  );
  document.head.append(style);
  try {
    render(<LoadingIndicator label="Carregando histórico de alterações" />);
    const status = screen.getByRole("status", {
      name: "Carregando histórico de alterações",
    });
    expect(status.querySelector(".sr-only")).toHaveTextContent(
      "Carregando histórico de alterações",
    );
    // A local containing block prevents the off-screen label from extending root scroll overflow.
    expect(getComputedStyle(status).position).toBe("relative");
  } finally {
    style.remove();
  }
});
