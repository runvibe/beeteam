import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { it, expect, vi } from "vitest";
import { StatusSettings } from "./status-settings";
import { ApiProvider } from "@/api/context";
import { createHttpApi } from "@/api/http";
import { makeSeed } from "@/api/seed";
it("keeps the creation key when retrying an uncertain network failure", async () => {
  const keys: string[] = [];
  const fetcher = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === "POST") {
      keys.push(new Headers(init.headers).get("Idempotency-Key")!);
      if (keys.length === 1) throw new TypeError("connection lost");
      return new Response(JSON.stringify({ id: "created" }));
    }
    return new Response(
      JSON.stringify({
        items: [],
        total: 0,
        offset: 0,
        limit: 100,
        hasMore: false,
        nextOffset: null,
      }),
    );
  });
  render(
    <ApiProvider api={createHttpApi({ fetch: fetcher })}>
      <StatusSettings board={makeSeed().boards[0]} />
    </ApiProvider>,
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Adicionar status" }),
  );
  await userEvent.type(screen.getByLabelText("Novo status"), "Revisão HTTP");
  await userEvent.click(
    screen.getByRole("button", { name: "Salvar" }),
  );
  expect(await screen.findByText(/Não foi possível conectar/)).toBeVisible();
  await userEvent.click(
    screen.getByRole("button", { name: "Salvar" }),
  );
  await waitFor(() =>
    expect(screen.queryByLabelText("Novo status")).not.toBeInTheDocument(),
  );
  expect(keys[0]).toBe(keys[1]);
  await userEvent.click(
    screen.getByRole("button", { name: "Adicionar status" }),
  );
  await userEvent.type(screen.getByLabelText("Novo status"), "Outra intenção");
  await userEvent.click(
    screen.getByRole("button", { name: "Salvar" }),
  );
  await waitFor(() => expect(keys.length).toBe(3));
  expect(keys[2]).not.toBe(keys[1]);
});
