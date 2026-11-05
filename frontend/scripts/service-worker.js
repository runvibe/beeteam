/* Generated with a closed build-time allowlist. Application data is network-only. */
const CACHE = "beeteam-app-__CACHE_VERSION__";
const PRECACHE = __PRECACHE__;
const APP_VERSION = __APP_VERSION__;
const ALLOWED = new Set(PRECACHE);
self.addEventListener("install", event => {
  event.waitUntil((async()=>{
    const cache = await caches.open(CACHE);
    try { await cache.addAll(PRECACHE); }
    catch(error) { await caches.delete(CACHE); throw error; }
  })());
});
self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    // A user-initiated update is admitted only after the other app tabs close.
    const windows = await self.clients.matchAll({type:"window",includeUncontrolled:true});
    if(windows.filter(client=>new URL(client.url).pathname.startsWith("/app/")).length<=1) {
      for(const name of await caches.keys()) if(name.startsWith("beeteam-app-")&&name!==CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});
self.addEventListener("message",event=>{
  if(event.data?.type==="GET_APP_VERSION") {
    event.source?.postMessage({type:"APP_UPDATE_VERSION",version:APP_VERSION});
    return;
  }
  if(event.data?.type!=="ACTIVATE_APP_UPDATE") return;
  event.waitUntil((async()=>{
    const windows=await self.clients.matchAll({type:"window",includeUncontrolled:true});
    const tabs=windows.filter(client=>new URL(client.url).pathname.startsWith("/app/"));
    if(tabs.length>1) {
      event.source?.postMessage({type:"APP_UPDATE_OTHER_TABS"});
      return;
    }
    await self.skipWaiting();
  })());
});
self.addEventListener("fetch",event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=="GET"||url.origin!==self.location.origin) return;
  const navigation=request.mode==="navigate"&&url.pathname.startsWith("/app/")&&!url.pathname.includes(".");
  const asset=ALLOWED.has(url.pathname)&&url.pathname!=="/app/"&&!url.search;
  if(!navigation&&!asset) return;
  event.respondWith((async()=>{
    if(navigation) {
      try { return await fetch(request); }
      catch {
        return await caches.match("/app/",{cacheName:CACHE}) ||
          new Response("Bee Team offline. Reconecte para carregar o app. Reconnect to load the app.",{status:503,headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"}});
      }
    }
    const cache=await caches.open(CACHE);
    const stored=await cache.match(url.pathname);
    return stored || fetch(request);
  })());
});
