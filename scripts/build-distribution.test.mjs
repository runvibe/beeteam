import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,realpathSync,renameSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,dirname,basename} from 'node:path';
import {frontendInputs,sourceHash} from '../frontend/scripts/build-inputs.mjs';
import {stageFrontend} from './build-distribution.mjs';

function fixture(t) {
  const root=mkdtempSync(resolve(tmpdir(),'beeteam-build-test-'));
  t.after(()=>{
    assert.equal(dirname(root),realpathSync(tmpdir()));
    assert.ok(basename(root).startsWith('beeteam-build-test-'));
    rmSync(root,{recursive:true,force:true});
  });
  for(const name of frontendInputs) {
    const path=resolve(root,'frontend',name);
    if(['src','public','scripts'].includes(name)){mkdirSync(path,{recursive:true});writeFileSync(resolve(path,'fixture.txt'),name);}
    else writeFileSync(path,name);
  }
  writeFileSync(resolve(root,'Cargo.toml'),'[package]\nversion="0.1.0"\n');
  mkdirSync(resolve(root,'docs'));
  writeFileSync(resolve(root,'docs/team-role-icons.json'),'[{"id":"crown"}]\n');
  writeFileSync(resolve(root,'docs/mcp-catalog.json'),'{"tools":[]}\n');
  return root;
}

test('isolated staging includes the canonical sibling catalog and has the same source hash', t=>{
  const root=fixture(t);
  const staged=stageFrontend(root);
  assert.equal(readFileSync(resolve(staged,'../docs/team-role-icons.json'),'utf8'),readFileSync(resolve(root,'docs/team-role-icons.json'),'utf8'));
  assert.equal(readFileSync(resolve(staged,'../docs/mcp-catalog.json'),'utf8'),readFileSync(resolve(root,'docs/mcp-catalog.json'),'utf8'));
  const original=sourceHash(resolve(root,'frontend'));
  assert.equal(sourceHash(staged),original);
  writeFileSync(resolve(root,'docs/team-role-icons.json'),'[{"id":"rocket"}]\n');
  assert.notEqual(sourceHash(resolve(root,'frontend')),original);
  assert.equal(sourceHash(staged),original);
  stageFrontend(root);
  assert.equal(sourceHash(staged),sourceHash(resolve(root,'frontend')));
});

test('staging rejects a junction in the external source or destination path', t=>{
  const root=fixture(t);
  const staged=stageFrontend(root);
  const docs=resolve(staged,'../docs');
  renameSync(docs,docs+'-actual');
  symlinkSync(docs+'-actual',docs,'junction');
  assert.throws(()=>stageFrontend(root),/symlink|junction/);
  const source=resolve(root,'docs');
  renameSync(source,source+'-actual');
  symlinkSync(source+'-actual',source,'junction');
  assert.throws(()=>sourceHash(resolve(root,'frontend')),/symlink/);
});

test('site staging includes its root build helper and canonical sibling inputs', t=>{
  const root=fixture(t);
  mkdirSync(resolve(root,'site/scripts'),{recursive:true});
  writeFileSync(resolve(root,'site/package.json'),'{}');
  writeFileSync(resolve(root,'site/scripts/build.mjs'),"import '../../scripts/compose-ui.mjs';");
  mkdirSync(resolve(root,'scripts'));
  writeFileSync(resolve(root,'scripts/compose-ui.mjs'),'export const fixture=true;');
  const staged=stageFrontend(root);
  assert.equal(readFileSync(resolve(staged,'../scripts/compose-ui.mjs'),'utf8'),'export const fixture=true;');
  assert.equal(readFileSync(resolve(staged,'../site/scripts/build.mjs'),'utf8'),"import '../../scripts/compose-ui.mjs';");
  assert.equal(readFileSync(resolve(staged,'scripts/fixture.txt'),'utf8'),'scripts');
});
