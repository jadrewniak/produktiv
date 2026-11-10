import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BootstrapError,
  assessSkill,
  install,
  layoutFor,
  uninstall,
  update,
} from '../../../scripts/bootstrap.mjs';
import {
  PACKAGE_MARKER_NAME,
  activeAgentResources,
  finalizeRelease,
  releaseInventory,
  verifyRelease,
} from '../../../scripts/package-image.mjs';
import { buildRelease } from '../../../scripts/release.mjs';

const workflow = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const REAL_SKILLS_CLI = process.env.PRODUKTIV_REAL_SKILLS === '1';
const HOSTS = [
  { id: 'cursor', skillsRoot: ['.agents', 'skills'] },
  { id: 'codex', skillsRoot: ['.agents', 'skills'] },
  { id: 'claude-code', skillsRoot: ['.claude', 'skills'] },
];

function runGit(project, args) {
  return execFileSync('git', args, { cwd: project, encoding: 'utf8' }).trim();
}

function hashFile(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function deriveRelease(source, output, version) {
  cpSync(source, output, { recursive: true, verbatimSymlinks: true });
  const previous = readJson(path.join(source, '.produktiv-release.json'));
  const packagePath = path.join(output, 'package.json');
  const packageJson = readJson(packagePath);
  packageJson.version = version;
  writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
  const markerPath = path.join(output, PACKAGE_MARKER_NAME);
  const marker = readJson(markerPath);
  marker.packageVersion = version;
  writeFileSync(markerPath, `${JSON.stringify(marker, null, 2)}\n`);
  const capabilities = path.join(output, 'references', 'capabilities.md');
  writeFileSync(capabilities, `${readFileSync(capabilities, 'utf8')}\nHost fixture: ${version}.\n`);
  return finalizeRelease(output, {
    version,
    skills: previous.skills,
    activeAgentResources: previous.activeAgentResources,
    legacyAgentInventory: previous.legacyAgentInventory,
    surfaces: previous.surfaces,
    grammarSpecs: previous.grammarSpecs,
  });
}

function mockSkillsCli(root) {
  const bin = path.join(root, 'bin');
  mkdirSync(bin, { recursive: true });
  const script = `#!${process.execPath}\n${String.raw`
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
const command = args[4];
const agentAt = args.indexOf('-a');
const agent = agentAt === -1 ? null : args[agentAt + 1];
const base = args.includes('-g') ? process.env.HOME : process.cwd();
const roots = {
  cursor: ['.agents', 'skills'],
  codex: ['.agents', 'skills'],
  'claude-code': ['.claude', 'skills'],
};
const agentLabel = agent === 'claude-code' ? 'Claude Code' : agent;
if (command === '--version') {
  console.log('9.9.9-fixture');
  process.exit(0);
}
if (!roots[agent]) process.exit(7);
const dest = path.join(base, ...roots[agent]);
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
    .map(name => ({ name, path: path.join(dest, name), agents: [agentLabel] })) : [];
  console.log(JSON.stringify(rows));
} else {
  process.exit(8);
}
`}`;
  writeFileSync(path.join(bin, 'npx'), script);
  chmodSync(path.join(bin, 'npx'), 0o755);
  return bin;
}

function createProject(root, host, name) {
  const project = path.join(root, `${host.id}-${name}`);
  const skillsRoot = path.join(project, ...host.skillsRoot);
  mkdirSync(path.join(project, '.workflow', 'context'), { recursive: true });
  mkdirSync(path.join(project, 'docs', 'plans'), { recursive: true });
  mkdirSync(path.join(skillsRoot, 'foreign-tool'), { recursive: true });
  writeFileSync(path.join(project, '.gitignore'), 'dist/\n');
  writeFileSync(path.join(project, '.workflow', 'context', 'project.md'), `# Project\n\nM6-01 sentinel ${host.id}.\n`);
  writeFileSync(path.join(project, 'docs', 'plans', 'farewell.md'), `# Farewell\n\nM6-01 plan sentinel ${host.id}.\n`);
  writeFileSync(
    path.join(skillsRoot, 'foreign-tool', 'SKILL.md'),
    '---\nname: foreign-tool\ndescription: foreign fixture\n---\n\nForeign skill.\n',
  );
  writeFileSync(
    path.join(project, 'skills-lock.json'),
    `${JSON.stringify({ version: 1, skills: { 'foreign-tool': { source: 'foreign' } } }, null, 2)}\n`,
  );
  runGit(project, ['init', '--quiet']);
  runGit(project, ['config', 'user.name', 'Host Eval']);
  runGit(project, ['config', 'user.email', 'm6-hosts@localhost']);
  runGit(project, ['add', '.']);
  runGit(project, ['commit', '--quiet', '-m', 'fixture']);
  return {
    project,
    skillsRoot,
    hashes: {
      workflow: hashFile(path.join(project, '.workflow', 'context', 'project.md')),
      plan: hashFile(path.join(project, 'docs', 'plans', 'farewell.md')),
      foreign: hashFile(path.join(skillsRoot, 'foreign-tool', 'SKILL.md')),
      lock: hashFile(path.join(project, 'skills-lock.json')),
    },
  };
}

function assertProjectState(state) {
  assert.equal(hashFile(path.join(state.project, '.workflow', 'context', 'project.md')), state.hashes.workflow);
  assert.equal(hashFile(path.join(state.project, 'docs', 'plans', 'farewell.md')), state.hashes.plan);
  assert.equal(hashFile(path.join(state.skillsRoot, 'foreign-tool', 'SKILL.md')), state.hashes.foreign);
  assert.equal(hashFile(path.join(state.project, 'skills-lock.json')), state.hashes.lock);
}

async function assertHealthy(state, expectedRoot) {
  const setup = path.join(state.skillsRoot, 'pk-setup');
  assert.equal(realpathSync(path.join(setup, 'produktiv')), realpathSync(expectedRoot));
  const status = await assessSkill(setup, { nodeAvailable: true, nodeMajor: 22 });
  assert.deepEqual(
    { core: status.core.available, graph: status.graph.available, diagram: status.diagram.available },
    { core: true, graph: true, diagram: true },
  );
  assert.deepEqual(
    await assessSkill(setup, { nodeAvailable: false }),
    {
      core: { available: true, reason: null },
      graph: { available: false, reason: 'node-absent' },
      diagram: { available: false, reason: 'node-absent' },
    },
  );
  return {
    capabilities: hashFile(path.join(setup, 'produktiv', 'references', 'capabilities.md')),
    rubric: hashFile(path.join(setup, 'produktiv', 'agents', 'plan-review', 'v8.md')),
  };
}

function visibleGitChanges(project) {
  return runGit(project, ['status', '--porcelain', '--untracked-files=all'])
    .split('\n')
    .filter(Boolean)
    .sort();
}

test('host layouts reject unsupported hosts', () => {
  assert.throws(
    () => layoutFor({ host: 'unknown', project: tmpdir() }),
    (error) => error instanceof BootstrapError && error.code === 'host',
  );
});

for (const host of HOSTS) {
  test(`deterministic install, update and uninstall on ${host.id}`, { timeout: 300000 }, async () => {
    const root = mkdtempSync(path.join(tmpdir(), `produktiv-m6-host-${host.id}-`));
    const savedPath = process.env.PATH;
    try {
      if (!REAL_SKILLS_CLI) {
        process.env.PATH = `${mockSkillsCli(root)}${path.delimiter}${savedPath}`;
      }
      const home = path.join(root, 'home');
      mkdirSync(home);
      const releaseAPath = path.join(root, 'release-a');
      const releaseBPath = path.join(root, 'release-b');
      const releaseA = await buildRelease({ source: workflow, output: releaseAPath });
      const releaseB = deriveRelease(releaseAPath, releaseBPath, `0.1.1-${host.id}`);
      verifyRelease(releaseAPath, releaseA);
      verifyRelease(releaseBPath, releaseB);
      assert.notEqual(releaseA.digest, releaseB.digest);

      const primary = createProject(root, host, 'primary');
      const peer = createProject(root, host, 'peer');
      const installed = await install({ host: host.id, source: releaseAPath, project: primary.project, home });
      const peerInstalled = await install({ host: host.id, source: releaseAPath, project: peer.project, home });

      assert.equal(installed.host, host.id);
      if (REAL_SKILLS_CLI) assert.match(installed.skillsVersion ?? '', /^\d+\.\d+\.\d+$/);
      else assert.equal(installed.skillsVersion, '9.9.9');
      assert.equal(installed.smokes.discovery.ok, true);
      assert.equal(installed.smokes.discovery.skills.length, 17);
      assert.equal(readdirSync(primary.skillsRoot).filter((name) => name !== 'foreign-tool').length, 17);
      assert.ok(installed.canonicalPackageRoot.startsWith(realpathSync(home) + path.sep));
      assert.equal(installed.canonicalPackageRoot.startsWith(realpathSync(primary.project) + path.sep), false);
      assert.equal(readJson(path.join(primary.project, 'produktiv-lock.json')).digest, releaseA.digest);
      assert.deepEqual(
        visibleGitChanges(primary.project),
        ['?? produktiv-lock.json', 'M .gitignore'],
      );
      assertProjectState(primary);
      const peerBefore = await assertHealthy(peer, peerInstalled.canonicalPackageRoot);
      await assertHealthy(primary, installed.canonicalPackageRoot);

      const updated = await update({ host: host.id, source: releaseBPath, project: primary.project, home });
      assert.equal(readJson(path.join(primary.project, 'produktiv-lock.json')).digest, releaseB.digest);
      assert.notEqual(updated.canonicalPackageRoot, installed.canonicalPackageRoot);
      assertProjectState(primary);
      assert.deepEqual(await assertHealthy(peer, peerInstalled.canonicalPackageRoot), peerBefore);

      const removed = uninstall({ host: host.id, project: primary.project, home });
      assert.equal(removed.ok, true);
      assert.equal(existsSync(path.join(primary.project, 'produktiv-lock.json')), true);
      assert.equal(readFileSync(path.join(primary.project, '.gitignore'), 'utf8'), 'dist/\n');
      assert.equal(existsSync(path.join(primary.skillsRoot, 'pk-setup')), false);
      assert.equal(existsSync(path.join(primary.skillsRoot, 'foreign-tool')), true);
      assert.equal(existsSync(installed.canonicalPackageRoot), true);
      assert.equal(existsSync(updated.canonicalPackageRoot), true);
      assertProjectState(primary);
      assert.deepEqual(await assertHealthy(peer, peerInstalled.canonicalPackageRoot), peerBefore);
    } finally {
      process.env.PATH = savedPath;
      rmSync(root, { recursive: true, force: true });
    }
  });
}

test('release keeps only active reviewer resources', async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'produktiv-m6-host-resources-'));
  try {
    const releasePath = path.join(root, 'release');
    const release = await buildRelease({ source: workflow, output: releasePath });
    const shipped = releaseInventory(releasePath)
      .filter((entry) => entry.type === 'file' && entry.path.startsWith('agents/'))
      .map((entry) => entry.path);
    assert.deepEqual(shipped, activeAgentResources(workflow));
    assert.deepEqual(release.activeAgentResources, shipped);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
