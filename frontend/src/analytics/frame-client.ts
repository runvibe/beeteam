import { clearAnalyticsCookies } from "./consent-store";
import { isUsageEvent, type AnalyticsProduct, type UsageEvent } from "./events";

export function createFrameClient(product: AnalyticsProduct, browser: Window, doc: Document, frameLabel = "") {
  let frame: HTMLIFrameElement | null = null;
  let nonce = "";
  let initialized = false;
  let initSent = false;
  let revoking = false;
  let removalTimer: number | undefined;
  let view: UsageEvent | null = null;
  // A separate origin prevents the Google tag from inspecting the app's DOM or
  // history. Third-party-cookie blocking is respected without a fallback bypass.
  const frameOrigin = "https://metrics.getbee.team";
  function send(event: UsageEvent) {
    if (frame && initialized) frame.contentWindow?.postMessage({ type: "bee-analytics-event", nonce, event }, frameOrigin);
  }
  const message = (event: MessageEvent) => {
    if (!frame || event.source !== frame.contentWindow || event.origin !== frameOrigin || !event.data || typeof event.data !== "object") return;
    if (revoking) {
      if (event.data.type === "bee-analytics-revoked" && Object.keys(event.data).length === 2 && event.data.nonce === nonce) stop();
      return;
    }
    if (event.data.type === "bee-analytics-ready" && Object.keys(event.data).length === 1) {
      initSent = true;
      frame.contentWindow?.postMessage({ type: "bee-analytics-init", nonce, product, consent: "granted" }, frameOrigin);
    } else if (event.data.type === "bee-analytics-initialized" && Object.keys(event.data).length === 2 && event.data.nonce === nonce && !initialized) {
      initialized = true;
      if (view) { send({ ...view, name: "ui_open" }); send(view); }
    }
  };
  function stop() {
    if (removalTimer !== undefined) browser.clearTimeout(removalTimer);
    removalTimer = undefined;
    browser.removeEventListener("message", message);
    frame?.remove();
    frame = null;
    initialized = false;
    initSent = false;
    revoking = false;
    nonce = "";
    clearAnalyticsCookies(doc, browser.location.hostname);
  }
  return {
    frameOrigin,
    setView(next: UsageEvent) {
      if (!isUsageEvent(next) || next.product !== product) return;
      if (JSON.stringify(next) === JSON.stringify(view)) return;
      view = next;
      send(next);
    },
    setConsent(accepted: boolean) {
      if (!accepted) {
        if (frame && initSent && !revoking) {
          initialized = false;
          revoking = true;
          frame.contentWindow?.postMessage({ type: "bee-analytics-revoke", nonce }, frameOrigin);
          // If privacy extensions block the frame, teardown still cannot gate UI.
          removalTimer = browser.setTimeout(stop, 500);
        } else if (!revoking) stop();
        return;
      }
      if (revoking) stop();
      if (frame) return;
      nonce = browser.crypto.randomUUID();
      frame = doc.createElement("iframe");
      frame.dataset.beeAnalytics = "true";
      frame.hidden = true;
      frame.title = frameLabel;
      frame.referrerPolicy = "no-referrer";
      frame.setAttribute("sandbox", "allow-scripts allow-same-origin");
      frame.src = `${frameOrigin}/analytics/frame.html`;
      browser.addEventListener("message", message);
      doc.body.append(frame);
    },
    dispose: stop,
  };
}
