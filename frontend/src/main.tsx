import { DesktopEntry, shouldOfferDesktop } from "./launch/desktop-entry";
import { AnalyticsConsent } from "./analytics/consent-controls";
import { createChangeSource } from "./api/change-source";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { ApiProvider } from "./api/context";
import { createHttpApi } from "./api/http";
import { runtimeConfig } from "./runtime";
import { appVersion } from "./app-version";
import { LaunchRoot } from "./launch/launch-root";
import { canonicalizeEntry } from "./routing/location";
import { PwaUpdate } from "./pwa/update";
async function start() {
  if (shouldOfferDesktop(new URL(location.href), matchMedia("(display-mode: standalone)").matches)) {
    createRoot(document.getElementById("root")!).render(<DesktopEntry />);
    return;
  }
  canonicalizeEntry();
  const api = runtimeConfig.mock
    ? (await import("./api/mock")).createMockApi()
    : createHttpApi({
        baseUrl: runtimeConfig.apiBaseUrl,
        expectedAppVersion: appVersion,
      });
  const changes = runtimeConfig.mock
    ? undefined
    : createChangeSource(runtimeConfig.apiBaseUrl);
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <AnalyticsConsent product="app" legalReady>
      {runtimeConfig.mock ? (
        <ApiProvider api={api}>
          <PwaUpdate />
          <App />
        </ApiProvider>
      ) : (
        <LaunchRoot api={api} changes={changes} />
      )}
      </AnalyticsConsent>
    </StrictMode>,
  );
}
void start();
