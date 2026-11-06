import { useSiteLink } from "@/state/site-link";
import { createContext, useContext, type ReactNode, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { t, useLocale } from "@/i18n";
import { Button } from "@/components/ui/button";
import { createConsentStore } from "./consent-store";
import { createFrameClient } from "./frame-client";
import { usageEvent, type AnalyticsProduct } from "./events";
import "./consent.css";

function subscribeRoute(notify: () => void) {
  window.addEventListener("popstate", notify);
  window.addEventListener("beeteam:navigate", notify);
  return () => {
    window.removeEventListener("popstate", notify);
    window.removeEventListener("beeteam:navigate", notify);
  };
}

type ConsentStore = ReturnType<typeof createConsentStore>;
const ConsentContext = createContext<ConsentStore | null>(null);

export function CookiePreferences() {
  const store = useContext(ConsentContext);
  return store ? <PreferenceField store={store} /> : null;
}

function PreferenceField({ store }: { store: ConsentStore }) {
  useLocale();
  const choice = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  return (
    <section className="detail-section analytics-consent-options">
      <h3>{t("common.analyticsManage")}</h3>
      <label>
        <input type="checkbox" checked={choice === "accepted"}
          onChange={event => store.choose(event.currentTarget.checked ? "accepted" : "rejected")} />
        <span>{t("common.analyticsOptional")}</span>
      </label>
      <p className="small-note">{t("common.analyticsStorage")}</p>
    </section>
  );
}

export function AnalyticsConsent({ product, path, children, legalReady = false }: {
  product: AnalyticsProduct;
  path?: string;
  children?: ReactNode;
  legalReady?: boolean;
}) {
  const language = useLocale();
  const store = useMemo(() => createConsentStore(typeof window === "undefined" ? undefined : window), []);
  const choice = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const pathname = useSyncExternalStore(subscribeRoute, () => location.pathname, () => "/");
  const client = useRef<ReturnType<typeof createFrameClient> | null>(null);
  const [manage, setManage] = useState(false);
  const [draft, setDraft] = useState(false);
  const titleId = useId();
  const checkboxId = useId();
  const prefix = language === "pt-BR" ? "/pt" : "";
  const siteLink = useSiteLink();
  const legalLink = (path: string) => product === "app" ? siteLink(path) : path;
  useEffect(() => setDraft(choice === "accepted"), [choice]);
  useEffect(() => {
    const frame = createFrameClient(product, window, document, t("common.analyticsFrameTitle"));
    client.current = frame;
    frame.setView(usageEvent(product, path ?? location.pathname, language, location.hostname));
    const update = () => frame.setConsent(legalReady && store.getSnapshot() === "accepted");
    const unsubscribe = store.subscribe(update);
    update();
    return () => { unsubscribe(); frame.dispose(); client.current = null; };
  }, [product, store, legalReady]);
  useEffect(() => {
    client.current?.setView(usageEvent(product, path ?? pathname, language, location.hostname));
  }, [product, path, pathname, language]);
  function choose(accepted: boolean) {
    store.choose(accepted ? "accepted" : "rejected");
    setManage(false);
  }
  return (
    <ConsentContext.Provider value={legalReady ? store : null}>
      {children}
      {legalReady && choice === "unknown" && (
    <section className="analytics-consent" aria-labelledby={titleId}>
      <h2 id={titleId}>{t("common.analyticsTitle")}</h2>
      <p>{t("common.analyticsDescription")}</p>
      {manage && <div className="analytics-consent-options">
        <label htmlFor={checkboxId}>
          <input id={checkboxId} type="checkbox" checked={draft} onChange={(event) => setDraft(event.currentTarget.checked)} />
          <span>{t("common.analyticsOptional")}</span>
        </label>
        <p>{t("common.analyticsStorage")}</p>
        {!store.isPersistent() && <p role="status">{t("common.analyticsSessionOnly")}</p>}
      </div>}
      {legalReady && <nav className="analytics-consent-legal" aria-label={t("common.analyticsLegal")}>
        <a href={legalLink(`${prefix}/privacy`)} target="_blank" rel="noopener noreferrer">{t("common.analyticsPrivacy")}</a>
        <a href={legalLink(`${prefix}/terms`)} target="_blank" rel="noopener noreferrer">{t("common.analyticsTerms")}</a>
      </nav>}
      <div className="analytics-consent-actions">
        {manage ? <>
          <Button onClick={() => choose(draft)}>{t("common.analyticsSave")}</Button>
          <Button variant="ghost" onClick={() => setManage(false)}>{t("common.analyticsClose")}</Button>
        </> : <>
          <Button onClick={() => choose(true)}>{t("common.analyticsAccept")}</Button>
          <Button variant="outline" onClick={() => choose(false)}>{t("common.analyticsReject")}</Button>
          <Button variant="ghost" onClick={() => setManage(true)}>{t("common.analyticsManage")}</Button>
        </>}
      </div>
    </section>
      )}
    </ConsentContext.Provider>
  );
}
