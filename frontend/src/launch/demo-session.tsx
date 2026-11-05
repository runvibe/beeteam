import { useState } from "react";
import App from "@/App";
import { ApiProvider } from "@/api/context";
import { DemoContext } from "@/components/demo-context";
import { Button } from "@/components/ui/button";
import { createDemoApi } from "@/api/demo";
import { t, useLocale } from "@/i18n";
import { navigate, useLocation, safeOrigin } from "@/routing/location";

export default function DemoSession() {
  useLocale();
  const [api] = useState(createDemoApi);
  const url = useLocation();
  const leave = () => {
    const requested = new URLSearchParams(url.split("?")[1]).get("returnTo");
    const destination = new URL(safeOrigin(requested) ?? "/", location.origin);
    destination.searchParams.set("demo", "0");
    navigate(destination.pathname + destination.search);
  };
  return (
    <DemoContext.Provider value={true}>
      <ApiProvider api={api}>
        <div className="demo-session">
          <div className="demo-banner">
            <p>{t("common.demoBanner")}</p>
            <Button size="sm" variant="outline" onClick={leave}>
              {t("common.demoConnectLocal")}
            </Button>
          </div>
          {location.pathname.endsWith("/settings") ? (
            <main className="api-version-gate">
              <section className="api-version-card">
                <h1>{t("common.demoReadonly")}</h1>
                <Button onClick={() => navigate("/boards?demo=1")}>
                  {t("common.launchExploreDemo")}
                </Button>
              </section>
            </main>
          ) : (
            <App />
          )}
        </div>
      </ApiProvider>
    </DemoContext.Provider>
  );
}
