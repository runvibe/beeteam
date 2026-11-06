export function shouldOfferDesktop(url: URL, installedPwa: boolean) {
  return url.hostname === "getbee.team" && /^\/app\/?$/.test(url.pathname)
    && !url.search && !url.hash && !installedPwa;
}

export function DesktopEntry() {
  const pt = navigator.language.toLowerCase().startsWith("pt");
  return <main className="desktop-entry" lang={pt ? "pt" : "en"}>
    <img src="/app/icons/bee-192.png" width="64" height="64" alt="" />
    <h1>Bee Team</h1>
    <a href="beeteam://open">{pt ? "Abrir Bee Team Desktop" : "Open Bee Team Desktop"}</a>
    <a href="/app/?web=1">{pt ? "Continuar no navegador" : "Continue on the web"}</a>
    <a href={pt ? "/pt/guide/" : "/guide/"}>{pt ? "Ajuda para instalação" : "Installation help"}</a>
  </main>;
}

