import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const stable=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
export function validateManifest(value) {
  if(value.schemaVersion!==1||!stable.test(value.appVersion)||value.channel!=='stable')throw Error('Unsupported schema/version/channel');
  const skills=value.skills;
  if(!skills||!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/.test(skills.repository)||skills.ref!==`v${value.appVersion}`||skills.path!=='skills')throw Error('Invalid Skills origin');
  if(JSON.stringify([...skills.names].sort())!==JSON.stringify(['get-a-team-lead','get-a-worker','setup-bee-team']))throw Error('Invalid Skills names');
  if(!Array.isArray(value.artifacts)||!value.artifacts.length)throw Error('No published artifacts');
  const pairs=new Set();
  for(const item of value.artifacts) {
    if(!['windows','linux','macos'].includes(item.os)||!['x64','arm64'].includes(item.arch))throw Error('Unsupported platform');
    const format=item.os==='windows'?'zip':'tar.gz';
    const name=`beeteam-${value.appVersion}-${item.os}-${item.arch}.${format}`;
    if(item.format!==format||item.fileName!==name||item.url!==`${skills.repository}/releases/download/${skills.ref}/${name}`)throw Error('Invalid artifact origin/layout');
    if(!/^[0-9a-f]{64}$/.test(item.sha256)||!Number.isSafeInteger(item.size)||item.size<1)throw Error('Invalid integrity metadata');
    const pair=`${item.os}/${item.arch}`;
    if(pairs.has(pair))throw Error('Duplicate platform');
    pairs.add(pair);
  }
  return value;
}
export async function verifyPublished(value,fetcher=fetch) {
  validateManifest(value);
  const get=async url=>{
    const response=await fetcher(url,{signal:AbortSignal.timeout(120000),headers:{'User-Agent':'Get-Bee-Team-release-verifier'}});
    if(!response.ok)throw Error(`Published resource unavailable: ${response.status} ${url}`);
    return response;
  };
  const repo=value.skills.repository.replace('https://github.com/','');
  await get(`https://api.github.com/repos/${repo}/git/ref/tags/${value.skills.ref}`);
  for(const name of value.skills.names)await get(`https://raw.githubusercontent.com/${repo}/${value.skills.ref}/skills/${name}/SKILL.md`);
  for(const item of value.artifacts) {
    const response=await get(item.url), hash=createHash('sha256');let size=0;
    for await(const chunk of response.body){size+=chunk.byteLength;if(size>item.size)throw Error('Artifact exceeds declared size');hash.update(chunk);}
    if(size!==item.size||hash.digest('hex')!==item.sha256)throw Error('Published artifact checksum/size mismatch');
  }
  return value;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const [input,output]=process.argv.slice(2);
  if(!input||!output)throw Error('Usage: node scripts/install-manifest.mjs candidate.json output/install.json');
  const value=JSON.parse(readFileSync(input,'utf8'));
  const version=readFileSync('Cargo.toml','utf8').match(/^version\s*=\s*"([^"]+)"/m)?.[1];
  if(value.appVersion!==version)throw Error('Site/Cargo/release version mismatch');
  await verifyPublished(value);
  writeFileSync(output,JSON.stringify(value,null,2)+'\n');
}
