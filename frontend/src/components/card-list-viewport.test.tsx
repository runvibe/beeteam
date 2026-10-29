import { act, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { CardListViewport } from "./card-list-viewport";

it("prefetches within its own scroll root and preserves cards through loading/error/end states", () => {
  let enter: IntersectionObserverCallback = () => {};
  let options: IntersectionObserverInit | undefined;
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(
        callback: IntersectionObserverCallback,
        config: IntersectionObserverInit,
      ) {
        enter = callback;
        options = config;
      }
      observe() {}
      disconnect() {}
      unobserve() {}
      takeRecords() {
        return [];
      }
    },
  );
  const state = {
    items: [{ id: "one" }],
    hasMore: true,
    fetching: false,
    initialLoading: false,
    error: null as unknown,
    total: 2,
    loadMore: vi.fn(),
    retry: vi.fn(),
    setCapacity: vi.fn(),
  };
  const draw = () => (
    <CardListViewport state={state} label="Cards">
      <article data-card-id="one">Existing card</article>
    </CardListViewport>
  );
  try {
    const { rerender } = render(draw());
    expect(options?.root).toBe(screen.getByRole("region", { name: "Cards" }));
    expect(options?.rootMargin).toMatch(/0px 0px \d+px 0px/);
    act(() =>
      enter(
        [{ isIntersecting: true }] as IntersectionObserverEntry[],
        {} as IntersectionObserver,
      ),
    );
    expect(state.loadMore).toHaveBeenCalledOnce();
    state.fetching = true;
    rerender(draw());
    expect(screen.getByText("Existing card")).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Carregando mais registros" }),
    ).toBeInTheDocument();
    state.fetching = false;
    state.error = new Error("offline");
    rerender(draw());
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.queryByRole("status", { name: /registros/ }),
    ).not.toBeInTheDocument();
    state.error = null;
    state.hasMore = false;
    rerender(draw());
    expect(screen.getByText(/Fim dos registros/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Carregar mais" }),
    ).not.toBeInTheDocument();
  } finally {
    vi.unstubAllGlobals();
  }
});
