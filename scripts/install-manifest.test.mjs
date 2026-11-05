import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {validateManifest,verifyPublished} from './install-manifest.mjs';
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
