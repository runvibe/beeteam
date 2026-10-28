import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { ApiProvider } from "./api/context";
import { createHttpApi } from "./api/http";
import { runtimeConfig } from "./runtime";
async function start() {
  const api = runtimeConfig.mock
    ? (await import("./api/mock")).createMockApi()
    : createHttpApi({ baseUrl: runtimeConfig.apiBaseUrl });
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ApiProvider api={api}>
        <App />
      </ApiProvider>
    </StrictMode>,
  );
}
void start();
