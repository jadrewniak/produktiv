/**
 * Node-present cases for the optional capability probe.
 * Host-only/no-Node behavior is evaluated by the setup forward test, not prose matching.
 * This file does not run when Node is absent.
 */

import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  DIAGRAM_BUNDLE_MARKER,
  DIAGRAM_NODE_MAJOR,
  GRAPH_BUNDLE_OK_MARKER,
  GRAPH_DIST_MARKER,
  GRAPH_NODE_MAJOR,
  defaultRepoRoot,
  probe,
} from '../../../adapters/host/capabilities.mjs';

const workflowDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const HOST_ONLY = ['web', 'browser', 'subagents', 'fileWrite', 'shell', 'issues'];

function tempRoot() {
  return mkdtempSync(path.join(tmpdir(), 'produktiv-capabilities-'));
}

test('simulated Node 20 keeps graph unavailable and can still offer diagram', async () => {
  const on20 = await probe({
    nodeVersion: 'v20.20.2',
    gitAvailable: true,
    graphBundle: true,
    diagramBundle: true,
  });
  assert.equal(on20.node.available, true);
  assert.equal(on20.node.major, 20);
  assert.equal(on20.graph.available, false);
  assert.equal(on20.graph.reason, 'node-floor');
  assert.equal(on20.diagram.available, true);
  assert.equal(on20.diagram.reason, null);
});

test('graph is available only at Node >= 22 with Git and a bundle marker', async () => {
  const ready = await probe({
    nodeMajor: 22,
    gitAvailable: true,
    graphBundle: true,
    diagramBundle: false,
  });
  assert.equal(ready.graph.available, true);
  assert.equal(ready.graph.reason, null);
  assert.equal(ready.diagram.available, false);
  assert.equal(ready.diagram.reason, 'missing-runtime');

  const noBundle = await probe({
    nodeVersion: 'v22.0.0',
    gitAvailable: true,
    graphBundle: false,
    diagramBundle: true,
  });
  assert.equal(noBundle.graph.available, false);
  assert.equal(noBundle.graph.reason, 'missing-runtime');
  assert.equal(noBundle.diagram.available, true);

  const noGit = await probe({
    nodeVersion: 'v24.0.0',
    gitAvailable: false,
    graphBundle: true,
    diagramBundle: true,
  });
  assert.equal(noGit.git.available, false);
  assert.equal(noGit.git.reason, 'git-unavailable');
  assert.equal(noGit.graph.available, false);
  assert.equal(noGit.graph.reason, 'git-unavailable');
  assert.equal(noGit.diagram.available, true);

  const node17 = await probe({
    nodeMajor: 17,
    gitAvailable: true,
    graphBundle: true,
    diagramBundle: true,
  });
  assert.equal(node17.graph.available, false);
  assert.equal(node17.diagram.available, false);
  assert.equal(node17.diagram.reason, 'node-floor');

  const node18 = await probe({
    nodeMajor: 18,
    gitAvailable: false,
    graphBundle: true,
    diagramBundle: true,
  });
  assert.equal(node18.graph.available, false);
  assert.equal(node18.diagram.available, true);
});

test('policy is not an input and host-only facts are not invented', async () => {
  const input = {
    nodeVersion: 'v22.14.0',
    gitAvailable: true,
    graphBundle: true,
    diagramBundle: false,
  };
  const plain = await probe(input);
  const withPolicy = await probe({
    ...input,
    graphEnabled: false,
    preferences: { graphOptOut: true },
  });
  assert.deepEqual(withPolicy, plain);
  assert.equal(plain.graph.available, true);
  assert.equal('policy' in plain, false);
  assert.equal('graphEnabled' in plain, false);
  for (const fact of HOST_ONLY) assert.equal(fact in plain, false);
});

test('bundle markers are directories or files, not the vendor placeholder', async () => {
  const root = tempRoot();
  try {
    assert.equal(graphUnavailableWithoutMarker(await probe({
      root,
      nodeVersion: 'v22.0.0',
      gitAvailable: true,
    })), 'missing-runtime');

    mkdirSync(path.join(root, GRAPH_DIST_MARKER), { recursive: true });
    const byDist = await probe({ root, nodeVersion: 'v22.0.0', gitAvailable: true });
    assert.equal(byDist.graph.available, true);

    const bundleOnly = tempRoot();
    try {
      const marker = path.join(bundleOnly, GRAPH_BUNDLE_OK_MARKER);
      mkdirSync(path.dirname(marker), { recursive: true });
      writeFileSync(marker, 'ok\n');
      const byFile = await probe({ root: bundleOnly, nodeMajor: 22, gitAvailable: true });
      assert.equal(byFile.graph.available, true);
      assert.equal(byFile.diagram.available, false);
    } finally {
      rmSync(bundleOnly, { recursive: true, force: true });
    }

    const renderer = path.join(root, DIAGRAM_BUNDLE_MARKER);
    mkdirSync(path.dirname(renderer), { recursive: true });
    writeFileSync(renderer, '// fixture\n');
    const diagramOnly = await probe({
      root,
      nodeVersion: 'v20.0.0',
      gitAvailable: false,
    });
    assert.equal(diagramOnly.graph.available, false);
    assert.equal(diagramOnly.diagram.available, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

function graphUnavailableWithoutMarker(result) {
  assert.equal(result.graph.available, false);
  return result.graph.reason;
}

test('the live probe reports this process version without assuming developer bundles are absent', async () => {
  const live = await probe();
  assert.equal(live.node.available, true);
  assert.equal(live.node.version, process.version);
  assert.equal(live.node.major, Number(process.versions.node.split('.')[0]));
  assert.equal(defaultRepoRoot(), path.resolve(workflowDir, '..'));
  for (const capability of [live.git, live.graph, live.diagram]) {
    assert.equal(typeof capability.available, 'boolean');
    if (capability.available) assert.equal(capability.reason, null);
    else assert.ok(['node-floor', 'git-unavailable', 'missing-runtime'].includes(capability.reason));
  }
  if (live.node.major < GRAPH_NODE_MAJOR) assert.equal(live.graph.available, false);
  if (live.node.major < DIAGRAM_NODE_MAJOR) assert.equal(live.diagram.available, false);
});
