import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { ApiProvider } from "./api/context";
import { createMockApi } from "./api/mock";
const api = createMockApi();
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ApiProvider api={api}>
      <App />
    </ApiProvider>
  </StrictMode>,
);
