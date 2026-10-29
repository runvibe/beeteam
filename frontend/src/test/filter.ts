import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
export async function openSearch(label: string) {
  await userEvent.click(
    await screen.findByRole("button", { name: label }),
  );
  return screen.findByRole("searchbox", { name: label });
}
