import { appVersion } from "@/app-version";
import { useEffect, useRef, useState } from "react";
import { t, useLocale } from "@/i18n";
import { Button } from "@/components/ui/button";
import { isCanonicalVersion } from "@/api/version-policy";
import "./update.css";

export function PwaUpdate({ visible = true }: { visible?: boolean }) {
  useLocale();
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [availableVersion, setAvailableVersion] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [otherTabs, setOtherTabs] = useState(false);
  const pending = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
    let registration: ServiceWorkerRegistration | undefined;
    let disposed = false;
    let candidate: ServiceWorker | null = null;
    const inspect = (worker: ServiceWorker) => {
      if (candidate === worker) return;
      candidate = worker;
      setWaiting(worker);
      setAvailableVersion(null);
      worker.postMessage({ type: "GET_APP_VERSION" });
    };
    const found = () => {
      if (registration?.waiting && !disposed) inspect(registration.waiting);
      const installing = registration?.installing;
      installing?.addEventListener("statechange", () => {
        if (
          installing.state === "installed" &&
          registration?.waiting &&
          !disposed
        )
          inspect(registration.waiting);
      });
    };
    const onMessage = (event: MessageEvent) => {
      if (event.source === candidate && event.data?.type === "APP_UPDATE_VERSION" &&
        typeof event.data.version === "string" && isCanonicalVersion(event.data.version)) {
        setAvailableVersion(event.data.version);
      }
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
      <p>{t("common.updateVersionDetails", {
        current: appVersion,
        available: availableVersion ?? t("common.updateVersionChecking"),
      })}</p>
      <Button onClick={reload}>{t("common.pwaReload")}</Button>
      {otherTabs && <p role="status">{t("common.pwaOtherTabs")}</p>}
      {failed && <p role="status">{t("common.pwaUpdateFailed")}</p>}
    </section>
  );
}
