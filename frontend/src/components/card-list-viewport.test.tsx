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
    expect(document.querySelector(".card-list-footer")).toHaveStyle({
      minHeight: "64px",
    });
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
    expect(screen.getByText(/Fim dos registros/)).toHaveClass("sr-only");
    expect(document.querySelector(".card-list-footer")).toHaveStyle({
      minHeight: "1rem",
    });
    expect(
      screen.queryByRole("button", { name: "Carregar mais" }),
    ).not.toBeInTheDocument();
  } finally {
    vi.unstubAllGlobals();
  }
});
import { fireEvent } from "@testing-library/react";

it("preserves the anchor beyond five blocks, restores it and allows scrolling to the first card", () => {
  window.history.replaceState({}, "", "/boards?scroll-retention-test");
  const geometry = vi
    .spyOn(HTMLElement.prototype, "getBoundingClientRect")
    .mockImplementation(function (this: HTMLElement) {
      const parent = this.closest(".card-list-viewport") as HTMLElement | null;
      const top = this.dataset.cardId
        ? Number(this.dataset.cardId) * 354 - (parent?.scrollTop ?? 0)
        : 0;
      return {
        x: 0,
        y: top,
        top,
        bottom: top + 340,
        left: 0,
        right: 280,
        width: 280,
        height: 340,
        toJSON: () => ({}),
      };
    });
  const state = {
    items: Array.from({ length: 6 }, (_, id) => ({ id: String(id) })),
    hasMore: true,
    fetching: false,
    initialLoading: false,
    error: null,
    total: 8,
    loadMore: vi.fn(),
    retry: vi.fn(),
    setCapacity: vi.fn(),
  };
  const draw = () => (
    <CardListViewport state={state} label="Retained cards">
      {state.items.map((item) => (
        <article key={item.id} data-card-id={item.id}>
          Card {item.id}
        </article>
      ))}
    </CardListViewport>
  );
  try {
    const first = render(draw());
    let region = screen.getByRole("region", { name: "Retained cards" });
    region.scrollTop = 5 * 354 + 25;
    fireEvent.scroll(region);
    state.items = Array.from({ length: 8 }, (_, id) => ({ id: String(id) }));
    first.rerender(draw());
    expect(region.scrollTop).toBe(5 * 354 + 25);
    expect(screen.getAllByRole("article")).toHaveLength(8);
    first.unmount();
    render(draw());
    region = screen.getByRole("region", { name: "Retained cards" });
    expect(region.scrollTop).toBe(5 * 354 + 25);
    region.scrollTop = 0;
    fireEvent.scroll(region);
    expect(screen.getByText("Card 0").getBoundingClientRect().top).toBe(0);
    expect(screen.getAllByRole("article")).toHaveLength(8);
  } finally {
    geometry.mockRestore();
  }
});

it.each([false, true])(
  "returns only the card region to the top (reduced motion: %s)",
  (reduced) => {
    window.history.replaceState({}, "", `/teams?to-top=${reduced}`);
    const url = location.href;
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: reduced })));
    const state = {
      items: [{ id: "retained" }],
      hasMore: false,
      fetching: false,
      initialLoading: false,
      error: null,
      total: 80,
      loadMore: vi.fn(),
      retry: vi.fn(),
      setCapacity: vi.fn(),
    };
    render(
      <CardListViewport state={state} label="Cards">
        <article data-card-id="retained">Retained card</article>
      </CardListViewport>,
    );
    const region = screen.getByRole("region", { name: "Cards" });
    const scrollTo = vi.fn();
    region.scrollTo = scrollTo;
    expect(
      screen.queryByRole("button", { name: "Voltar ao topo" }),
    ).not.toBeInTheDocument();
    region.scrollTop = 600;
    fireEvent.scroll(region);
    const button = screen.getByRole("button", { name: "Voltar ao topo" });
    button.focus();
    fireEvent.click(button);
    expect(scrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: reduced ? "instant" : "smooth",
    });
    expect(location.href).toBe(url);
    expect(screen.getByText("Retained card")).toBeInTheDocument();
    region.scrollTop = 0;
    fireEvent.scroll(region);
    expect(
      screen.queryByRole("button", { name: "Voltar ao topo" }),
    ).not.toBeInTheDocument();
    expect(region).toHaveFocus();
    expect(state.loadMore).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  },
);
