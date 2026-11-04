import { expect, it, vi } from "vitest";
import { openDetails, closeDetails } from "./details-view";
import { navigate } from "./location";
it.each(["agent", "team"])(
  "returns to the original %s entry after opening and closing settings",
  (kind) => {
    const plural = kind === "agent" ? "agents" : "teams";
    window.history.replaceState(
      { bee: true, index: 3, returnUrl: `/${plural}` },
      "",
      `/${plural}/example?from=/${plural}`,
    );
    openDetails(`${kind}.view`);
    navigate(`/${plural}/example/settings${location.search}`);
    navigate(`/${plural}/example${location.search}`, true);
    const go = vi.spyOn(window.history, "go").mockImplementation(() => {});
    closeDetails(`${kind}.view`);
    expect(go).toHaveBeenCalledWith(-2);
    go.mockRestore();
  },
);
