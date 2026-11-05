import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {validateManifest,verifyPublished} from './install-manifest.mjs';
import worker from '../deploy/site/worker.mjs';
const bytes=new TextEncoder().encode('published test archive');
function manifest(){return {schemaVersion:1,appVersion:'0.1.0',channel:'stable',artifacts:[{os:'windows',arch:'x64',format:'zip',fileName:'beeteam-0.1.0-windows-x64.zip',url:'https://github.com/runvibe/beeteam/releases/download/v0.1.0/beeteam-0.1.0-windows-x64.zip',sha256:createHash('sha256').update(bytes).digest('hex'),size:bytes.length}],skills:{repository:'https://github.com/runvibe/beeteam',ref:'v0.1.0',path:'skills',names:['setup-bee-team','get-a-team-lead','get-a-worker']}};}
test('shared contract verifies actual published bytes and Skills ref/files',async()=>{
 const urls=[];const value=manifest();
 assert.equal(await verifyPublished(value,async url=>{urls.push(url);return new Response(url.includes('/releases/')?bytes:'ok');}),value);
 assert.equal(urls.length,5);
});
test('unavailable ref, corrupt archive and wrong size prevent promotion',async()=>{
 await assert.rejects(verifyPublished(manifest(),async()=>new Response(null,{status:404})),/unavailable/);
 await assert.rejects(verifyPublished(manifest(),async url=>new Response(url.includes('/releases/')?'corrupt':'ok')),/checksum|size/);
});
test('rejects prerelease, arbitrary URL, duplicate platform and bad Skills origin',()=>{
 for(const change of [v=>v.appVersion='0.2.0-beta',v=>v.artifacts[0].url='https://evil.invalid/file',v=>v.artifacts.push(v.artifacts[0]),v=>v.skills.ref='main']){
  const v=manifest();change(v);assert.throws(()=>validateManifest(v));
 }
});
const env={ASSETS:{fetch:async req=>{
 const p=new URL(req.url).pathname;
 if(p==='/index.html')return new Response('<html>panel</html>',{headers:{'content-type':'text/html'}});
 if(p==='/install.json')return Response.json(manifest());
 if(p==='/assets/app-12345678.js')return new Response('script');
 return new Response(null,{status:404});
}}};
test('Worker keeps deep links, protocol errors, assets and manifest distinct',async()=>{
 for(const [path,status] of [['/tasks/example',200],['/app/',200],['/app/tasks/example',200],['/app/assets/missing.js',404],['/api/v1/info',404],['/mcp',404],['/assets/missing.js',404],['/install.json',200]]){
  const r=await worker.fetch(new Request('https://site.test'+path),env);assert.equal(r.status,status,path);
 }
 assert.match((await worker.fetch(new Request('https://site.test/install.json'),env)).headers.get('cache-control'),/max-age=60/);
 assert.match((await worker.fetch(new Request('https://site.test/assets/app-12345678.js'),env)).headers.get('cache-control'),/immutable/);
});
test('missing manifest cannot fall back to HTML; HEAD and methods are explicit',async()=>{
 const html={ASSETS:{fetch:async()=>new Response('<html/>',{headers:{'content-type':'text/html'}})}};
 assert.equal((await worker.fetch(new Request('https://site.test/install.json'),html)).status,404);
 assert.equal(await (await worker.fetch(new Request('https://site.test/tasks/a',{method:'HEAD'}),env)).text(),'');
 assert.equal((await worker.fetch(new Request('https://site.test/',{method:'POST'}),env)).status,405);
});

test('installation guide serves static instructions to clients without JavaScript',async()=>{
 const guide={ASSETS:{async fetch(request){
   assert.equal(new URL(request.url).pathname,'/install/index.html');
   return new Response('Install Bee Team',{headers:{'Content-Type':'text/html'}});
 }}};
 for(const path of ['/install','/install/']){
   const response=await worker.fetch(new Request('https://getbee.team'+path),guide);
   assert.equal(await response.text(),'Install Bee Team');
 }
});
