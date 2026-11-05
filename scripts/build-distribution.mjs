// Build tooling only. The executable has no runtime Node or filesystem-assets dependency.
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {mkdirSync,cpSync,rmSync,realpathSync,existsSync,lstatSync} from 'node:fs';
import {resolve,sep,dirname} from 'node:path';
import {frontendInputs,externalInputs,sourceHash} from '../frontend/scripts/build-inputs.mjs';

export function stageFrontend(root) {
  root=realpathSync(root);
  const frontend=resolve(root,'frontend');
  if(realpathSync(frontend)!==frontend)throw new Error('Frontend source must not traverse a symlink or junction');
  const allowed=resolve(root,'.local','distribution')+sep;
  function directory(path) {
    if(path!==allowed.slice(0,-1)&&!path.startsWith(allowed))throw new Error('Invalid build staging directory');
    mkdirSync(path,{recursive:true});
    if(realpathSync(path)!==path)throw new Error('Build staging must not traverse a symlink or junction');
  }
  const staging=resolve(root,'.local','distribution','frontend');
  directory(staging);
  // Validate canonical source paths before copying. Verify no input changed during staging.
  const expectedHash=sourceHash(frontend);
  for(const name of [...frontendInputs,...externalInputs]) {
    const target=resolve(staging,name);
    if(!target.startsWith(allowed))throw new Error('Invalid build input');
    directory(dirname(target));
    if(existsSync(target)&&lstatSync(target).isSymbolicLink())throw new Error('Build input must not be a symlink');
    rmSync(target,{recursive:true,force:true});
    cpSync(resolve(frontend,name),target,{recursive:true});
  }
  if(sourceHash(staging)!==expectedHash)throw new Error('Build sources changed while staging');
  return staging;
}

function run(program,args,cwd,env=process.env){const result=spawnSync(program,args,{cwd,env,stdio:'inherit'});if(result.status!==0)process.exit(result.status??1);}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const root=fileURLToPath(new URL('..',import.meta.url));
  const staging=stageFrontend(root);
  if(process.platform==='win32')run(process.env.ComSpec??'cmd.exe',['/d','/s','/c','npm ci --include=dev'],staging);
  else run('npm',['ci','--include=dev'],staging);
  run(process.execPath,['scripts/build-embedded.mjs'],staging);
  run('cargo',['build','--locked','--release','--features','mcp,embedded-ui'],root,{...process.env,BEE_FRONTEND_DIST:resolve(staging,'dist')});
}
