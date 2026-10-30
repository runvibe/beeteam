import { act, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { RelativeTime } from "./relative-time";
it("formats Portuguese relative time, keeps absolute datetime and updates on the shared clock", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-29T12:00:00Z"));
  try {
    const { rerender, unmount } = render(
      <RelativeTime value="2026-10-29T11:50:00Z" />,
    );
    const time = screen.getByText("há 10 minutos");
    expect(time).toHaveAttribute("datetime", "2026-10-29T11:50:00.000Z");
    expect(time.getAttribute("title")).toBeTruthy();
    act(() => vi.advanceTimersByTime(60000));
    expect(screen.getByText("há 11 minutos")).toBeInTheDocument();
    rerender(<RelativeTime value="2026-10-29T10:00:00Z" />);
    expect(screen.getByText("há 2 horas")).toBeInTheDocument();
    rerender(<RelativeTime value="2026-10-19T12:00:00Z" />);
    expect(screen.getByText("há 10 dias")).toBeInTheDocument();
    rerender(<RelativeTime value="invalid" />);
    expect(screen.getByText("Data indisponível")).toBeInTheDocument();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    vi.useRealTimers();
  }
});
