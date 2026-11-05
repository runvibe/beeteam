import { fireEvent, render, screen } from "@testing-library/react";
import { it, expect, vi } from "vitest";
import { setLocalePreference } from "@/i18n";
import { ApiCompatibilityMessage } from "./api-compatibility-message";

it.each(["en", "pt"] as const)(
  "distinguishes legacy, connection failure and incompatible contract in %s",
  (locale) => {
    setLocalePreference(locale);
    const retry = vi.fn();
    const view = render(
      <ApiCompatibilityMessage status="legacy" retry={retry} busy={false} />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      locale === "en"
        ? "verification is unavailable"
        : "verificação de compatibilidade está indisponível",
    );
    view.rerender(
      <ApiCompatibilityMessage status="error" retry={retry} busy={false} />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      locale === "en" ? "Check the connection" : "Confira a conexão",
    );
    const button = screen.getByRole("button");
    button.focus();
    fireEvent.click(button);
    expect(retry).toHaveBeenCalledTimes(1);
    view.rerender(
      <ApiCompatibilityMessage status="error" retry={retry} busy={true} />,
    );
    expect(button).toHaveFocus();
    fireEvent.click(button);
    expect(retry).toHaveBeenCalledTimes(1);
    view.rerender(
      <ApiCompatibilityMessage
        status="incompatible"
        retry={retry}
        busy={false}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      locale === "en"
        ? "contract is incompatible"
        : "contrato da API é incompatível",
    );
  },
);
