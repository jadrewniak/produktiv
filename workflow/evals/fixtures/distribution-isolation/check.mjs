import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chmodSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MANIFEST_KIND,
  PIN_KIND,
  assessSkill,
  install,
  uninstall,
  update,
} from '../../../scripts/bootstrap.mjs';
import {
  PACKAGE_KIND,
  PACKAGE_MARKER_NAME,
  activeAgentResources,
  finalizeRelease,
  releaseInventory,
  treeBytes,
  verifyRelease,
} from '../../../scripts/package-image.mjs';
import { buildRelease } from '../../../scripts/release.mjs';

const workflow = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const plantedRubric = path.join(workflow, 'agents', 'code-review', 'v0.md');

function runGit(project, args) {
  return execFileSync('git', args, { cwd: project, encoding: 'utf8' }).trim();
}

function hashFile(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function relative(project, file) {
  let target;
  try { target = realpathSync(file); } catch { target = path.resolve(file); }
  return path.relative(realpathSync(project), target).split(path.sep).join('/');
}

function createProject(root, name) {
  const project = path.join(root, name);
  mkdirSync(path.join(project, '.workflow'), { recursive: true });
  mkdirSync(path.join(project, 'docs', 'plans'), { recursive: true });
  mkdirSync(path.join(project, '.agents', 'skills', 'foreign-tool'), { recursive: true });
  writeFileSync(path.join(project, '.gitignore'), 'dist/\n');
  writeFileSync(path.join(project, '.workflow', 'config.yaml'), 'version: 1\n');
  writeFileSync(path.join(project, 'docs', 'plans', 'user.md'), '# User plan\n');
  writeFileSync(
    path.join(project, '.agents', 'skills', 'foreign-tool', 'SKILL.md'),
    '---\nname: foreign-tool\ndescription: foreign\n---\n\nForeign skill.\n',
  );
  writeFileSync(
    path.join(project, 'skills-lock.json'),
    `${JSON.stringify({ version: 1, skills: { 'foreign-tool': { source: 'foreign' } } }, null, 2)}\n`,
  );
  runGit(project, ['init', '--quiet']);
  runGit(project, ['config', 'user.name', 'Isolation Eval']);
  runGit(project, ['config', 'user.email', 'm6@localhost']);
  runGit(project, ['add', '.']);
  runGit(project, ['commit', '--quiet', '-m', 'fixture']);
  return {
    project,
    foreignHash: hashFile(path.join(project, '.agents', 'skills', 'foreign-tool', 'SKILL.md')),
    lockHash: hashFile(path.join(project, 'skills-lock.json')),
    workflowHash: hashFile(path.join(project, '.workflow', 'config.yaml')),
    planHash: hashFile(path.join(project, 'docs', 'plans', 'user.md')),
  };
}

function mockSkillsCli(root) {
  const bin = path.join(root, 'bin');
  mkdirSync(bin, { recursive: true });
  const script = `#!${process.execPath}\n${String.raw`
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
const command = args[4];
const base = args.includes('-g') ? process.env.HOME : process.cwd();
const dest = path.join(base, '.agents', 'skills');
if (command === 'add') {
  const source = args[5];
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(source)) {
    const skill = path.join(source, name);
    if (!fs.existsSync(path.join(skill, 'SKILL.md'))) continue;
    fs.rmSync(path.join(dest, name), { recursive: true, force: true });
    fs.cpSync(skill, path.join(dest, name), { recursive: true });
  }
} else if (command === 'list') {
  const rows = fs.existsSync(dest) ? fs.readdirSync(dest)
    .filter(name => fs.existsSync(path.join(dest, name, 'SKILL.md')))
    .map(name => ({ name, path: path.join(dest, name), agents: ['cursor'] })) : [];
  console.log(JSON.stringify(rows));
} else if (command === '--version') {
  console.log('1.5.18');
} else {
  process.exit(8);
}
`}`;
  writeFileSync(path.join(bin, 'npx'), script);
  chmodSync(path.join(bin, 'npx'), 0o755);
  return bin;
}

function deriveRelease(source, output, version) {
  cpSync(source, output, { recursive: true, verbatimSymlinks: true });
  const previous = JSON.parse(readFileSync(path.join(source, '.produktiv-release.json'), 'utf8'));
  const pkgPath = path.join(output, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  pkg.version = version;
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
  const markerPath = path.join(output, PACKAGE_MARKER_NAME);
  const marker = JSON.parse(readFileSync(markerPath, 'utf8'));
  marker.packageVersion = version;
  writeFileSync(markerPath, `${JSON.stringify(marker, null, 2)}\n`);
  const capabilities = path.join(output, 'references', 'capabilities.md');
  writeFileSync(capabilities, `${readFileSync(capabilities, 'utf8')}\nRelease fixture: ${version}.\n`);
  return finalizeRelease(output, {
    version,
    skills: previous.skills,
    activeAgentResources: previous.activeAgentResources,
    legacyAgentInventory: previous.legacyAgentInventory,
    surfaces: previous.surfaces,
    grammarSpecs: previous.grammarSpecs,
  });
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function assertProjectStateUnchanged(state) {
  assert.equal(hashFile(path.join(state.project, '.agents', 'skills', 'foreign-tool', 'SKILL.md')), state.foreignHash);
  assert.equal(hashFile(path.join(state.project, 'skills-lock.json')), state.lockHash);
  assert.equal(hashFile(path.join(state.project, '.workflow', 'config.yaml')), state.workflowHash);
  assert.equal(hashFile(path.join(state.project, 'docs', 'plans', 'user.md')), state.planHash);
}

async function assertHealthy(project, expectedRoot) {
  const skill = path.join(project, '.agents', 'skills', 'pk-setup');
  assert.equal(realpathSync(path.join(skill, 'produktiv')), realpathSync(expectedRoot));
  const status = await assessSkill(skill, { nodeAvailable: true, nodeMajor: 22 });
  assert.deepEqual(
    { core: status.core.available, graph: status.graph.available, diagram: status.diagram.available },
    { core: true, graph: true, diagram: true },
  );
  return {
    core: hashFile(path.join(skill, 'produktiv', 'references', 'capabilities.md')),
    rubric: hashFile(path.join(skill, 'produktiv', 'agents', 'plan-review', 'v8.md')),
  };
}

function gitInventory(project) {
  const visible = runGit(project, ['status', '--porcelain', '--untracked-files=all'])
    .split('\n').filter(Boolean).sort();
  const ignored = [];
  const manifest = readJson(path.join(project, '.agents', 'packages', 'produktiv.ownership.json'));
  for (const entry of manifest.owned) {
    if (entry.type === 'manifest' || entry.type === 'skill-registration' || entry.type === 'host-alias') {
      const rel = relative(project, entry.path);
      try {
        runGit(project, ['check-ignore', '--quiet', '--', rel]);
        ignored.push(rel);
      } catch {
        assert.fail(`owned registration is not ignored: ${rel}`);
      }
    }
  }
  assert.throws(() => runGit(project, ['check-ignore', '--quiet', '--', 'produktiv-lock.json']));
  assert.deepEqual(visible, ['?? produktiv-lock.json', 'M .gitignore']);
  return { visible, ignored: [...new Set(ignored)].sort() };
}

function writeLegacyLayout(state, release, mode) {
  const legacyRoot = path.join(state.project, '.agents', 'packages', 'produktiv');
  mkdirSync(path.join(legacyRoot, 'references'), { recursive: true });
  cpSync(path.join(release, 'references', 'capabilities.md'), path.join(legacyRoot, 'references', 'capabilities.md'));
  cpSync(path.join(release, 'package.json'), path.join(legacyRoot, 'package.json'));
  const installId = `legacy-${mode}`;
  writeFileSync(path.join(legacyRoot, PACKAGE_MARKER_NAME), `${JSON.stringify({
    kind: PACKAGE_KIND,
    markerVersion: 1,
    packageVersion: readJson(path.join(release, 'package.json')).version,
    installId,
    host: 'cursor',
    scope: 'project',
  }, null, 2)}\n`);
  const skillFiles = [];
  const links = [];
  for (const name of readdirSync(path.join(release, 'skills')).sort()) {
    const source = path.join(release, 'skills', name);
    if (!existsSync(path.join(source, 'SKILL.md'))) continue;
    const dest = path.join(state.project, '.agents', 'skills', name);
    cpSync(source, dest, { recursive: true });
    const link = path.join(dest, 'produktiv');
    symlinkSync(path.relative(dest, legacyRoot), link);
    skillFiles.push({ skill: name, sha256: hashFile(path.join(dest, 'SKILL.md')) });
    links.push({ type: 'link', skill: name, path: link, target: readlinkSync(link) });
  }
  const manifestPath = path.join(state.project, '.agents', 'packages', 'produktiv.ownership.json');
  writeFileSync(manifestPath, `${JSON.stringify({
    kind: MANIFEST_KIND,
    manifestVersion: 1,
    installId,
    packageVersion: readJson(path.join(release, 'package.json')).version,
    host: 'cursor',
    scope: 'project',
    canonicalPackageRoot: legacyRoot,
    skillFiles,
    owned: [
      { type: 'package-root', path: legacyRoot, installId },
      { type: 'manifest', path: manifestPath },
      ...links,
    ],
  }, null, 2)}\n`);
  if (mode === 'edited') writeFileSync(path.join(legacyRoot, 'local-edit.txt'), 'keep me\n');
  if (mode === 'tracked') {
    runGit(state.project, ['add', '-f', relative(state.project, path.join(legacyRoot, 'references', 'capabilities.md'))]);
  }
  return legacyRoot;
}

function assertPin(project, receipt) {
  const pin = readJson(path.join(project, 'produktiv-lock.json'));
  assert.deepEqual(pin, {
    kind: PIN_KIND,
    schemaVersion: 1,
    package: 'produktiv-workflow',
    version: receipt.version,
    digest: receipt.digest,
  });
  assert.equal(JSON.stringify(pin).includes(project), false);
  return pin;
}

function writeReceipt(evidence) {
  const lines = [
    '# External package store, project pins and clean installation footprint',
    '',
    '**Result:** PASS  ',
    `**Date:** ${new Date().toISOString().slice(0, 10)}`,
    '**Reference host:** Cursor project scope; all projects and homes were temporary.',
    '',
    '## Release identity and placement',
    '',
    `- Release A: \`${evidence.releaseA.version}\` / \`${evidence.releaseA.digest}\`; ${evidence.releaseA.files} inventoried files; ${evidence.releaseA.bytes} bytes.`,
    `- Release B: \`${evidence.releaseB.version}\` / \`${evidence.releaseB.digest}\`; ${evidence.releaseB.files} inventoried files; ${evidence.releaseB.bytes} bytes.`,
    '- Canonical roots resolved under `<home>/.agents/packages/produktiv/releases/<version>/<sha256>/`, outside every target repository.',
    '- The digest covers versioned identity/migration metadata plus the deterministic file/symlink inventory; it excludes only the self-referential receipt file and staging token. Stored bytes and bound metadata are reverified before every activation.',
    '- No mutable `latest` selector, per-install ID, host path, project path or absolute local path participates in release identity or the project pin.',
    '',
    '## Actual project footprint',
    '',
    'Visible Git changes after a one-operation fresh install:',
    '',
    ...evidence.footprint.visible.map((entry) => `- \`${entry}\``),
    '',
    `Verified ignored owned paths: ${evidence.footprint.ignored.length}. They are the exact root-scoped registrations/aliases and ownership manifest, not \`.agents/\`, \`.cursor/\` or \`.workflow/\` as a whole.`,
    '',
    '- `produktiv-lock.json` remains visible and shareable. Existing `skills-lock.json`, foreign skill bytes, `.workflow/config.yaml`, product Plan and pre-existing `dist/` ignore rule stayed byte-identical.',
    '- No `vendor/`, `node_modules/`, runtime, dependency tree, historical rubric body or release store appeared in the project.',
    '',
    '## Isolation cases',
    '',
    '| Case | Result |',
    '|---|---|',
    '| Fresh install performs registration, external resolution, link activation and smoke in one operation | PASS |',
    '| Cold clone with the committed pin resolves the exact version/digest without an absolute path or second configuration step | PASS |',
    '| Ordinary reinstall obeys the existing pin even when a newer source release is supplied | PASS |',
    '| Explicit update moves only project A to release B; project B remains on release A with unchanged core/rubric hashes and healthy graph/diagram resolution | PASS |',
    '| Failed update restores pin, manifest, SKILL.md registrations, links and `.gitignore`; the staged immutable release may remain cached but is not activated | PASS |',
    '| Projects B and C share the same canonical release A; uninstalling C does not delete or damage B\'s release | PASS |',
    '| Uninstalling updated project A preserves B, both immutable releases, A\'s project pin, workflow/product artifacts, foreign skill, generic lock and existing ignore rules | PASS |',
    '| Tampered prepared bytes, identity/migration metadata and already-stored releases fail digest verification before activation | PASS |',
    '| Same-name foreign skill collision stops before mutation and preserves the foreign bytes | PASS |',
    '',
    '## Active resource closure',
    '',
    `The release contains exactly ${evidence.active.length} reachable reviewer/specialist resources:`,
    '',
    ...evidence.active.map((entry) => `- \`${entry}\``),
    '',
    `Historical reviewer bodies excluded: ${evidence.historicalExcluded}. The release receipt retains only path/hash metadata needed to recognize an unchanged legacy install during safe migration; it does not ship those rubric bodies. Evals and upstream source are absent.`,
    '',
    '## Legacy migration',
    '',
    '- Verified, untracked legacy package bytes matching the release inventory are removed after the external release is activated.',
    '- A legacy tree with an unknown/edited file is retained and reported as `edited-or-unknown`.',
    '- A Git-tracked legacy tree is retained and reported as `tracked`; the installer does not stage, unstage or delete it.',
    '- Ownership uncertainty is retention, never permission to delete.',
    '',
    '## Equivalent manual installation',
    '',
    'A prepared release is self-contained. No upstream build or dependency install is performed on the user machine:',
    '',
    '```sh',
    'node <release>/scripts/bootstrap.mjs install --host cursor --scope project --project <repo>',
    'node <release>/scripts/bootstrap.mjs update --host cursor --scope project --project <repo>',
    'node <release>/scripts/bootstrap.mjs uninstall --host cursor --scope project --project <repo>',
    '```',
    '',
    'The default store is resolved automatically from the user home. `--store-root` exists only as an advanced/test override and is not written to project metadata. Node is needed to run this installer, but it does not install Node/Git and core workflow use remains Node-independent.',
    '',
    '## Evidence command',
    '',
    '`node --test workflow/evals/fixtures/distribution-isolation/check.mjs`',
    '',
  ];
  // Digests follow the package bytes; write a receipt only where one is asked for.
  if (process.env.PRODUKTIV_ISOLATION_RECEIPT) writeFileSync(process.env.PRODUKTIV_ISOLATION_RECEIPT, lines.join('\n'));
}

test('external store, exact pins, isolation, rollback and migration', { timeout: 300000 }, async () => {
  assert.ok(Number(process.versions.node.split('.')[0]) >= 22, 'release proof requires Node >=22');
  const root = mkdtempSync(path.join(tmpdir(), 'produktiv-m6-isolation-'));
  const savedPath = process.env.PATH;
  try {
    process.env.PATH = `${mockSkillsCli(root)}${path.delimiter}${savedPath}`;
    const releaseAPath = path.join(root, 'release-a');
    const releaseBPath = path.join(root, 'release-b');
    // A historical rubric nothing points at, so the filter is proven even where the tree keeps only active versions.
    writeFileSync(plantedRubric, 'Version: v0\n', { flag: 'wx' });
    let releaseA;
    try {
      releaseA = await buildRelease({ source: workflow, output: releaseAPath });
    } finally {
      rmSync(plantedRubric, { force: true });
    }
    const releaseB = deriveRelease(releaseAPath, releaseBPath, '0.1.1-m6');
    verifyRelease(releaseAPath, releaseA);
    verifyRelease(releaseBPath, releaseB);
    assert.notEqual(releaseA.digest, releaseB.digest);

    const active = activeAgentResources(workflow);
    assert.deepEqual(releaseA.activeAgentResources, active);
    const shippedAgents = releaseInventory(releaseAPath)
      .filter((entry) => entry.path.startsWith('agents/') && entry.type === 'file')
      .map((entry) => entry.path);
    assert.deepEqual(shippedAgents, active);
    const allAgents = [];
    for (const family of readdirSync(path.join(workflow, 'agents'))) {
      const familyRoot = path.join(workflow, 'agents', family);
      if (!lstatSync(familyRoot).isDirectory()) continue;
      const stack = [familyRoot];
      while (stack.length) {
        const current = stack.pop();
        for (const name of readdirSync(current)) {
          const file = path.join(current, name);
          if (lstatSync(file).isDirectory()) stack.push(file);
          else if (/^v\d+\.md$/.test(name)) allAgents.push(relative(workflow, file));
        }
      }
    }
    const historical = [...allAgents, 'agents/code-review/v0.md'].filter((entry) => !active.includes(entry));
    assert.ok(historical.includes('agents/code-review/v0.md'));
    for (const entry of historical) assert.equal(existsSync(path.join(releaseAPath, entry)), false, entry);
    assert.equal(existsSync(path.join(releaseAPath, 'evals')), false);

    const home = path.join(root, 'home');
    mkdirSync(home);
    const a = createProject(root, 'project-a');
    const b = createProject(root, 'project-b');
    const c = createProject(root, 'project-c');

    const installedA = await install({ source: releaseAPath, project: a.project, home });
    assert.ok(installedA.canonicalPackageRoot.startsWith(realpathSync(home) + path.sep));
    assert.equal(installedA.canonicalPackageRoot.startsWith(realpathSync(a.project) + path.sep), false);
    assertPin(a.project, releaseA);
    const footprint = gitInventory(a.project);
    assertProjectStateUnchanged(a);
    assert.equal(existsSync(path.join(a.project, '.agents', 'packages', 'produktiv')), false);
    assert.deepEqual(readdirSync(path.join(a.project, '.agents', 'packages')), ['produktiv.ownership.json']);
    await assertHealthy(a.project, installedA.canonicalPackageRoot);

    const installedB = await install({ source: releaseAPath, project: b.project, home });
    const bBefore = await assertHealthy(b.project, installedB.canonicalPackageRoot);
    const bPinBefore = readFileSync(path.join(b.project, 'produktiv-lock.json'), 'utf8');
    const reinstalledB = await install({ source: releaseBPath, project: b.project, home });
    assert.equal(reinstalledB.idempotent, true);
    assert.equal(reinstalledB.canonicalPackageRoot, installedB.canonicalPackageRoot);
    assert.equal(readFileSync(path.join(b.project, 'produktiv-lock.json'), 'utf8'), bPinBefore);

    writeFileSync(path.join(c.project, 'produktiv-lock.json'), bPinBefore);
    const installedC = await install({ source: releaseBPath, project: c.project, home });
    assert.equal(installedC.canonicalPackageRoot, installedB.canonicalPackageRoot);
    assertPin(c.project, releaseA);

    const updatedA = await update({ source: releaseBPath, project: a.project, home });
    assertPin(a.project, releaseB);
    assert.notEqual(updatedA.canonicalPackageRoot, installedA.canonicalPackageRoot);
    assert.equal(readFileSync(path.join(b.project, 'produktiv-lock.json'), 'utf8'), bPinBefore);
    assert.deepEqual(await assertHealthy(b.project, installedB.canonicalPackageRoot), bBefore);

    const rollback = {
      pin: readFileSync(path.join(a.project, 'produktiv-lock.json'), 'utf8'),
      manifest: readFileSync(updatedA.manifestPath, 'utf8'),
      ignore: readFileSync(path.join(a.project, '.gitignore'), 'utf8'),
      skill: hashFile(path.join(a.project, '.agents', 'skills', 'pk-setup', 'SKILL.md')),
      link: realpathSync(path.join(a.project, '.agents', 'skills', 'pk-setup', 'produktiv')),
    };
    await assert.rejects(
      () => update({ source: releaseAPath, project: a.project, home, smoke: () => { throw new Error('fixture failure'); } }),
      (error) => error.code === 'smoke-failed',
    );
    assert.equal(readFileSync(path.join(a.project, 'produktiv-lock.json'), 'utf8'), rollback.pin);
    assert.equal(readFileSync(updatedA.manifestPath, 'utf8'), rollback.manifest);
    assert.equal(readFileSync(path.join(a.project, '.gitignore'), 'utf8'), rollback.ignore);
    assert.equal(hashFile(path.join(a.project, '.agents', 'skills', 'pk-setup', 'SKILL.md')), rollback.skill);
    assert.equal(realpathSync(path.join(a.project, '.agents', 'skills', 'pk-setup', 'produktiv')), rollback.link);

    const removedC = uninstall({ project: c.project, home });
    assert.equal(removedC.ok, true);
    assert.equal(existsSync(installedB.canonicalPackageRoot), true);
    assert.deepEqual(await assertHealthy(b.project, installedB.canonicalPackageRoot), bBefore);

    const removedA = uninstall({ project: a.project, home });
    assert.equal(removedA.ok, true);
    assert.equal(existsSync(installedA.canonicalPackageRoot), true);
    assert.equal(existsSync(updatedA.canonicalPackageRoot), true);
    assert.equal(existsSync(path.join(a.project, 'produktiv-lock.json')), true);
    assert.equal(readFileSync(path.join(a.project, '.gitignore'), 'utf8'), 'dist/\n');
    assertProjectStateUnchanged(a);
    assert.deepEqual(await assertHealthy(b.project, installedB.canonicalPackageRoot), bBefore);

    const coldHome = path.join(root, 'cold-home');
    mkdirSync(coldHome);
    const clone = createProject(root, 'cold-clone');
    writeFileSync(path.join(clone.project, 'produktiv-lock.json'), bPinBefore);
    const cold = await install({ source: releaseAPath, project: clone.project, home: coldHome });
    assertPin(clone.project, releaseA);
    assert.equal(cold.releaseDigest, releaseA.digest);
    assert.ok(cold.canonicalPackageRoot.startsWith(realpathSync(coldHome) + path.sep));
    await assertHealthy(clone.project, cold.canonicalPackageRoot);

    const collision = createProject(root, 'collision');
    mkdirSync(path.join(collision.project, '.agents', 'skills', 'pk-setup'), { recursive: true });
    writeFileSync(path.join(collision.project, '.agents', 'skills', 'pk-setup', 'SKILL.md'), 'foreign setup\n');
    await assert.rejects(
      () => install({ source: releaseAPath, project: collision.project, home }),
      (error) => error.code === 'skill-collision',
    );
    assert.equal(readFileSync(path.join(collision.project, '.agents', 'skills', 'pk-setup', 'SKILL.md'), 'utf8'), 'foreign setup\n');
    assert.equal(existsSync(path.join(collision.project, 'produktiv-lock.json')), false);

    const corruptSource = path.join(root, 'corrupt-source');
    cpSync(releaseAPath, corruptSource, { recursive: true });
    writeFileSync(path.join(corruptSource, 'references', 'capabilities.md'), 'tampered\n');
    const corruptProject = createProject(root, 'corrupt-source-project');
    await assert.rejects(
      () => install({ source: corruptSource, project: corruptProject.project, home: path.join(root, 'corrupt-source-home') }),
      (error) => error.code === 'release',
    );
    assert.equal(existsSync(path.join(corruptProject.project, 'produktiv-lock.json')), false);

    const corruptReceiptSource = path.join(root, 'corrupt-receipt-source');
    cpSync(releaseAPath, corruptReceiptSource, { recursive: true });
    const corruptReceiptPath = path.join(corruptReceiptSource, '.produktiv-release.json');
    const corruptReceipt = readJson(corruptReceiptPath);
    corruptReceipt.legacyAgentInventory[0].sha256 = '0'.repeat(64);
    writeFileSync(corruptReceiptPath, `${JSON.stringify(corruptReceipt, null, 2)}\n`);
    const corruptReceiptProject = createProject(root, 'corrupt-receipt-project');
    await assert.rejects(
      () => install({
        source: corruptReceiptSource,
        project: corruptReceiptProject.project,
        home: path.join(root, 'corrupt-receipt-home'),
      }),
      (error) => error.code === 'release',
    );
    assert.equal(existsSync(path.join(corruptReceiptProject.project, 'produktiv-lock.json')), false);

    const corruptHome = path.join(root, 'corrupt-store-home');
    const corruptInstalledProject = createProject(root, 'corrupt-store-installed');
    const corruptInstalled = await install({ source: releaseAPath, project: corruptInstalledProject.project, home: corruptHome });
    writeFileSync(path.join(corruptInstalled.canonicalPackageRoot, 'references', 'capabilities.md'), 'tampered stored bytes\n');
    const corruptClone = createProject(root, 'corrupt-store-clone');
    writeFileSync(
      path.join(corruptClone.project, 'produktiv-lock.json'),
      readFileSync(path.join(corruptInstalledProject.project, 'produktiv-lock.json')),
    );
    await assert.rejects(
      () => install({ source: releaseAPath, project: corruptClone.project, home: corruptHome }),
      (error) => error.code === 'pin-resolution',
    );

    const migrationResults = {};
    for (const mode of ['clean', 'edited', 'tracked']) {
      const state = createProject(root, `legacy-${mode}`);
      const legacyRoot = writeLegacyLayout(state, releaseAPath, mode);
      const beforeStatus = mode === 'tracked' ? runGit(state.project, ['status', '--porcelain', '--untracked-files=all']) : null;
      const migrated = await install({ source: releaseAPath, project: state.project, home });
      migrationResults[mode] = migrated.migration;
      if (mode === 'clean') {
        assert.equal(migrated.migration.state, 'removed');
        assert.equal(path.resolve(migrated.migration.path), realpathSync(path.dirname(legacyRoot)) + path.sep + path.basename(legacyRoot));
        assert.equal(existsSync(legacyRoot), false);
      } else {
        assert.equal(migrated.migration.state, 'retained');
        assert.equal(migrated.migration.reason, mode === 'edited' ? 'edited-or-unknown' : 'tracked');
        assert.equal(existsSync(legacyRoot), true);
      }
      if (mode === 'tracked') {
        const afterStatus = runGit(state.project, ['status', '--porcelain', '--untracked-files=all']);
        assert.ok(afterStatus.includes('A  .agents/packages/produktiv/references/capabilities.md'));
        assert.ok(beforeStatus.includes('A  .agents/packages/produktiv/references/capabilities.md'));
      }
    }

    writeReceipt({
      releaseA: {
        ...releaseA,
        files: releaseA.inventory.filter((entry) => entry.type === 'file').length,
        bytes: treeBytes(releaseAPath),
      },
      releaseB: {
        ...releaseB,
        files: releaseB.inventory.filter((entry) => entry.type === 'file').length,
        bytes: treeBytes(releaseBPath),
      },
      active,
      historicalExcluded: historical.length,
      footprint,
      migrationResults,
    });
  } finally {
    process.env.PATH = savedPath;
    rmSync(root, { recursive: true, force: true });
  }
});
