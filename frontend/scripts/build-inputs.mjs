import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, lstatSync, realpathSync } from 'node:fs';
import { resolve, relative } from 'node:path';

export const frontendInputs = ['src','public','scripts','package.json','package-lock.json','index.html','vite.config.ts','tsconfig.json','tsconfig.app.json','tsconfig.node.json'];
// Stable frontend-relative names are hashed identically by build_frontend.rs.
export const externalInputs = ['../docs/team-role-icons.json','../docs/mcp-catalog.json','../Cargo.toml'];

export function files(path) {
  if (lstatSync(path).isSymbolicLink()) throw new Error('Symlinks are not embedded build inputs: '+path);
  return lstatSync(path).isDirectory() ? readdirSync(path).flatMap(name=>files(resolve(path,name))) : [path];
}

export function sourceHash(root) {
  const paths = frontendInputs.flatMap(name=>files(resolve(root,name)))
    .map(path=>relative(root,path).replaceAll('\\','/'));
  for (const name of externalInputs) {
    const path = resolve(root,name);
    if (realpathSync(path) !== resolve(realpathSync(root),name)) throw new Error('External build inputs must not traverse symlinks');
    files(path);
    paths.push(name);
  }
  paths.sort((a,b)=>Buffer.compare(Buffer.from(a),Buffer.from(b)));
  const hash=createHash('sha256');
  for(const name of paths){hash.update(name);hash.update('\0');hash.update(readFileSync(resolve(root,name)));hash.update('\0');}
  return hash.digest('hex');
}
