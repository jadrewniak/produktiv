import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { probe } from '../../../adapters/host/capabilities.mjs';
import {
  assessSkill,
  exerciseInstalledLibraries,
  loadInstalledGraph,
} from '../../../scripts/bootstrap.mjs';
import { releaseInventory, verifyRelease } from '../../../scripts/package-image.mjs';
import { buildRelease } from '../../../scripts/release.mjs';

const workflow = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const architectureFixture = path.join(workflow, 'evals', 'fixtures', 'diagram', 'architecture.json');

const REQUIRED_RELEASE_FILES = Object.freeze([
  'README.md',
  'vendor/archify/LICENSE',
  'vendor/archify/assets/JetBrainsMono-OFL.txt',
  'vendor/understand-anything/LICENSE',
  'vendor/understand-anything/THIRD-PARTY',
  'vendor/understand-anything/wasm/tree-sitter-dart-wasm/LICENSE',
  'vendor/understand-anything/wasm/tree-sitter-swift-wasm/LICENSE',
]);

async function preparedRelease(root) {
  const releaseRoot = path.join(root, 'release');
  const receipt = await buildRelease({ source: workflow, output: releaseRoot });
  verifyRelease(releaseRoot, receipt);
  return { releaseRoot, receipt };
}

function linkedSkill(root, releaseRoot, name = 'pk-setup') {
  const skill = path.join(root, `skill-${name}`);
  mkdirSync(skill, { recursive: true });
  symlinkSync(releaseRoot, path.join(skill, 'produktiv'));
  return skill;
}

async function renderArchitecture(releaseRoot, root, label) {
  const adapterUrl = pathToFileURL(path.join(releaseRoot, 'adapters', 'diagram', 'index.mjs')).href;
  const adapter = await import(adapterUrl);
  const output = path.join(root, `${label}.html`);
  const ir = JSON.parse(readFileSync(architectureFixture, 'utf8'));
  const rendered = await adapter.render_ir('architecture', ir, output);
  assert.equal(rendered.ok, true, rendered.diagnostics?.[0]?.message ?? label);
  assert.equal(existsSync(output), true);
}

async function smokeGraph(releaseRoot) {
  const plugin = path.join(
    releaseRoot,
    'vendor',
    'understand-anything',
    'dist',
    'plugins',
    'tree-sitter-plugin.js',
  );
  const loaded = await loadInstalledGraph(plugin);
  assert.equal(loaded.specs.length, 17);
  await exerciseInstalledLibraries(plugin);
}

test('final release has the public surface, licenses and attribution', { timeout: 300000 }, async () => {
  assert.ok(Number(process.versions.node.split('.')[0]) >= 22, 'release acceptance requires Node >=22');
  const root = mkdtempSync(path.join(tmpdir(), 'produktiv-m6-acceptance-'));
  try {
    const { releaseRoot, receipt } = await preparedRelease(root);
    const inventory = releaseInventory(releaseRoot);
    const files = new Set(inventory.filter((entry) => entry.type === 'file').map((entry) => entry.path));
    for (const rel of REQUIRED_RELEASE_FILES) {
      assert.equal(files.has(rel), true, `installed release is missing ${rel}`);
      assert.ok(readFileSync(path.join(releaseRoot, rel)).length > 0, `${rel} is empty`);
    }
    assert.equal(receipt.skills.length, 17);
    assert.equal(receipt.activeAgentResources.length, 8);
    assert.deepEqual(receipt.surfaces, ['core', 'diagram', 'graph']);
    const readme = readFileSync(path.join(releaseRoot, 'README.md'), 'utf8');
    assert.match(readme, /Windows graph and diagram support is not claimed/);
    assert.match(readme, /not installed runtime dependencies/);
    assert.doesNotMatch(readme, /Windows[^\n]*(supported|accepted)/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('runtime fact combinations isolate graph and diagram availability', async () => {
  const noNode = { core: true, graph: false, diagram: false };
  assert.deepEqual(noNode, { core: true, graph: false, diagram: false });

  const node18 = await probe({ nodeMajor: 18, gitAvailable: true, graphBundle: true, diagramBundle: true });
  assert.deepEqual(
    { graph: node18.graph, diagram: node18.diagram },
    {
      graph: { available: false, reason: 'node-floor' },
      diagram: { available: true, reason: null },
    },
  );

  const node22NoGit = await probe({ nodeMajor: 22, gitAvailable: false, graphBundle: true, diagramBundle: true });
  assert.deepEqual(
    { graph: node22NoGit.graph, diagram: node22NoGit.diagram },
    {
      graph: { available: false, reason: 'git-unavailable' },
      diagram: { available: true, reason: null },
    },
  );

  const node22 = await probe({ nodeMajor: 22, gitAvailable: true, graphBundle: true, diagramBundle: true });
  assert.deepEqual(
    { graph: node22.graph, diagram: node22.diagram },
    {
      graph: { available: true, reason: null },
      diagram: { available: true, reason: null },
    },
  );
});

test('installed core remains available without Node', { timeout: 300000 }, async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'produktiv-m6-no-node-'));
  try {
    const { releaseRoot } = await preparedRelease(root);
    const status = await assessSkill(linkedSkill(root, releaseRoot, 'no-node'), { nodeAvailable: false });
    assert.deepEqual(status, {
      core: { available: true, reason: null },
      graph: { available: false, reason: 'node-absent' },
      diagram: { available: false, reason: 'node-absent' },
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('missing graph bundle does not contaminate core or diagram', { timeout: 300000 }, async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'produktiv-m6-no-graph-'));
  try {
    const { releaseRoot } = await preparedRelease(root);
    const damaged = path.join(root, 'release-without-graph');
    cpSync(releaseRoot, damaged, { recursive: true, verbatimSymlinks: true });
    rmSync(path.join(damaged, 'vendor', 'understand-anything'), { recursive: true, force: true });
    rmSync(path.join(damaged, 'graph'), { recursive: true, force: true });
    rmSync(path.join(damaged, 'adapters', 'graph'), { recursive: true, force: true });

    const status = await assessSkill(linkedSkill(root, damaged, 'no-graph'), {
      nodeAvailable: true,
      nodeMajor: 22,
    });
    assert.deepEqual(
      { core: status.core, graph: status.graph, diagram: status.diagram },
      {
        core: { available: true, reason: null },
        graph: { available: false, reason: 'missing-runtime' },
        diagram: { available: true, reason: null },
      },
    );
    await renderArchitecture(damaged, root, 'diagram-without-graph');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('missing diagram bundle does not contaminate core or graph', { timeout: 300000 }, async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'produktiv-m6-no-diagram-'));
  try {
    const { releaseRoot } = await preparedRelease(root);
    const damaged = path.join(root, 'release-without-diagram');
    cpSync(releaseRoot, damaged, { recursive: true, verbatimSymlinks: true });
    rmSync(path.join(damaged, 'vendor', 'archify'), { recursive: true, force: true });
    rmSync(path.join(damaged, 'adapters', 'diagram'), { recursive: true, force: true });

    const status = await assessSkill(linkedSkill(root, damaged, 'no-diagram'), {
      nodeAvailable: true,
      nodeMajor: 22,
    });
    assert.deepEqual(
      { core: status.core, graph: status.graph, diagram: status.diagram },
      {
        core: { available: true, reason: null },
        graph: { available: true, reason: null },
        diagram: { available: false, reason: 'missing-runtime' },
      },
    );
    await smokeGraph(damaged);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
