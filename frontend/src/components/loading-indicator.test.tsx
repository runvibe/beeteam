import { StrictMode } from "react";
import { act, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { LoadingIndicator } from "./loading-indicator";

afterEach(() => vi.useRealTimers());

it("shows the spinner only after 100 continuous milliseconds, including StrictMode", () => {
  vi.useFakeTimers();
  render(
    <StrictMode>
      <LoadingIndicator label="Carregando" />
    </StrictMode>,
  );
  const status = screen.getByRole("status", { name: "Carregando" });
  const spinner = status.querySelector("svg")!;
  expect(status).toHaveAttribute("aria-busy", "true");
  expect(spinner).not.toBeVisible();
  act(() => vi.advanceTimersByTime(99));
  expect(spinner).not.toBeVisible();
  act(() => vi.advanceTimersByTime(1));
  expect(spinner).toBeVisible();
});

it.each([50, 100, 150])(
  "cancels on finish at %sms and starts a fresh delay for the next request",
  (finishAt) => {
    vi.useFakeTimers();
    const view = render(<LoadingIndicator />);
    act(() => vi.advanceTimersByTime(finishAt));
    view.rerender(<></>);
    expect(screen.queryByRole("status")).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    act(() => vi.advanceTimersByTime(200));
    expect(screen.queryByRole("status")).toBeNull();
    view.rerender(<LoadingIndicator />);
    const spinner = screen.getByRole("status").querySelector("svg")!;
    act(() => vi.advanceTimersByTime(99));
    expect(spinner).not.toBeVisible();
    act(() => vi.advanceTimersByTime(1));
    expect(spinner).toBeVisible();
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  },
);
