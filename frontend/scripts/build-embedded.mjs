import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { files, sourceHash } from './build-inputs.mjs';
const root = fileURLToPath(new URL('..', import.meta.url));
function run(args) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit', env: { ...process.env, NODE_ENV:'production', VITE_API_MODE:'http', VITE_API_BASE_URL:'/api/v1' } });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
run(['node_modules/typescript/bin/tsc', '-b']);
run(['node_modules/vite/bin/vite.js', 'build', '--mode', 'production']);
const dist=resolve(root,'dist');
const output=files(dist).filter(path=>relative(dist,path)!=='.beeteam-build.json').map(path=>({path:relative(dist,path).replaceAll('\\','/'),sha256:createHash('sha256').update(readFileSync(path)).digest('hex')})).sort((a,b)=>Buffer.compare(Buffer.from(a.path),Buffer.from(b.path)));
writeFileSync(resolve(dist,'.beeteam-build.json'),JSON.stringify({sourceHash:sourceHash(root),nodeEnv:'production',apiMode:'http',apiBase:'/api/v1',files:output},null,2)+'\n');
