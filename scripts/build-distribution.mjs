// Build tooling only. The executable has no runtime Node or filesystem-assets dependency.
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {mkdirSync,cpSync,rmSync,realpathSync,existsSync,lstatSync} from 'node:fs';
import {resolve,sep} from 'node:path';
const root=fileURLToPath(new URL('..',import.meta.url));
const frontend=resolve(root,'frontend');
const staging=resolve(root,'.local','distribution','frontend');
const allowed=resolve(root,'.local','distribution')+sep;
if(!staging.startsWith(allowed))throw new Error('Invalid build staging directory');
mkdirSync(staging,{recursive:true});
if(realpathSync(staging)!==resolve(realpathSync(root),'.local','distribution','frontend'))throw new Error('Build staging must not traverse a symlink or junction');
const inputs=['src','public','scripts','package.json','package-lock.json','index.html','vite.config.ts','tsconfig.json','tsconfig.app.json','tsconfig.node.json'];
for(const name of inputs){const target=resolve(staging,name);if(!target.startsWith(staging+sep))throw new Error('Invalid build input');if(existsSync(target)&&lstatSync(target).isSymbolicLink())throw new Error('Build input must not be a symlink');rmSync(target,{recursive:true,force:true});cpSync(resolve(frontend,name),target,{recursive:true});}
function run(program,args,cwd,env=process.env){const result=spawnSync(program,args,{cwd,env,stdio:'inherit'});if(result.status!==0)process.exit(result.status??1);}
if(process.platform==='win32')run(process.env.ComSpec??'cmd.exe',['/d','/s','/c','npm ci --include=dev'],staging);
else run('npm',['ci','--include=dev'],staging);
run(process.execPath,['scripts/build-embedded.mjs'],staging);
run('cargo',['build','--locked','--release','--features','mcp,embedded-ui'],root,{...process.env,BEE_FRONTEND_DIST:resolve(staging,'dist')});
