import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
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

export function AnalyticsConsent({ product, path, legalReady = false }: {
  product: AnalyticsProduct;
  path?: string;
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
  const legalOrigin = product === "app" ? "https://getbee.team" : "";
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
  if (!legalReady) return null;
  if (choice !== "unknown" && !manage) return (
    <div className="analytics-preferences-trigger">
      <Button variant="outline" size="sm" onClick={() => { setDraft(choice === "accepted"); setManage(true); }}>
        {t("common.analyticsManage")}
      </Button>
    </div>
  );
  return (
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
        <a href={`${legalOrigin}${prefix}/privacy`} target="_blank" rel="noopener noreferrer">{t("common.analyticsPrivacy")}</a>
        <a href={`${legalOrigin}${prefix}/terms`} target="_blank" rel="noopener noreferrer">{t("common.analyticsTerms")}</a>
      </nav>}
      <div className="analytics-consent-actions">
        {manage ? <>
          <Button onClick={() => choose(draft)}>{t("common.analyticsSave")}</Button>
          {choice === "accepted" && <Button variant="outline" onClick={() => choose(false)}>{t("common.analyticsWithdraw")}</Button>}
          <Button variant="ghost" onClick={() => setManage(false)}>{t("common.analyticsClose")}</Button>
        </> : <>
          <Button onClick={() => choose(true)}>{t("common.analyticsAccept")}</Button>
          <Button variant="outline" onClick={() => choose(false)}>{t("common.analyticsReject")}</Button>
          <Button variant="ghost" onClick={() => setManage(true)}>{t("common.analyticsManage")}</Button>
        </>}
      </div>
    </section>
  );
}
