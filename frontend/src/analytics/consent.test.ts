import { describe, it, expect, vi } from "vitest";
import { createConsentStore, consentKey } from "./consent-store";
import { usageEvent, isUsageEvent } from "./events";
import { createFrameClient } from "./frame-client";

describe("analytics consent", () => {
 it("starts unknown, saves explicit choices and persists rejection", () => {
  localStorage.removeItem(consentKey);
  const store=createConsentStore(window);
  expect(store.getSnapshot()).toBe("unknown");
  store.choose("rejected");
  expect(createConsentStore(window).getSnapshot()).toBe("rejected");
  store.choose("accepted");
  expect(createConsentStore(window).getSnapshot()).toBe("accepted");
 });
 it("continues in memory when browser storage is denied", () => {
  const get=vi.spyOn(Storage.prototype,"getItem").mockImplementation(()=>{throw new Error("denied")});
  const set=vi.spyOn(Storage.prototype,"setItem").mockImplementation(()=>{throw new Error("denied")});
  const store=createConsentStore(window);
  expect(()=>store.choose("accepted")).not.toThrow();
  expect(store.getSnapshot()).toBe("accepted");
  expect(createConsentStore(window).getSnapshot()).toBe("unknown");
  get.mockRestore();set.mockRestore();
 });
 it("applies cross-tab withdrawal and clears legacy analytics cookies", () => {
  localStorage.removeItem(consentKey);
  const store=createConsentStore(window);const change=vi.fn();const stop=store.subscribe(change);
  store.choose("accepted");document.cookie="_ga=old;path=/";
  window.dispatchEvent(new StorageEvent("storage",{key:consentKey,newValue:JSON.stringify({version:1,analytics:"rejected"})}));
  expect(store.getSnapshot()).toBe("rejected");expect(document.cookie).not.toContain("_ga=");
  stop();
 });
});
it("only produces closed usage fields without URL or user content",()=>{
 const event=usageEvent("app","/app/tasks/private-client-slug?token=secret#private-title","pt-BR","localhost");
 expect(event).toEqual({name:"screen_view",product:"app",mode:"local",language:"pt",area:"tasks"});
 expect(JSON.stringify(event)).not.toMatch(/private|secret|token|localhost/);
 expect(usageEvent("site","/pt/guide/reference/environment?name=secret","pt-BR","getbee.team").area).toBe("guide_reference");
});
it("creates no frame before opt-in, handshakes strictly and destroys it on revocation",()=>{
 const client=createFrameClient("app",window,document);
 client.setView(usageEvent("app","/app/tasks/private-slug","en-US","getbee.team"));
 expect(document.querySelector("iframe[data-bee-analytics]")).toBeNull();
 client.setConsent(false);expect(document.querySelector("iframe[data-bee-analytics]")).toBeNull();
 client.setConsent(true);
 const frame=document.querySelector<HTMLIFrameElement>("iframe[data-bee-analytics]")!;
 expect(frame.referrerPolicy).toBe("no-referrer");expect(frame.src).not.toMatch(/private|\?/);
 const post=vi.spyOn(frame.contentWindow!,"postMessage");
 window.dispatchEvent(new MessageEvent("message",{source:window,origin:location.origin,data:{type:"bee-analytics-ready"}}));
 expect(post).not.toHaveBeenCalled();
 window.dispatchEvent(new MessageEvent("message",{source:frame.contentWindow,origin:"https://evil.test",data:{type:"bee-analytics-ready"}}));
 expect(post).not.toHaveBeenCalled();
 window.dispatchEvent(new MessageEvent("message",{source:frame.contentWindow,origin:client.frameOrigin,data:{type:"bee-analytics-ready"}}));
 expect(post).toHaveBeenCalled();
 const init=post.mock.calls.at(-1)![0];
 window.dispatchEvent(new MessageEvent("message",{source:frame.contentWindow,origin:client.frameOrigin,data:{type:"bee-analytics-initialized",nonce:init.nonce}}));
 expect(post.mock.calls.some(([data])=>data.type==="bee-analytics-event")).toBe(true);
 expect(JSON.stringify(post.mock.calls)).not.toMatch(/private-slug/);
 client.setConsent(false);
 expect(post.mock.calls.at(-1)![0].type).toBe("bee-analytics-revoke");
 window.dispatchEvent(new MessageEvent("message",{source:frame.contentWindow,origin:client.frameOrigin,data:{type:"bee-analytics-revoked",nonce:init.nonce}}));
 expect(document.querySelector("iframe[data-bee-analytics]")).toBeNull();
 client.dispose();
});

it("rejects extra fields, nested payloads and wrong nonce before forwarding",()=>{
 const event=usageEvent("app","/app/tasks/private-title","en-US","getbee.team");
 expect(isUsageEvent({...event,title:"private"})).toBe(false);
 expect(isUsageEvent({...event,name:{toString:()=>"screen_view",title:"private"}})).toBe(false);
 const client=createFrameClient("app",window,document);client.setConsent(true);
 const frame=document.querySelector<HTMLIFrameElement>("iframe[data-bee-analytics]")!;
 const post=vi.spyOn(frame.contentWindow!,"postMessage");
 window.dispatchEvent(new MessageEvent("message",{source:frame.contentWindow,origin:client.frameOrigin,data:{type:"bee-analytics-initialized",nonce:"incorrect"}}));
 client.setView({...event,title:"private"} as never);expect(post).not.toHaveBeenCalled();
 client.dispose();
});
it("tears down a blocked revocation and applies cross-tab acceptance/invalid preference safely",()=>{
 vi.useFakeTimers();
 try {
  localStorage.removeItem(consentKey);const store=createConsentStore(window);const client=createFrameClient("app",window,document);
  const stop=store.subscribe(()=>client.setConsent(store.getSnapshot()==="accepted"));
  window.dispatchEvent(new StorageEvent("storage",{key:consentKey,newValue:JSON.stringify({version:1,analytics:"accepted"})}));
  const frame=document.querySelector<HTMLIFrameElement>("iframe[data-bee-analytics]")!;
  const post=vi.spyOn(frame.contentWindow!,"postMessage");
  window.dispatchEvent(new MessageEvent("message",{source:frame.contentWindow,origin:client.frameOrigin,data:{type:"bee-analytics-ready"}}));
  expect(post).toHaveBeenCalled();
  window.dispatchEvent(new StorageEvent("storage",{key:consentKey,newValue:"invalid"}));
  expect(store.getSnapshot()).toBe("unknown");vi.advanceTimersByTime(501);
  expect(document.querySelector("iframe[data-bee-analytics]")).toBeNull();stop();client.dispose();
 } finally {vi.useRealTimers();}
});
