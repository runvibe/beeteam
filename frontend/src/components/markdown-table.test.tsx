import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { setLocalePreference } from "@/i18n";
import { Markdown } from "./markdown";
import { ChatMarkdownTable } from "./markdown-table";

afterEach(() => {
  vi.unstubAllGlobals();
});

it("copies the selected chat table as escaped CSV with its headers", async () => {
  setLocalePreference("en");
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
  render(
    <Markdown copyTables>
      {'| Name | Details | Empty |\n| --- | --- | --- |\n| **João** | "Hello, world" | |\n| [Link](https://example.com) | A \\| B | done |\n\n| Other |\n| --- |\n| Second |'}
    </Markdown>,
  );

  const tables = screen.getAllByRole("region", { name: "Table" });
  fireEvent.click(within(tables[0]).getByRole("button", { name: "Copy table as CSV" }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith(
    'Name,Details,Empty\r\nJoão,"""Hello, world""",\r\nLink,A | B,done',
  ));
  expect(within(tables[0]).getByRole("status")).toHaveTextContent("Table copied.");
  fireEvent.click(within(tables[1]).getByRole("button", { name: "Copy table as CSV" }));
  await waitFor(() => expect(writeText).toHaveBeenLastCalledWith("Other\r\nSecond"));
});

it("reports clipboard failures and leaves copying out of other Markdown views", async () => {
  setLocalePreference("en");
  const writeText = vi.fn().mockRejectedValue(new Error("clipboard denied"));
  vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
  const source = "| A |\n| --- |\n| B |";
  const { rerender } = render(<Markdown>{source}</Markdown>);
  expect(screen.queryByRole("button", { name: "Copy table as CSV" })).toBeNull();
  rerender(<Markdown copyTables>{source}</Markdown>);
  fireEvent.click(screen.getByRole("button", { name: "Copy table as CSV" }));
  expect(await screen.findByText("Could not copy the table.")).toHaveAttribute("role", "status");
});

it("preserves line breaks and image descriptions inside CSV fields", async () => {
  setLocalePreference("en");
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
  render(
    <ChatMarkdownTable>
      <tbody><tr><td>First<br />Second</td><td><img alt="Diagram" /></td></tr></tbody>
    </ChatMarkdownTable>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Copy table as CSV" }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith('"First\r\nSecond",Diagram'));
});
