import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync, lstatSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
function run(args) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit', env: { ...process.env, NODE_ENV:'production', VITE_API_MODE:'http', VITE_API_BASE_URL:'/api/v1' } });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
run(['node_modules/typescript/bin/tsc', '-b']);
run(['node_modules/vite/bin/vite.js', 'build', '--mode', 'production']);
function files(path) {
  if (lstatSync(path).isSymbolicLink()) throw new Error('Symlinks are not embedded build inputs: '+path);
  return lstatSync(path).isDirectory() ? readdirSync(path).flatMap(name=>files(resolve(path,name))) : [path];
}
const inputs = ['src','public','scripts','package.json','package-lock.json','index.html','vite.config.ts','tsconfig.json','tsconfig.app.json','tsconfig.node.json'];
const paths=inputs.flatMap(name=>files(resolve(root,name))).map(path=>relative(root,path).replaceAll('\\','/')).sort((a,b)=>Buffer.compare(Buffer.from(a),Buffer.from(b)));
const source=createHash('sha256');
for(const path of paths){source.update(path);source.update('\0');source.update(readFileSync(resolve(root,path)));source.update('\0');}
const dist=resolve(root,'dist');
const output=files(dist).filter(path=>relative(dist,path)!=='.beeteam-build.json').map(path=>({path:relative(dist,path).replaceAll('\\','/'),sha256:createHash('sha256').update(readFileSync(path)).digest('hex')})).sort((a,b)=>Buffer.compare(Buffer.from(a.path),Buffer.from(b.path)));
writeFileSync(resolve(dist,'.beeteam-build.json'),JSON.stringify({sourceHash:source.digest('hex'),nodeEnv:'production',apiMode:'http',apiBase:'/api/v1',files:output},null,2)+'\n');
