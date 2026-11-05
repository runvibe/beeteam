import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import catalog from "../../../docs/mcp-catalog.json";
import purposes from "./tool-purposes.pt.json";
import Environment from "./Environment";
import Tools from "./Catalog";

it("indexes every tool, retains exact schemas, and distinguishes preview from restore", async () => {
  render(<Tools pt />);
  expect(Object.keys(purposes).sort()).toEqual(catalog.tools.map(tool => tool.name).sort());
  for (const tool of catalog.tools) {
    const entry = document.getElementById("tool-" + tool.name)!;
    expect(entry).toBeTruthy();
    expect(entry.querySelector("pre")).toBeNull();
  }
  const schema = document.querySelector<HTMLDetailsElement>("#tool-listBoards details")!;
  schema.open = true;
  fireEvent(schema, new Event("toggle"));
  await waitFor(() => expect(JSON.parse(schema.querySelector("pre")!.textContent!)).toEqual(catalog.tools.find(tool => tool.name === "listBoards")!.inputSchema));
  expect(document.querySelector("#tool-previewDataImport summary")).toHaveTextContent("Leitura");
  expect(document.querySelector("#tool-restoreDataImport summary")).toHaveTextContent("Gravação");
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "listBoards" } });
  expect(document.getElementById("tool-listBoards")).toBeTruthy();
  expect(document.getElementById("tool-updateBoard")).toBeNull();
});

it("opens a bookmarked tool on initial render", async () => {
  window.history.replaceState({}, "", "/guide/reference/mcp/tools#tool-listBoards");
  try {
    render(<Tools pt={false} />);
    await waitFor(() => expect(document.getElementById("tool-listBoards")).toHaveAttribute("open"));
  } finally {
    window.history.replaceState({}, "", "/");
  }
});

it("preserves literal settings and shell commands across languages and copies the selected example", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  const original = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  try {
    const { rerender } = render(<Environment pt={false}/>);
    const commands = Array.from(document.querySelectorAll("pre code"), element => element.textContent);
    rerender(<Environment pt/>);
    expect(screen.getByText("BEE_TRANSFER_RETENTION_SECONDS")).toBeVisible();
    expect(screen.getByText("APP_PORT")).toBeVisible();
    expect(Array.from(document.querySelectorAll("pre code"), element => element.textContent)).toEqual(commands);
    fireEvent.click(screen.getAllByRole("button", { name: "Copiar" })[1]);
    expect(writeText).toHaveBeenCalledWith(commands[1]);
    expect(await screen.findByText("Copiado")).toBeVisible();
  } finally {
    if (original) Object.defineProperty(navigator, "clipboard", original);
    else Reflect.deleteProperty(navigator, "clipboard");
  }
});
