/**
 * Thin bootstrap delivery proof.
 *
 * The generic installer only copies skill directories. This suite installs the
 * thin bootstrap into temporary Cursor homes, smokes the installed skill, and
 * writes a receipt to a temporary file.
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildRelease } from '../../scripts/release.mjs';
import { findDeliveryBaggage, treeBytes } from '../../scripts/package-image.mjs';
import {
  BootstrapError,
  SKILL_LINK_NAME,
  assessSkill,
  install,
  layoutFor,
  linkTarget,
  nodeMajor,
  SKILLS_CLI,
  uninstall,
  update,
} from '../../scripts/bootstrap.mjs';

const workflowDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const repoRoot = path.resolve(workflowDir, '..');
const receiptPath = path.join(tmpdir(), `produktiv-bootstrap-current-${process.pid}.md`);
const sourceSkill = path.join(workflowDir, 'skills', 'pk-setup', 'SKILL.md');
const GRAPH_BYTE_CEILING = 60 * 1024 * 1024;

function tempDir(label) {
  return mkdtempSync(path.join(tmpdir(), `produktiv-bootstrap-${label}-`));
}

function writeTinySource(dir) {
  const probe = path.join(dir, 'skills', 'skill-probe');
  mkdirSync(probe, { recursive: true });
  writeFileSync(path.join(probe, 'SKILL.md'), '---\nname: skill-probe\ndescription: probe\n---\n\nWhen this skill is invoked, reply with exactly this token and nothing else: produktiv-skill-probe-ok\n');
  mkdirSync(path.join(dir, 'references'), { recursive: true });
  mkdirSync(path.join(dir, 'templates'), { recursive: true });
  writeFileSync(
    path.join(dir, 'references', 'capabilities.md'),
    '# Capability Registry\n\nTiny core fixture.\n',
  );
  writeFileSync(path.join(dir, 'templates', 'gitignore-workflow.txt'), '# tiny\n');
  writeFileSync(path.join(dir, 'README.md'), '# Tiny core fixture\n');
  writeFileSync(
    path.join(dir, 'package.json'),
    `${JSON.stringify({ name: 'produktiv-workflow', version: '0.1.0' })}\n`,
  );
}

function writeSkill(project, name = 'skill-probe') {
  const dir = path.join(project, '.agents', 'skills', name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, 'SKILL.md'),
    '---\nname: skill-probe\ndescription: probe\n---\n\nWhen this skill is invoked, reply with exactly this token and nothing else: produktiv-skill-probe-ok\n',
  );
  return dir;
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function gitStatus() {
  const result = spawnSync('git', ['status', '--porcelain'], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.split('\n').filter(Boolean).sort();
}

function findNode22() {
  if (nodeMajor() >= 22) return process.execPath;
  const nvm = path.join(homedir(), '.nvm', 'versions', 'node');
  if (!existsSync(nvm)) return null;
  const versions = readdirSync(nvm)
    .filter((name) => /^v(\d+)\./.test(name) && Number(/^v(\d+)\./.exec(name)[1]) >= 22)
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
  if (versions.length === 0) return null;
  const bin = path.join(nvm, versions[versions.length - 1], 'bin', 'node');
  return existsSync(bin) ? bin : null;
}

function homeSnapshot() {
  const agents = path.join(homedir(), '.agents', 'skills');
  const cursor = path.join(homedir(), '.cursor', 'skills');
  const names = (dir) => (existsSync(dir) ? readdirSync(dir).sort() : null);
  return { agents: names(agents), cursor: names(cursor) };
}

test('the skills CLI is pinned to an exact release', () => {
  assert.match(SKILLS_CLI, /^skills@\d+\.\d+\.\d+$/);
  const source = readFileSync(path.join(workflowDir, 'scripts', 'bootstrap.mjs'), 'utf8');
  assert.doesNotMatch(source, /\['--yes', 'skills'/);
  // Without an explicit --package an outer `npm exec --package` hijacks this npx.
  assert.ok(source.includes("['--yes', `--package=${SKILLS_CLI}`, '--', 'skills', ...args]"));
});

test('link targets are computed per host layout', () => {
  const projectSkill = '/any/project/.agents/skills/skill-probe';
  const projectPackage = '/any/project/.agents/packages/produktiv';
  const globalSkill = '/Users/someone/.agents/skills/skill-probe';
  const globalPackage = '/Users/someone/.agents/packages/produktiv';
  const deepSkill = '/any/project/.agents/plugins/cache/skills/skill-probe';
  assert.equal(linkTarget(projectSkill, projectPackage), '../../packages/produktiv');
  assert.equal(linkTarget(globalSkill, globalPackage), '../../packages/produktiv');
  assert.equal(linkTarget(deepSkill, projectPackage), '../../../../packages/produktiv');
  assert.notEqual(linkTarget(projectSkill, projectPackage), linkTarget(deepSkill, projectPackage));

  const project = tempDir('layout-project');
  const home = tempDir('layout-home');
  try {
    const projectLayout = layoutFor({ host: 'cursor', scope: 'project', project, home });
    const globalLayout = layoutFor({ host: 'cursor', scope: 'global', home });
    const releaseRoot = path.join(projectLayout.storeRoot, '0.1.0', 'a'.repeat(64));
    const projectLink = linkTarget(path.join(projectLayout.skillsDir, 'skill-probe'), releaseRoot);
    const globalLink = linkTarget(path.join(globalLayout.skillsDir, 'skill-probe'), releaseRoot);
    assert.match(projectLink, /releases\/0\.1\.0\/a{64}$/);
    assert.match(globalLink, /releases\/0\.1\.0\/a{64}$/);
    assert.equal(projectLayout.storeRoot, globalLayout.storeRoot);
    assert.equal(projectLayout.packageRoot, null);
    assert.equal(SKILL_LINK_NAME, 'produktiv');
  } finally {
    rmSync(project, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

test('a foreign package path is left untouched', async () => {
  const source = tempDir('foreign-source');
  const project = tempDir('foreign-project');
  const home = tempDir('foreign-home');
  try {
    writeTinySource(source);
    const blocked = path.join(project, '.agents', 'skills', 'skill-probe');
    mkdirSync(blocked, { recursive: true });
    writeFileSync(path.join(blocked, 'SKILL.md'), '---\nname: skill-probe\ndescription: foreign\n---\n');
    await assert.rejects(
      () => install({ source, project, home, register: false }),
      (error) => error instanceof BootstrapError && error.code === 'skill-collision',
    );
    assert.match(readFileSync(path.join(blocked, 'SKILL.md'), 'utf8'), /foreign/);
    assert.equal(existsSync(path.join(project, '.agents', 'packages', 'produktiv.ownership.json')), false);
  } finally {
    rmSync(source, { recursive: true, force: true });
    rmSync(project, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

test('an external-store path resolving into the project is rejected', async () => {
  const source = tempDir('overlap-source');
  const project = tempDir('overlap-project');
  const home = tempDir('overlap-home');
  try {
    writeTinySource(source);
    writeSkill(project);
    const target = path.join(project, 'private-store');
    mkdirSync(target);
    const alias = path.join(home, 'store-alias');
    symlinkSync(target, alias);
    await assert.rejects(
      () => install({ source, project, home, storeRoot: path.join(alias, 'releases'), register: false }),
      (error) => error instanceof BootstrapError && error.code === 'store-overlap',
    );
    assert.equal(existsSync(path.join(project, 'produktiv-lock.json')), false);
  } finally {
    rmSync(source, { recursive: true, force: true });
    rmSync(project, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

test('core survives missing bundles, a missing link, and absent Node', async () => {
  const source = tempDir('core-source');
  const project = tempDir('core-project');
  const home = tempDir('core-home');
  try {
    writeTinySource(source);
    const skillDir = writeSkill(project);
    const installed = await install({ source, project, home, register: false });
    assert.equal(installed.ok, true);
    assert.equal(installed.surfaces.core.ok, true);
    assert.equal(installed.surfaces.graph.ok, false);
    assert.equal(installed.surfaces.graph.reason, 'not-in-source');
    assert.equal(installed.surfaces.diagram.ok, false);
    assert.equal(installed.surfaces.diagram.reason, 'not-in-source');
    assert.equal(existsSync(path.join(project, '.workflow')), false);

    const absent = await assessSkill(skillDir, { nodeAvailable: false });
    assert.equal(absent.core.available, true);
    assert.equal(absent.graph.reason, 'node-absent');
    assert.equal(absent.diagram.reason, 'node-absent');

    const link = path.join(skillDir, 'produktiv');
    rmSync(link);
    const missing = await assessSkill(skillDir, { nodeAvailable: true, nodeMajor: 22 });
    assert.equal(missing.core.available, false);
    assert.equal(missing.core.reason, 'missing-package');
    assert.equal(missing.graph.reason, 'missing-package');
    assert.equal(missing.diagram.reason, 'missing-package');
  } finally {
    rmSync(source, { recursive: true, force: true });
    rmSync(project, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

test('a failed update smoke leaves the active package and project files in place', async () => {
  const source = tempDir('smoke-source');
  const project = tempDir('smoke-project');
  const home = tempDir('smoke-home');
  try {
    writeTinySource(source);
    writeSkill(project);
    const installed = await install({ source, project, home, register: false });
    const sentinelDir = path.join(project, '.workflow', 'context');
    mkdirSync(sentinelDir, { recursive: true });
    const sentinel = path.join(sentinelDir, 'project.md');
    writeFileSync(sentinel, 'produktiv-bootstrap-sentinel project\n');
    const before = sha256(sentinel);
    await assert.rejects(
      () => update({ source, project, home, register: false, smoke: () => { throw new Error('boom'); } }),
      (error) => error instanceof BootstrapError && error.code === 'smoke-failed',
    );
    assert.equal(JSON.parse(readFileSync(path.join(project, 'produktiv-lock.json'), 'utf8')).digest, installed.releaseDigest);
    assert.equal(sha256(sentinel), before);
    assert.equal(readdirSync(path.join(home, '.agents', 'packages', 'produktiv', 'releases')).some((name) => name.startsWith('.produktiv-next-')), false);
  } finally {
    rmSync(source, { recursive: true, force: true });
    rmSync(project, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

test('install does not activate a manually changed pin over an existing installation', async () => {
  const source = tempDir('pin-mismatch-source');
  const project = tempDir('pin-mismatch-project');
  const home = tempDir('pin-mismatch-home');
  try {
    writeTinySource(source);
    writeSkill(project);
    const installed = await install({ source, project, home, register: false });
    const manifestBefore = readFileSync(installed.manifestPath, 'utf8');
    const link = path.join(project, '.agents', 'skills', 'skill-probe', 'produktiv');
    const rootBefore = realpathSync(link);
    const pinPath = path.join(project, 'produktiv-lock.json');
    const pin = JSON.parse(readFileSync(pinPath, 'utf8'));
    pin.digest = 'b'.repeat(64);
    writeFileSync(pinPath, `${JSON.stringify(pin, null, 2)}\n`);
    await assert.rejects(
      () => install({ source, project, home, register: false }),
      (error) => error instanceof BootstrapError && error.code === 'pin-mismatch',
    );
    assert.equal(readFileSync(installed.manifestPath, 'utf8'), manifestBefore);
    assert.equal(realpathSync(link), rootBefore);
  } finally {
    rmSync(source, { recursive: true, force: true });
    rmSync(project, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

test('uninstall removes only manifest-owned paths', async () => {
  const source = tempDir('uninstall-source');
  const project = tempDir('uninstall-project');
  const home = tempDir('uninstall-home');
  try {
    writeTinySource(source);
    const skillDir = writeSkill(project);
    const installed = await install({ source, project, home, register: false });
    const projectSentinel = path.join(project, '.workflow', 'context', 'project.md');
    const planSentinel = path.join(project, 'docs', 'plans', 'farewell.md');
    mkdirSync(path.dirname(projectSentinel), { recursive: true });
    mkdirSync(path.dirname(planSentinel), { recursive: true });
    writeFileSync(projectSentinel, 'produktiv-bootstrap-sentinel project\n');
    writeFileSync(planSentinel, 'produktiv-bootstrap-sentinel plan\n');
    const outcome = uninstall({ project, home });
    assert.equal(outcome.ok, true);
    assert.equal(readFileSync(projectSentinel, 'utf8'), 'produktiv-bootstrap-sentinel project\n');
    assert.equal(readFileSync(planSentinel, 'utf8'), 'produktiv-bootstrap-sentinel plan\n');
    assert.equal(existsSync(installed.canonicalPackageRoot), true);
    assert.equal(existsSync(skillDir), false);
    assert.equal(existsSync(path.join(project, 'produktiv-lock.json')), true);
    assert.equal(existsSync(path.join(project, '.agents')), false, 'empty install directories are removed');
  } finally {
    rmSync(source, { recursive: true, force: true });
    rmSync(project, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

test('uninstall keeps an install directory that still holds a file it does not own', async () => {
  const source = tempDir('uninstall-keep-source');
  const project = tempDir('uninstall-keep-project');
  const home = tempDir('uninstall-keep-home');
  try {
    writeTinySource(source);
    writeSkill(project);
    await install({ source, project, home, register: false });
    const foreign = path.join(project, '.agents', 'skills', 'their-skill', 'SKILL.md');
    mkdirSync(path.dirname(foreign), { recursive: true });
    writeFileSync(foreign, 'not ours\n');
    const outcome = uninstall({ project, home });
    assert.equal(outcome.ok, true);
    assert.equal(readFileSync(foreign, 'utf8'), 'not ours\n');
    assert.equal(existsSync(path.join(project, '.agents', 'packages')), false);
  } finally {
    rmSync(source, { recursive: true, force: true });
    rmSync(project, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

test('an edited managed ignore block is preserved and keeps the ownership manifest', async () => {
  const source = tempDir('ignore-source');
  const project = tempDir('ignore-project');
  const home = tempDir('ignore-home');
  try {
    writeTinySource(source);
    writeSkill(project);
    const installed = await install({ source, project, home, register: false });
    const ignore = path.join(project, '.gitignore');
    writeFileSync(
      ignore,
      readFileSync(ignore, 'utf8').replace(
        '# End Produktiv installer registrations',
        '# user edit inside ownership boundary\n# End Produktiv installer registrations',
      ),
    );
    const outcome = uninstall({ project, home });
    assert.equal(outcome.ok, false);
    assert.ok(outcome.refused.some((entry) => entry.reason === 'edited-ignore-block'));
    assert.equal(existsSync(installed.manifestPath), true);
    assert.match(readFileSync(ignore, 'utf8'), /user edit inside ownership boundary/);
    assert.equal(existsSync(installed.canonicalPackageRoot), true);
  } finally {
    rmSync(source, { recursive: true, force: true });
    rmSync(project, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

test('existing exact ignore rules are not duplicated and survive uninstall', async () => {
  const source = tempDir('existing-ignore-source');
  const project = tempDir('existing-ignore-project');
  const home = tempDir('existing-ignore-home');
  const original = 'dist/\n/.agents/skills/skill-probe/\n';
  try {
    writeTinySource(source);
    writeSkill(project);
    writeFileSync(path.join(project, '.gitignore'), original);
    await install({ source, project, home, register: false });
    const installedIgnore = readFileSync(path.join(project, '.gitignore'), 'utf8');
    assert.equal(installedIgnore.match(/\/\.agents\/skills\/skill-probe\//g)?.length, 1);
    assert.equal(uninstall({ project, home }).ok, true);
    assert.equal(readFileSync(path.join(project, '.gitignore'), 'utf8'), original);
  } finally {
    rmSync(source, { recursive: true, force: true });
    rmSync(project, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

test('Cursor project and global delivery', { timeout: 300000 }, async () => {
  const project = tempDir('cursor-project');
  const home = tempDir('cursor-home');
  const releaseParent = tempDir('release');
  const deliverySource = path.join(releaseParent, 'release');
  const statusBefore = gitStatus();
  const userHomeBefore = homeSnapshot();
  let failed = true;
  const evidence = {};
  try {
    await buildRelease({ source: workflowDir, output: deliverySource });
    const sourceBytes = treeBytes(path.join(workflowDir, 'vendor', 'understand-anything'));
    const installed = await install({
      source: deliverySource,
      project,
      host: 'cursor',
      scope: 'project',
      home,
    });
    assert.equal(installed.ok, true, JSON.stringify(installed.smokes));
    assert.equal(installed.surfaces.core.ok, true);
    assert.equal(installed.surfaces.graph.ok, true, installed.surfaces.graph.detail);
    assert.equal(installed.surfaces.diagram.ok, true, installed.surfaces.diagram.detail);
    assert.equal(installed.smokes.discovery.ok, true, JSON.stringify(installed.smokes.discovery));
    assert.equal(installed.smokes.discovery.via, 'skills-cli');
    assert.ok(installed.smokes.discovery.skills.some((skill) => skill.name==='pk-setup'));
    assert.equal(installed.surfaces.graph.bytes < GRAPH_BYTE_CEILING, true, String(installed.surfaces.graph.bytes));
    assert.equal(installed.surfaces.graph.bytes > 10 * 1024 * 1024, true, String(installed.surfaces.graph.bytes));
    assert.deepEqual(findDeliveryBaggage(installed.canonicalPackageRoot), []);
    assert.equal(existsSync(path.join(project, '.workflow')), false);
    assert.equal(existsSync(path.join(project, 'docs')), false);

    const skillDir = realpathSync(path.join(project, '.agents', 'skills', 'pk-setup'));
    const link = path.join(skillDir, 'produktiv');
    assert.equal(lstatSync(link).isSymbolicLink(), true);
    assert.equal(readlinkSync(link), linkTarget(skillDir, installed.canonicalPackageRoot));
    assert.equal(sha256(path.join(skillDir, 'SKILL.md')), sha256(sourceSkill));
    assert.match(readFileSync(path.join(link, 'references', 'capabilities.md'), 'utf8'), /Capabilities for this session/);
    assert.match(readFileSync(path.join(link, 'vendor', 'archify', 'assets', 'template.html'), 'utf8'), /data:font\/woff2/);
    const names = readdirSync(skillDir).sort();
    assert.deepEqual(names, ['SKILL.md', 'produktiv']);

    const marker = path.join(installed.canonicalPackageRoot, '.produktiv-package.json');
    const markerMtime = statSync(marker).mtimeMs;
    const again = await install({ source: deliverySource, project, host: 'cursor', scope: 'project', home });
    assert.equal(again.idempotent, true);
    assert.equal(again.releaseDigest, installed.releaseDigest);
    assert.equal(statSync(marker).mtimeMs, markerMtime);
    assert.deepEqual(readdirSync(path.join(project, '.agents', 'packages')), ['produktiv.ownership.json']);
    assert.equal(existsSync(path.join(project, 'produktiv-lock.json')), true);
    assert.match(readFileSync(path.join(project, '.gitignore'), 'utf8'), /Produktiv installer registrations \(managed\)/);

    const absent = await assessSkill(skillDir, { nodeAvailable: false });
    assert.equal(absent.core.available, true);
    assert.equal(absent.graph.reason, 'node-absent');
    assert.equal(absent.diagram.reason, 'node-absent');
    const floor = await assessSkill(skillDir, { nodeAvailable: true, nodeMajor: 20 });
    assert.equal(floor.core.available, true);
    assert.equal(floor.graph.reason, 'node-floor');
    assert.equal(floor.diagram.available, true);

    const wasm = path.join(
      installed.canonicalPackageRoot,
      'vendor',
      'understand-anything',
      'node_modules',
      'tree-sitter-typescript',
      'tree-sitter-typescript.wasm',
    );
    const wasmBytes = readFileSync(wasm);
    rmSync(wasm);
    const brokenGraph = await assessSkill(skillDir, { nodeAvailable: true, nodeMajor: 22 });
    assert.equal(brokenGraph.core.available, true);
    assert.equal(brokenGraph.graph.reason, 'missing-runtime');
    assert.equal(brokenGraph.diagram.available, true);
    writeFileSync(wasm, wasmBytes);

    const template = path.join(installed.canonicalPackageRoot, 'vendor', 'archify', 'assets', 'template.html');
    const templateBytes = readFileSync(template);
    rmSync(template);
    const brokenDiagram = await assessSkill(skillDir, { nodeAvailable: true, nodeMajor: 22 });
    assert.equal(brokenDiagram.core.available, true);
    assert.equal(brokenDiagram.graph.available, true);
    assert.equal(brokenDiagram.diagram.reason, 'missing-runtime');
    writeFileSync(template, templateBytes);

    rmSync(link);
    const missingLink = await assessSkill(skillDir, { nodeAvailable: true, nodeMajor: 22 });
    assert.equal(missingLink.core.reason, 'missing-package');
    assert.equal(missingLink.graph.reason, 'missing-package');

    const projectSentinel = path.join(project, '.workflow', 'context', 'project.md');
    const planSentinel = path.join(project, 'docs', 'plans', 'farewell.md');
    mkdirSync(path.dirname(projectSentinel), { recursive: true });
    mkdirSync(path.dirname(planSentinel), { recursive: true });
    const projectText = 'produktiv-bootstrap-sentinel project\n';
    const planText = 'produktiv-bootstrap-sentinel plan\n';
    writeFileSync(projectSentinel, projectText);
    writeFileSync(planSentinel, planText);
    const projectHash = sha256(projectSentinel);
    const planHash = sha256(planSentinel);

    const updated = await update({ source: deliverySource, project, host: 'cursor', scope: 'project', home });
    assert.equal(updated.ok, true, JSON.stringify(updated.smokes));
    assert.equal(readlinkSync(link), updated.links[0].target);
    assert.equal(sha256(projectSentinel), projectHash);
    assert.equal(sha256(planSentinel), planHash);
    assert.equal(updated.releaseDigest, installed.releaseDigest);

    rmSync(link);
    const relinked = await update({ source: deliverySource, project, host: 'cursor', scope: 'project', home });
    assert.equal(relinked.ok, true);
    assert.equal(lstatSync(link).isSymbolicLink(), true);
    assert.equal(readlinkSync(link), linkTarget(skillDir, relinked.canonicalPackageRoot));
    assert.equal(sha256(projectSentinel), projectHash);
    assert.equal(sha256(planSentinel), planHash);
    assert.equal(sha256(path.join(skillDir, 'SKILL.md')), sha256(sourceSkill));

    const node22 = findNode22();
    assert.ok(node22, 'Node 22 is required to load the installed WASM image');
    const plugin = path.join(link, 'vendor', 'understand-anything', 'dist', 'plugins', 'tree-sitter-plugin.js');
    const loader = pathToFileURL(path.join(workflowDir, 'scripts', 'bootstrap.mjs')).href;
    const child = spawnSync(
      node22,
      [
        '--input-type=module',
        '-e',
        [
          `import { loadInstalledGraph } from ${JSON.stringify(loader)};`,
          'const result = await loadInstalledGraph(process.env.PRODUKTIV_PLUGIN);',
          'console.log(JSON.stringify({ ok: result.ok, specs: result.specs }));',
        ].join('\n'),
      ],
      {
        encoding: 'utf8',
        timeout: 180000,
        env: { ...process.env, PRODUKTIV_PLUGIN: plugin },
      },
    );
    assert.equal(child.status, 0, `${child.stdout}\n${child.stderr}`);
    const loaded = JSON.parse(child.stdout.trim().split('\n').at(-1));
    assert.equal(loaded.ok, true);
    for (const spec of [
      'web-tree-sitter',
      'web-tree-sitter/web-tree-sitter.wasm',
      'tree-sitter-typescript/tree-sitter-typescript.wasm',
      'tree-sitter-typescript/tree-sitter-tsx.wasm',
      '@understand-anything/tree-sitter-swift-wasm/tree-sitter-swift.wasm',
      '@understand-anything/tree-sitter-dart-wasm/tree-sitter-dart.wasm',
    ]) {
      assert.equal(loaded.specs.includes(spec), true, spec);
    }

    const manifest = readFileSync(relinked.manifestPath, 'utf8');
    assert.equal(manifest.includes('.workflow'), false);
    assert.equal(manifest.includes('docs/plans'), false);
    assert.equal(manifest.includes('docs/issues'), false);
    assert.equal(manifest.includes('docs/specs'), false);
    assert.equal(manifest.includes('docs/adr'), false);

    const removed = uninstall({ project, host: 'cursor', scope: 'project', home });
    assert.equal(removed.ok, true, JSON.stringify(removed.refused));
    assert.equal(existsSync(relinked.canonicalPackageRoot), true);
    assert.equal(existsSync(link), false);
    assert.equal(existsSync(skillDir), false);
    assert.equal(existsSync(path.join(project, 'skills-lock.json')), false);
    assert.equal(existsSync(path.join(project, 'produktiv-lock.json')), true);
    assert.equal(existsSync(path.join(project, '.gitignore')), false);
    assert.equal(readFileSync(projectSentinel, 'utf8'), projectText);
    assert.equal(readFileSync(planSentinel, 'utf8'), planText);

    const globalInstall = await install({
      source: deliverySource,
      host: 'cursor',
      scope: 'global',
      home,
    });
    assert.equal(globalInstall.ok, true, JSON.stringify(globalInstall.smokes));
    assert.equal(globalInstall.surfaces.graph.ok, true, globalInstall.surfaces.graph.detail);
    const globalSkill = realpathSync(path.join(home, '.agents', 'skills', 'pk-setup'));
    const globalLink = path.join(globalSkill, 'produktiv');
    assert.equal(readlinkSync(globalLink), linkTarget(globalSkill, globalInstall.canonicalPackageRoot));
    assert.equal(globalInstall.canonicalPackageRoot, installed.canonicalPackageRoot);
    const globalRemoved = uninstall({ host: 'cursor', scope: 'global', home });
    assert.equal(globalRemoved.ok, true);
    assert.equal(existsSync(globalInstall.canonicalPackageRoot), true);
    assert.deepEqual(homeSnapshot(), userHomeBefore);

    evidence.installed = installed;
    evidence.updated = relinked;
    evidence.loaded = loaded;
    evidence.node22 = node22;
    evidence.sourceBytes = sourceBytes;
    evidence.project = project;
    evidence.home = home;
    evidence.projectHash = projectHash;
    evidence.planHash = planHash;
    writeReceipt(evidence);
    const statusAfter = gitStatus();
    const unexpected = statusAfter.filter(
      (line) => !statusBefore.includes(line) && !line.endsWith('workflow/evals/distribution/bootstrap-current.md'),
    );
    assert.deepEqual(unexpected, []);
    assert.equal(existsSync(receiptPath), true);
    assert.equal(existsSync(path.join(repoRoot, '.agents')), false);
    assert.equal(existsSync(path.join(repoRoot, 'skills-lock.json')), false);
    rmSync(receiptPath, { force: true });
    failed = false;
  } finally {
    if (!failed) {
      rmSync(project, { recursive: true, force: true });
      rmSync(home, { recursive: true, force: true });
      rmSync(releaseParent, { recursive: true, force: true });
    } else {
      console.error(`bootstrap left project ${project}`);
      console.error(`bootstrap left home ${home}`);
    }
  }
});

function writeReceipt(evidence) {
  const { installed, updated, loaded, node22, sourceBytes } = evidence;
  const lines = [
    '# Thin bootstrap on the external-store layout',
    '',
    '**Result:** pass',
    `**Date:** ${new Date().toISOString().slice(0, 10)}`,
    '**Host:** Cursor, project scope in a temporary directory, then global scope in a temporary home. The user profile was not modified.',
    '',
    'This bootstrap covers core, graph and diagram delivery. Core success does not depend on graph or diagram.',
    '',
    '## Installer',
    '',
    '| Field | Value |',
    '|---|---|',
    `| Skills CLI | ${installed.skillsVersion ?? 'unknown'} (\`npx --yes skills\`) |`,
    `| Bootstrap | \`workflow/scripts/bootstrap.mjs\` |`,
    `| Package version | ${installed.packageVersion} |`,
    `| Release digest | ${installed.releaseDigest} |`,
    `| Host / scope | ${installed.host} / ${installed.scope} |`,
    `| Canonical package root | \`${installed.canonicalPackageRoot}\` |`,
    `| Node for install | ${process.version} |`,
    `| Node for WASM load | ${node22} |`,
    '',
    'The generic installer still registers skills. Bootstrap registers the current public skills and updates their SKILL.md together with the shared image. This run consumes a prepared release built from `workflow/`; registration reads only its public `skills/` inventory.',
    '',
    'Cursor project skills stay in `<project>/.agents/skills/<skill>/`. The immutable package root is resolved outside the project at `<home>/.agents/packages/produktiv/releases/<version>/<sha256>/`; project and global registrations can share those verified bytes. Every registration computes its relative link target from its actual directory. The project keeps only the shareable `produktiv-lock.json`, the ignored ownership manifest and the lightweight discovery registrations.',
    '',
    '## Image',
    '',
    '| Surface | Bytes | Result |',
    '|---|---:|---|',
    `| Core shared files | ${installed.surfaces.core.bytes} | pass |`,
    `| Graph runtime | ${installed.surfaces.graph.bytes} | pass |`,
    `| Diagram runtime | ${installed.surfaces.diagram.bytes} | pass |`,
    `| Source \`vendor/understand-anything\` tree | ${sourceBytes} | not shipped |`,
    '',
    `The source vendor tree is ${sourceBytes} bytes, including the dev/npm install. The delivered graph image is ${installed.surfaces.graph.bytes} bytes. It keeps \`dist/\` JavaScript, the extract scripts, \`wasm/\`, LICENSE, THIRD-PARTY, \`web-tree-sitter\`, grammar package metadata and \`.wasm\` files, and the \`ignore\` / \`yaml\` / \`zod\` modules the runtime imports. Native \`.node\` prebuilds, grammar sources, tests, and source maps are absent. The bundle weight check passes for this install model: the prebuilt image does not need an upstream monorepo build.`,
    '',
    '## Links',
    '',
    ...updated.links.map((link) => `- \`${link.skill}\` \`${link.path}\` → \`${link.target}\``),
    '',
    '## Smokes',
    '',
    '| Check | Result |',
    '|---|---|',
    `| \`skills list --json -a cursor\` finds setup from the public skill inventory | pass |`,
    '| Installed setup SKILL.md matches the public release bytes | pass |',
    '| `produktiv/references/capabilities.md` reads through the link | pass |',
    '| Template, diagram adapter `supports(\'architecture\')`, five renderers, schemas, validators, delta, checker, LICENSE, OFL | pass |',
    `| \`createRequire\` from the installed \`tree-sitter-plugin.js\` resolves web-tree-sitter, TypeScript, TSX, Swift, Dart, and the other grammars inside the package | pass |`,
    `| Node 22 \`Language.load\` of those grammars (${loaded.specs.length} specs) | pass |`,
    '| Idempotent install keeps the same release digest and does not add a second root | pass |',
    '| Node absent: core available, graph and diagram `node-absent` | pass |',
    '| Node 20: core and diagram available, graph `node-floor` | pass |',
    '| Removed TypeScript WASM: diagram and core stay available, graph `missing-runtime` | pass |',
    '| Removed template: graph and core stay available, diagram `missing-runtime` | pass |',
    '| Removed link: structured `missing-package`, no throw | pass |',
    '| One bootstrap update registers current skills and restores their missing package links | pass |',
    `| Sentinel \`.workflow/context/project.md\` unchanged by update and uninstall | \`${evidence.projectHash}\` |`,
    `| Sentinel \`docs/plans/farewell.md\` unchanged by update and uninstall | \`${evidence.planHash}\` |`,
    '| Uninstall removes verified project registrations and the ownership manifest, preserves the project pin and shared immutable release | pass |',
    '| Global scope install, link, and uninstall in a temporary home | pass |',
    '| Real `~/.agents/skills` and `~/.cursor/skills` unchanged | pass |',
    '',
    '## Project state',
    '',
    'Bootstrap did not create `.workflow/`, `docs/issues/`, `docs/plans/`, `docs/specs/`, or `docs/adr/`. The sentinels above were planted by the eval after install. Update and uninstall left both files byte-for-byte identical. The ownership manifest does not list those paths. A manifest entry that names `.workflow/` is refused. Release inventory and digest are verified before activation.',
    '',
    'The temporary project and home used for this run are deleted after the assertions. The canonical path above is the external immutable root from the run.',
    '',
  ];
  writeFileSync(receiptPath, lines.join('\n'));
}
