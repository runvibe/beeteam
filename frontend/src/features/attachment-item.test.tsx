import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { ApiProvider } from "@/api/context";
import { createMockApi } from "@/api/mock";
import { makeSeed } from "@/api/seed";
import { Attachment } from "./attachment-item";

it("keeps removed metadata readable and prevents download", async () => {
  const seed = makeSeed();
  const item = {
    ...seed.attachments[0],
    originalName: "Imagem.png",
    mediaType: "image/png",
    sizeBytes: 2500000,
    deletedAt: "2026-11-03T12:00:00Z",
  };
  const api = createMockApi({ seed, delay: 0 });
  const download = vi.spyOn(api, "download");
  render(
    <ApiProvider api={api}>
      <Attachment item={item} />
    </ApiProvider>,
  );
  expect(
    screen.getByRole("heading", { name: item.originalName }),
  ).toBeVisible();
  expect(screen.getByText("Imagem")).toHaveAttribute("title", "image/png");
  expect(screen.getByText("2,5 MB")).toHaveAttribute(
    "title",
    "2.500.000 bytes",
  );
  expect(screen.getByText("Removido")).toBeVisible();
  expect(screen.getByText(/Removido em/)).toBeVisible();
  const button = screen.getByRole("button", { name: "Baixar arquivo" });
  expect(button).toBeDisabled();
  await userEvent.click(button);
  expect(download).not.toHaveBeenCalled();
});

it("keeps the download action available after a failure and preserves the file description", async () => {
  const seed = makeSeed();
  const item = {
    ...seed.attachments[0],
    description: "**Descrição preservada**",
    deletedAt: null,
  };
  const api = createMockApi({ seed, delay: 0 });
  const download = vi
    .spyOn(api, "download")
    .mockRejectedValue(new Error("Falha de download"));
  render(
    <ApiProvider api={api}>
      <Attachment item={item} />
    </ApiProvider>,
  );
  const button = screen.getByRole("button", { name: "Baixar arquivo" });
  await userEvent.click(button);
  expect(download).toHaveBeenCalledWith(item.taskId, item.id);
  expect(await screen.findByText("Falha de download")).toBeVisible();
  expect(button).toBeEnabled();
  expect(screen.getByText("Descrição preservada").tagName).toBe("STRONG");
});
