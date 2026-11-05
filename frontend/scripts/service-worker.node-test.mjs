import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";
import test from "node:test";

function worker() {
  const events = {};
  const cache = new Map();
  const precache = ["/app/", "/app/assets/main.js", "/app/theme-init.js"];
  const context = {
    URL, Set, console,
    fetch: async request => ({network:request}),
    caches: {
      open: async () => ({
        addAll: async names => { for (const name of names) cache.set(name,{cached:name}); },
        match: async name => cache.get(name),
      }),
      match: async name => cache.get(name),
      keys: async () => [],
    },
    self: {
      location: { origin:"https://getbee.team" },
      clients: { matchAll: async()=>[], claim:async()=>{} },
      addEventListener: (name,callback) => { events[name]=callback; },
      skipWaiting:()=>{context.activated=true},
    },
  };
  const source = readFileSync(new URL("./service-worker.js",import.meta.url),"utf8")
    .replace("__CACHE_VERSION__","test").replace("__PRECACHE__",JSON.stringify(precache));
  vm.runInNewContext(source,context);
  return {events,context};
}

test("excludes API, MCP, streaming, public-site HTML and manifest traffic in a controlled app tab",()=>{
  const {events}=worker();
  for(const path of ["/api/v2/tasks","/mcp","/guide/","/","/install.json","/app/sw.js","/app/assets/main.js?stream=1"]){
    let handled=false;
    events.fetch({request:{url:"https://getbee.team"+path,method:"GET",mode:"cors"},respondWith(){handled=true}});
    assert.equal(handled,false,path);
  }
  let handled=false;
  events.fetch({request:{url:"https://getbee.team/app/assets/main.js",method:"POST",mode:"cors"},respondWith(){handled=true}});
  assert.equal(handled,false);
});

test("stages the shell and only activates an update after explicit instruction",async()=>{
  const {events,context}=worker();
  let install;
  events.install({waitUntil(value){install=value}});
  await install;
  assert.equal(context.activated,undefined);
  let activation;
  events.message({data:{type:"ACTIVATE_APP_UPDATE"},waitUntil(value){activation=value}});
  await activation;
  assert.equal(context.activated,true);
  let response;
  events.fetch({request:{url:"https://getbee.team/app/assets/main.js",method:"GET",mode:"cors"},respondWith(value){response=value}});
  assert.equal((await response).cached,"/app/assets/main.js");
});

test("keeps the waiting worker and old tabs intact when another app tab is open",async()=>{
  const {events,context}=worker();
  context.self.clients.matchAll=async()=>[{url:"https://getbee.team/app/"},{url:"https://getbee.team/app/boards"}];
  let work,message;
  events.message({data:{type:"ACTIVATE_APP_UPDATE"},source:{postMessage(value){message=value}},waitUntil(value){work=value}});
  await work;
  assert.equal(context.activated,undefined);
  assert.equal(message.type,"APP_UPDATE_OTHER_TABS");
});
