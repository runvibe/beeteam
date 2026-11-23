import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Composer } from "./managed-agent-chat-parts";
import { i18n } from "@/i18n";

beforeEach(async () => {
  await i18n.changeLanguage("en");
});
function props() {
  return {
    value: "",
    onChange: vi.fn(),
    onSubmit: vi.fn(),
    locked: false,
    canSend: false,
    retry: false,
    voice: { active: false, canStart: true, start: vi.fn(), stop: vi.fn() },
  };
}
describe("composer voice action", () => {
  it("switches from microphone to send to end-call as draft and call state change", () => {
    const p = props();
    const view = render(<Composer {...p} />);
    fireEvent.click(screen.getByRole("button", { name: "Talk by voice" }));
    expect(p.voice.start).toHaveBeenCalledOnce();
    view.rerender(
      <Composer
        {...p}
        voice={{ ...p.voice, active: true }}
        value="Run tests"
        canSend
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Send request" }));
    expect(p.onSubmit).toHaveBeenCalledOnce();
    expect(p.voice.stop).not.toHaveBeenCalled();
    view.rerender(<Composer {...p} voice={{ ...p.voice, active: true }} />);
    fireEvent.click(screen.getByRole("button", { name: "End voice call" }));
    expect(p.voice.stop).toHaveBeenCalledOnce();
    view.rerender(<Composer {...p} />);
    expect(screen.getByRole("button", { name: "Talk by voice" })).toBeEnabled();
  });
  it("keeps the stop action enabled while the empty composer is locked", () => {
    const p = props();
    render(
      <Composer
        {...p}
        locked
        readOnly
        voice={{ ...p.voice, active: true, canStart: false }}
      />,
    );
    const stop = screen.getByRole("button", { name: "End voice call" });
    expect(stop).toBeEnabled();
    fireEvent.click(stop);
    expect(p.voice.stop).toHaveBeenCalledOnce();
  });
  it("lets a locked pending text send end the call without discarding the draft", () => {
    const p = props();
    const view = render(
      <Composer
        {...p}
        value="Retained pending draft"
        locked
        retry
        voice={{ ...p.voice, active: true }}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "End voice call" }));
    expect(p.voice.stop).toHaveBeenCalledOnce();
    expect(p.onChange).not.toHaveBeenCalled();
    expect(p.onSubmit).not.toHaveBeenCalled();
    view.rerender(
      <Composer {...p} value="Retained pending draft" locked retry canSend />,
    );
    expect(
      screen.getByRole("button", { name: "Check send with the same key" }),
    ).toBeEnabled();
  });
  it("does not start or stop voice on Enter with an empty draft", () => {
    const p = props();
    const view = render(<Composer {...p} />);
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    expect(p.voice.start).not.toHaveBeenCalled();
    view.rerender(<Composer {...p} voice={{ ...p.voice, active: true }} />);
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    expect(p.voice.stop).not.toHaveBeenCalled();
    expect(p.onSubmit).not.toHaveBeenCalled();
  });
  it("retains Enter send behavior during voice and respects start restrictions", () => {
    const p = props();
    const view = render(
      <Composer
        {...p}
        value="Run tests"
        canSend
        voice={{ ...p.voice, active: true }}
      />,
    );
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    expect(p.onSubmit).toHaveBeenCalledOnce();
    view.rerender(<Composer {...p} readOnly />);
    expect(
      screen.getByRole("button", { name: "Talk by voice" }),
    ).toBeDisabled();
    view.rerender(<Composer {...p} voice={{ ...p.voice, canStart: false }} />);
    expect(
      screen.getByRole("button", { name: "Talk by voice" }),
    ).toBeDisabled();
  });
  it("preserves uncertain request retry when voice is idle", () => {
    const p = props();
    render(<Composer {...p} retry canSend />);
    fireEvent.click(
      screen.getByRole("button", { name: "Check send with the same key" }),
    );
    expect(p.onSubmit).toHaveBeenCalledOnce();
    expect(p.voice.start).not.toHaveBeenCalled();
  });
});
