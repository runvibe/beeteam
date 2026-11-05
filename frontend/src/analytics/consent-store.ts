export type ConsentChoice = "unknown" | "accepted" | "rejected";
export const consentKey = "beeteam.privacy.consent.v1";

function readChoice(value: string | null): ConsentChoice {
  try {
    const data = JSON.parse(value ?? "null");
    return data?.version === 1 &&
      Object.keys(data).length === 2 &&
      ["accepted", "rejected"].includes(data.analytics)
      ? data.analytics
      : "unknown";
  } catch {
    return "unknown";
  }
}

export function clearAnalyticsCookies(doc: Document, hostname: string) {
  try {
    const names = doc.cookie.split(";").map((entry) => entry.trim().split("=")[0])
      .filter((name) => /^(?:_ga|beeteam_ga)(?:_|$)/.test(name));
    const domains = ["", `;Domain=${hostname}`];
    const labels = hostname.split(".");
    while (labels.length >= 2) {
      domains.push(`;Domain=.${labels.join(".")}`);
      labels.shift();
    }
    for (const name of names) for (const path of ["/", "/app", "/app/", "/analytics", "/app/analytics"])
      for (const domain of domains)
        doc.cookie = `${name}=;Max-Age=0;Path=${path}${domain};SameSite=Lax`;
  } catch {
    // Cookie access can be unavailable in privacy modes; core use still works.
  }
}

export function createConsentStore(browser?: Window) {
  let state: ConsentChoice = "unknown";
  let persistent = true;
  const listeners = new Set<() => void>();
  try {
    state = readChoice(browser?.localStorage.getItem(consentKey) ?? null);
  } catch {
    persistent = false;
  }
  function update(next: ConsentChoice) {
    state = next;
    if (browser && next !== "accepted") clearAnalyticsCookies(browser.document, browser.location.hostname);
    listeners.forEach((notify) => notify());
  }
  const storage = (event: StorageEvent) => {
    if (event.key === consentKey || event.key === null) update(readChoice(event.newValue));
  };
  return {
    getSnapshot: () => state,
    getServerSnapshot: (): ConsentChoice => "unknown",
    isPersistent: () => persistent,
    subscribe: (notify: () => void) => {
      if (!listeners.size) browser?.addEventListener("storage", storage);
      listeners.add(notify);
      return () => {
        listeners.delete(notify);
        if (!listeners.size) browser?.removeEventListener("storage", storage);
      };
    },
    choose(next: Exclude<ConsentChoice, "unknown">) {
      try {
        browser?.localStorage.setItem(consentKey, JSON.stringify({ version: 1, analytics: next }));
      } catch {
        persistent = false;
      }
      update(next);
    },
  };
}
