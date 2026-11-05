import { startTheme } from "./theme";
import { useEffect } from "react";
import { Landing } from "./launch/landing";
import { Guide } from "./Guide";
import { configureLocale } from "./i18n";
import "./index.css";
import "./App.css";
import "./operations.css";
export function Page({ path }: { path: string }) {
  configureLocale(path);
  useEffect(() => {
    startTheme();
    document.documentElement.dataset.siteHydrated = "true";
  }, []);
  return path.replace(/^\/pt(?=\/|$)/, "") === "/" ? (
    <Landing />
  ) : (
    <Guide path={path} />
  );
}
