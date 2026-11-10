import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { install, update, uninstall, loadInstalledGraph } from '../../scripts/bootstrap.mjs';
import { buildRelease } from '../../scripts/release.mjs';
const workflow = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const text = (name, body = 'old') => `---\nname: ${name}\ndescription: fixture\n---\n${body}\n`;
function fixture() {
 const root=mkdtempSync(path.join(tmpdir(),'produktiv-delivery-'));
 const source=path.join(root,'source'), project=path.join(root,'project'), home=path.join(root,'home');
 mkdirSync(project); mkdirSync(home); mkdirSync(path.join(source,'references'),{recursive:true});
 writeFileSync(path.join(source,'README.md'),'# Produktiv fixture\n');
 writeFileSync(path.join(source,'references/capabilities.md'),'# Capability Registry\n');
 writeFileSync(path.join(source,'package.json'),' {"version":"0.1.0"}');
 mkdirSync(path.join(source,'skills/setup'),{recursive:true});
 writeFileSync(path.join(source,'skills/setup/SKILL.md'),text('setup'));
 return {root,source,project,home};
}
function put(project,name,content=text(name)) {
 const dir=path.join(project,'.agents/skills',name); mkdirSync(dir,{recursive:true});
 writeFileSync(path.join(dir,'SKILL.md'),content); return dir;
}
// Exercise the real npx process boundary without network or the user's profile.
function mockCli(root) {
 const bin=path.join(root,'bin'); mkdirSync(bin);
 writeFileSync(path.join(bin,'npx'),`#!${process.execPath}\n`+String.raw`
 const fs=require('node:fs'),path=require('node:path');
 const args=process.argv.slice(2); const cmd=args[4];
 const base=args.includes('-g')?process.env.HOME:process.cwd();
 const dest=path.join(base,'.agents/skills');
 if(cmd==='add') {
  const src=args[5]; if(path.basename(src)!=='skills') process.exit(9);
  fs.mkdirSync(dest,{recursive:true});
  for(const name of fs.readdirSync(src)) {
   if(!fs.existsSync(path.join(src,name,'SKILL.md'))) continue;
   fs.cpSync(path.join(src,name),path.join(dest,name),{recursive:true});
  }
 } else if(cmd==='list') {
  if(process.env.PRODUKTIV_TEST_DISCOVERY_FAIL==='1') { console.log('[]'); process.exit(0); }
  console.log(JSON.stringify(fs.readdirSync(dest).map(name=>({name,path:path.join(dest,name),agents:['cursor']}))));
 } else if(cmd==='--version') console.log('1.5.18');
 else process.exit(8);
 `);
 chmodSync(path.join(bin,'npx'),0o755); return bin;
}
test('foreign skills, including a colliding produktiv resource, are untouched', async()=>{
 const f=fixture();try {
  put(f.project,'setup'); const foreign=put(f.project,'other-tool');
  mkdirSync(path.join(foreign,'produktiv')); writeFileSync(path.join(foreign,'produktiv/keep'),'foreign');
  const result=await install({...f,register:false});
  assert.deepEqual(result.links.map(l=>l.skill),['setup']);
  assert.equal(readFileSync(path.join(foreign,'produktiv/keep'),'utf8'),'foreign');
  await update({...f,register:false}); uninstall({project:f.project});
  assert.equal(readFileSync(path.join(foreign,'SKILL.md'),'utf8'),text('other-tool'));
  assert.equal(readFileSync(path.join(foreign,'produktiv/keep'),'utf8'),'foreign');
 }finally{rmSync(f.root,{recursive:true,force:true});}
});
test('uninstall refuses a legacy foreign-skill entry rather than removing its link', async()=>{
 const f=fixture();try{
  put(f.project,'setup');const result=await install({...f,register:false});
  const dir=put(f.project,'other-tool');const link=path.join(dir,'produktiv');symlinkSync(result.canonicalPackageRoot,link);
  const manifest=JSON.parse(readFileSync(result.manifestPath,'utf8'));delete manifest.skillFiles;
  manifest.owned.push({type:'link',skill:'other-tool',path:link,target:result.canonicalPackageRoot});
  writeFileSync(result.manifestPath,JSON.stringify(manifest));
  const outcome=uninstall({...f,register:false});
  assert.equal(outcome.ok,false);assert.ok(outcome.refused.some(e=>e.reason==='not-package-skill'));
  assert.equal(readFileSync(path.join(dir,'SKILL.md'),'utf8'),text('other-tool'));
  // lstat, not existsSync: the intentionally preserved foreign link can be dangling.
  assert.equal((await import('node:fs')).lstatSync(link).isSymbolicLink(),true);
 }finally{rmSync(f.root,{recursive:true,force:true});}
});
test('same-name unowned skill stops before registration', async()=>{
 const f=fixture();try {
  const dir=put(f.project,'setup',text('setup','someone else'));
  await assert.rejects(()=>install({...f,register:false}),e=>e.code==='skill-collision');
  assert.equal(readFileSync(path.join(dir,'SKILL.md'),'utf8'),text('setup','someone else'));
  assert.equal(existsSync(path.join(f.project,'.agents/packages/produktiv')),false);
 }finally{rmSync(f.root,{recursive:true,force:true});}
});
test('one update refreshes skill bytes, adds a new skill, and preserves foreign skills', async()=>{
 const f=fixture(), savedPath=process.env.PATH;try {
  process.env.PATH=mockCli(f.root)+path.delimiter+savedPath;
  put(f.project,'other-tool');
  const initial=await install(f); assert.equal(initial.ok,true);
  writeFileSync(path.join(f.source,'skills/setup/SKILL.md'),text('setup','new'));
  mkdirSync(path.join(f.source,'skills/discover'));writeFileSync(path.join(f.source,'skills/discover/SKILL.md'),text('discover'));
  const result=await update(f);
  assert.equal(result.ok,true);assert.deepEqual(result.links.map(l=>l.skill),['discover','setup']);
  assert.equal(readFileSync(path.join(f.project,'.agents/skills/setup/SKILL.md'),'utf8'),text('setup','new'));
  assert.equal(existsSync(path.join(f.project,'.agents/skills/other-tool/produktiv')),false);
  writeFileSync(path.join(f.project,'.agents/skills/setup/SKILL.md'),text('setup','local edit'));
  await assert.rejects(()=>update(f),e=>e.code==='skill-collision');
  assert.equal(readFileSync(path.join(f.project,'.agents/skills/setup/SKILL.md'),'utf8'),text('setup','local edit'));
 }finally{process.env.PATH=savedPath;rmSync(f.root,{recursive:true,force:true});}
});
test('update removes only verified obsolete package registrations', async()=>{
 const f=fixture(),savedPath=process.env.PATH;try {
  process.env.PATH=mockCli(f.root)+path.delimiter+savedPath;
  const foreign=put(f.project,'other-tool');
  await install(f);
  rmSync(path.join(f.source,'skills/setup'),{recursive:true,force:true});
  mkdirSync(path.join(f.source,'skills/discover'));writeFileSync(path.join(f.source,'skills/discover/SKILL.md'),text('discover'));
  const result=await update(f);assert.deepEqual(result.links.map(l=>l.skill),['discover']);
  assert.equal(existsSync(path.join(f.project,'.agents/skills/setup')),false);
  assert.equal(readFileSync(path.join(foreign,'SKILL.md'),'utf8'),text('other-tool'));
  assert.doesNotMatch(readFileSync(path.join(f.project,'.gitignore'),'utf8'),/skills\/setup/);
 }finally{process.env.PATH=savedPath;rmSync(f.root,{recursive:true,force:true});}
});
test('failed update smoke keeps old core and SKILL.md', async()=>{
 const f=fixture(),savedPath=process.env.PATH;try{
  process.env.PATH=mockCli(f.root)+path.delimiter+savedPath;
  const initial=await install(f);
  writeFileSync(path.join(f.source,'skills/setup/SKILL.md'),text('setup','new'));
  await assert.rejects(()=>update({...f,smoke:()=>{throw new Error('broken');}}),e=>e.code==='smoke-failed');
  assert.equal(readFileSync(path.join(f.project,'.agents/skills/setup/SKILL.md'),'utf8'),text('setup'));
  assert.equal(JSON.parse(readFileSync(path.join(initial.canonicalPackageRoot,'.produktiv-package.json'),'utf8')).packageVersion,initial.packageVersion);
 }finally{process.env.PATH=savedPath;rmSync(f.root,{recursive:true,force:true});}
});
test('an unrelated host alias with the same name is not overwritten', async()=>{
 const f=fixture();try{
  put(f.project,'setup');const foreign=path.join(f.root,'foreign');mkdirSync(foreign);
  const alias=path.join(f.project,'.cursor/skills/setup');mkdirSync(path.dirname(alias),{recursive:true});symlinkSync(foreign,alias);
  await assert.rejects(()=>install({...f,register:false}),e=>e.code==='skill-collision');
  assert.equal(existsSync(alias),true);assert.equal(existsSync(path.join(f.project,'.agents/packages/produktiv')),false);
 }finally{rmSync(f.root,{recursive:true,force:true});}
});
test('failed discovery rolls back updated core, new skills, and old skill bytes', async()=>{
 const f=fixture(),savedPath=process.env.PATH;try{
  process.env.PATH=mockCli(f.root)+path.delimiter+savedPath;
  const initial=await install(f);writeFileSync(path.join(f.source,'skills/setup/SKILL.md'),text('setup','new'));
  mkdirSync(path.join(f.source,'skills/discover'));writeFileSync(path.join(f.source,'skills/discover/SKILL.md'),text('discover'));
  process.env.PRODUKTIV_TEST_DISCOVERY_FAIL='1';
  await assert.rejects(()=>update(f),e=>e.code==='no-skill');
  assert.equal(readFileSync(path.join(f.project,'.agents/skills/setup/SKILL.md'),'utf8'),text('setup'));
  assert.equal(existsSync(path.join(f.project,'.agents/skills/discover')),false);
  assert.equal(JSON.parse(readFileSync(path.join(initial.canonicalPackageRoot,'.produktiv-package.json'),'utf8')).packageVersion,initial.packageVersion);
 }finally{delete process.env.PRODUKTIV_TEST_DISCOVERY_FAIL;process.env.PATH=savedPath;rmSync(f.root,{recursive:true,force:true});}
});
test('failed discovery on idempotent reinstall preserves the previous manifest and skills', async()=>{
 const f=fixture(),savedPath=process.env.PATH;try{
  process.env.PATH=mockCli(f.root)+path.delimiter+savedPath;
  const initial=await install(f),manifest=readFileSync(initial.manifestPath,'utf8');
  process.env.PRODUKTIV_TEST_DISCOVERY_FAIL='1';
  await assert.rejects(()=>install(f),e=>e.code==='no-skill');
  assert.equal(readFileSync(initial.manifestPath,'utf8'),manifest);
  assert.equal(readFileSync(path.join(f.project,'.agents/skills/setup/SKILL.md'),'utf8'),text('setup'));
  assert.equal(JSON.parse(readFileSync(path.join(initial.canonicalPackageRoot,'.produktiv-package.json'),'utf8')).packageVersion,initial.packageVersion);
 }finally{delete process.env.PRODUKTIV_TEST_DISCOVERY_FAIL;process.env.PATH=savedPath;rmSync(f.root,{recursive:true,force:true});}
});
test('release carries all current skills and graph without access to the build checkout', {timeout:120000},async()=>{
 if(Number(process.versions.node.split('.')[0])<22) throw new Error('Run this gate with Node >=22.');
 const f=fixture();try{
  const built=path.join(f.root,'built'); const release=path.join(f.root,'isolated-release');
  const receipt=await buildRelease({source:workflow,output:built});
  cpSync(built,release,{recursive:true,verbatimSymlinks:true});rmSync(built,{recursive:true,force:true});
  // The installer and imports themselves come from the moved release.
  const bootstrap=await import(pathToFileURL(path.join(release,'scripts/bootstrap.mjs')).href);
  for(const name of receipt.skills) cpSync(path.join(release,'skills',name),path.join(f.project,'.agents/skills',name),{recursive:true});
  const result=await bootstrap.install({source:release,project:f.project,home:f.home,register:false});
  assert.equal(result.ok,true); for(const surface of ['core','graph','diagram']) assert.equal(result.surfaces[surface].ok,true,surface);
  for(const file of ['agents/simplicity-review/v4.md','agents/plan-review/v8.md','agents/completion-review/v5.md','agents/code-review/v4.md','references/artifact-resolution.md','references/artifact-writing.md','references/visual-handoff.md','references/graph-use.md','references/execution.md','references/design-practice.md','policies/decisions.md','references/handoff-resume.md','templates/handoff.md'])
   assert.equal(readFileSync(path.join(result.canonicalPackageRoot,file),'utf8'),readFileSync(path.join(workflow,file),'utf8'),file);
  assert.equal(result.links.length,receipt.skills.length);assert.equal(receipt.skills.includes('skill-probe'),false);
  assert.ok(receipt.skills.includes('pk-handoff'));
  assert.ok(receipt.skills.includes('pk-explain'));
  assert.ok(receipt.skills.includes('pk-design'));
  for (const name of receipt.skills) {
   assert.equal(readFileSync(path.join(f.project,'.agents/skills',name,'produktiv/references/context-pack.md'),'utf8'),readFileSync(path.join(workflow,'references/context-pack.md'),'utf8'),name + ': current context contract');
  }
  for (const name of ['pk-design', 'pk-prototype', 'pk-to-plan', 'pk-implement']) {
   assert.equal(readFileSync(path.join(f.project,'.agents/skills',name,'SKILL.md'),'utf8'),readFileSync(path.join(workflow,'skills',name,'SKILL.md'),'utf8'));
   assert.equal(readFileSync(path.join(f.project,'.agents/skills',name,'produktiv/references/artifact-resolution.md'),'utf8'),readFileSync(path.join(workflow,'references/artifact-resolution.md'),'utf8'));
  }
  for (const file of ['policies/design.md','references/design-practice.md'])
   assert.equal(readFileSync(path.join(f.project,'.agents/skills/pk-design/produktiv',file),'utf8'),readFileSync(path.join(workflow,file),'utf8'),file);
  assert.equal(readFileSync(path.join(f.project,'.agents/skills/pk-explain/SKILL.md'),'utf8'),readFileSync(path.join(workflow,'skills/pk-explain/SKILL.md'),'utf8'));
  assert.equal(readFileSync(path.join(f.project,'.agents/skills/pk-explain/produktiv/references/graph-use.md'),'utf8'),readFileSync(path.join(workflow,'references/graph-use.md'),'utf8'));
  assert.equal(readFileSync(path.join(f.project,'.agents/skills/pk-handoff/SKILL.md'),'utf8'),readFileSync(path.join(workflow,'skills/pk-handoff/SKILL.md'),'utf8'));
  assert.equal(readFileSync(path.join(f.project,'.agents/skills/pk-handoff/produktiv/templates/handoff.md'),'utf8'),readFileSync(path.join(workflow,'templates/handoff.md'),'utf8'));
  assert.equal(existsSync(path.join(f.project,'.workflow/handoff.md')),false);
  const loaded=await loadInstalledGraph(path.join(result.canonicalPackageRoot,'vendor/understand-anything/dist/plugins/tree-sitter-plugin.js'));
  assert.equal(loaded.ok,true);assert.equal(loaded.specs.length,17);
  const app=path.join(f.root,'app');mkdirSync(app);writeFileSync(path.join(app,'answer.ts'),'export function answer(): number { return 42; }\n');
  for(const args of [['init','--quiet'],['add','answer.ts'],['-c','user.name=Eval','-c','user.email=eval@localhost','commit','--quiet','-m','fixture']]) execFileSync('git',args,{cwd:app});
  const adapter=await import(pathToFileURL(path.join(result.canonicalPackageRoot,'adapters/graph/index.js')).href);
  const fresh=await adapter.ensure_fresh(app,undefined,'/setup');assert.ok(['AVAILABLE','PARTIAL'].includes(fresh.status),JSON.stringify(fresh));
  const answer=await adapter.find_symbol(app,'answer');assert.ok(answer.hits.some(hit=>hit.name==='answer'),JSON.stringify(answer));
  assert.equal(existsSync(path.join(result.canonicalPackageRoot,'evals')),false);
  assert.equal(existsSync(path.join(result.canonicalPackageRoot,'.upstream')),false);
  const grammar=path.join(release,'vendor/understand-anything/node_modules/tree-sitter-typescript/tree-sitter-typescript.wasm');
  rmSync(grammar);
  await assert.rejects(()=>bootstrap.update({source:release,project:f.project,home:f.home,register:false}),e=>e.code==='release');
  assert.equal(readFileSync(path.join(f.project,'.agents/skills/pk-setup/SKILL.md'),'utf8'),readFileSync(path.join(workflow,'skills/pk-setup/SKILL.md'),'utf8'));
 }finally{rmSync(f.root,{recursive:true,force:true});}
});

test('core discovery accepts rewritten documentation and rejects an empty resource', async()=>{
 const f=fixture();try {
  writeFileSync(path.join(f.source,'references/capabilities.md'),'# Capabilities for this session\n\nHost facts and optional engine floors.\n');
  put(f.project,'setup');const result=await install({...f,register:false});
  assert.equal(result.surfaces.core.ok,true);
  writeFileSync(path.join(f.source,'references/capabilities.md'),'  \n');
  await assert.rejects(()=>update({...f,register:false}),e=>e.code==='smoke-failed');
  assert.equal(readFileSync(path.join(result.canonicalPackageRoot,'references/capabilities.md'),'utf8').includes('Host facts'),true);
 }finally{rmSync(f.root,{recursive:true,force:true});}
});
