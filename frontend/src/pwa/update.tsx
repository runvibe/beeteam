import { useEffect, useRef, useState } from "react";
import { t, useLocale } from "@/i18n";
import { Button } from "@/components/ui/button";
import "./update.css";

export function PwaUpdate({ visible = true }: { visible?: boolean }) {
  useLocale();
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [failed, setFailed] = useState(false);
  const [otherTabs, setOtherTabs] = useState(false);
  const pending = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    let registration: ServiceWorkerRegistration | undefined;
    let disposed = false;
    const found = () => {
      if (registration?.waiting && !disposed) setWaiting(registration.waiting);
      const installing = registration?.installing;
      installing?.addEventListener("statechange", () => {
        if (
          installing.state === "installed" &&
          registration?.waiting &&
          !disposed
        )
          setWaiting(registration.waiting);
      });
    };
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "APP_UPDATE_OTHER_TABS") {
        pending.current?.();
        setOtherTabs(true);
      }
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    void navigator.serviceWorker
      .register("/app/sw.js", { scope: "/app/", updateViaCache: "none" })
      .then((value) => {
        registration = value;
        found();
        value.addEventListener("updatefound", found);
      })
      .catch(() => {
        /* The online app remains available when installation is unavailable. */
      });
    return () => {
      disposed = true;
      pending.current?.();
      registration?.removeEventListener("updatefound", found);
      navigator.serviceWorker.removeEventListener("message", onMessage);
    };
  }, []);
  function reload() {
    if (!waiting) return;
    pending.current?.();
    if (waiting.state === "activated") {
      location.reload();
      return;
    }
    setFailed(false);
    setOtherTabs(false);
    const onController = () => {
      cleanup();
      location.reload();
    };
    const timer = setTimeout(() => {
      cleanup();
      setFailed(true);
    }, 10000);
    const cleanup = () => {
      clearTimeout(timer);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onController,
      );
    };
    pending.current = cleanup;
    navigator.serviceWorker.addEventListener("controllerchange", onController);
    waiting.postMessage({ type: "ACTIVATE_APP_UPDATE" });
  }
  if (!visible || !waiting) return null;
  return (
    <section className="pwa-update" aria-label={t("common.pwaUpdateTitle")}>
      <p>{t("common.pwaUpdateBody")}</p>
      <Button onClick={reload}>{t("common.pwaReload")}</Button>
      {otherTabs && <p role="status">{t("common.pwaOtherTabs")}</p>}
      {failed && <p role="status">{t("common.pwaUpdateFailed")}</p>}
    </section>
  );
}
