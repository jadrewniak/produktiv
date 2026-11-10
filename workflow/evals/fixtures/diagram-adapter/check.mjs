/**
 * diagram adapter facade.
 *
 * Invalid IR leaves no HTML. A passing validate_ir leaves no HTML.
 * PROPOSED IR that still carries repository evidence returns a diagnostic
 * and does not call Git. Render, check, and compare stay on this module.
 */

import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
  compare_architecture,
  render_ir,
  supports,
  validate_ir,
  verify_artifact,
} from '../../../adapters/diagram/index.mjs';

const workflowDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const adapterPath = path.join(workflowDir, 'adapters/diagram/index.mjs');
const repoRoot = path.resolve(workflowDir, '..');

const PAIR = {
  schema_version: 1,
  diagram_type: 'architecture',
  meta: { title: 'Pair' },
  components: [
    { id: 'a', type: 'backend', label: 'API', pos: [80, 80], size: [120, 60] },
    { id: 'b', type: 'database', label: 'DB', pos: [360, 80], size: [120, 60] },
  ],
  connections: [{ id: 'a-to-b', from: 'a', to: 'b', label: 'SQL' }],
};

function clone(value) {
  return structuredClone(value);
}

function diagramTemps() {
  return readdirSync(tmpdir()).filter((name) => name.startsWith('produktiv-diagram-'));
}

async function expectNoTempLeak(run) {
  const before = diagramTemps();
  try {
    return await run();
  } finally {
    assert.deepEqual(diagramTemps(), before);
  }
}

function architecture(row) {
  return {
    schema_version: 1,
    diagram_type: 'architecture',
    meta: { title: 'Pair' },
    components: [
      { id: 'a', type: 'backend', label: 'API', row, col: 0 },
      { id: 'b', type: 'database', label: 'DB', row: 0, col: 2 },
    ],
    connections: [{ id: 'link', from: 'a', to: 'b', label: 'SQL' }],
  };
}

async function withGitTrap(run) {
  const dir = mkdtempSync(path.join(tmpdir(), 'produktiv-git-stub-'));
  const log = path.join(dir, 'git.log');
  const stub = path.join(dir, 'git');
  writeFileSync(log, '');
  writeFileSync(stub, `#!/bin/sh\necho called >> ${JSON.stringify(log)}\nexit 99\n`);
  chmodSync(stub, 0o755);
  const previousPath = process.env.PATH;
  const previousRoot = process.env.ARCHIFY_REPO_ROOT;
  process.env.PATH = `${dir}${path.delimiter}${previousPath || ''}`;
  process.env.ARCHIFY_REPO_ROOT = repoRoot;
  try {
    await run();
    assert.equal(readFileSync(log, 'utf8'), '');
  } finally {
    if (previousPath === undefined) delete process.env.PATH;
    else process.env.PATH = previousPath;
    if (previousRoot === undefined) delete process.env.ARCHIFY_REPO_ROOT;
    else process.env.ARCHIFY_REPO_ROOT = previousRoot;
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('diagram adapter', { concurrency: 1 }, () => {
  test('supports only the five diagram types', () => {
    for (const type of ['architecture', 'workflow', 'sequence', 'dataflow', 'lifecycle']) {
      assert.equal(supports(type), true);
    }
    for (const type of ['delta', 'compare', 'Architecture', '', null]) {
      assert.equal(supports(type), false);
    }
  });

  test('the facade spawns vendored scripts and does not import skill text', () => {
    const source = readFileSync(adapterPath, 'utf8');
    assert.match(source, /execFile/);
    assert.match(source, /vendor\/archify/);
    assert.match(source, /compareArchitecture/);
    assert.doesNotMatch(source, /\.upstream/);
    assert.doesNotMatch(source, /SKILL\.md/);
    assert.doesNotMatch(source, /from\s+['"][^'"]*render-/);
    assert.doesNotMatch(source, /from\s+['"][^'"]*check-render-output/);
    assert.doesNotMatch(source, /renderArchitectureDeltaHtml|buildDeltaSvg/);
  });

  test('invalid IR leaves no HTML', async () => {
    const missingTitle = clone(PAIR);
    delete missingTitle.meta.title;
    const duplicate = clone(PAIR);
    duplicate.components[1].id = 'a';
    const dangling = clone(PAIR);
    dangling.connections = [{ id: 'a-to-missing', from: 'a', to: 'missing' }];

    const cases = [
      ['missing title', missingTitle, 'schema/required'],
      ['duplicate id', duplicate, 'layout/constraint'],
      ['dangling endpoint', dangling, 'layout/constraint'],
    ];

    for (const [label, ir, code] of cases) {
      const validated = await expectNoTempLeak(() => validate_ir('architecture', ir));
      assert.equal(validated.ok, false, label);
      assert.equal(validated.diagnostics[0].code, code, label);

      const dir = mkdtempSync(path.join(tmpdir(), 'produktiv-diagram-out-'));
      const output = path.join(dir, 'diagram.html');
      try {
        const rendered = await expectNoTempLeak(() => render_ir('architecture', ir, output));
        assert.equal(rendered.ok, false, label);
        assert.equal(rendered.path, null, label);
        assert.equal(existsSync(output), false, label);
        assert.equal(readdirSync(dir).some((name) => name.endsWith('.html')), false, label);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  test('a passing validate_ir leaves no HTML', async () => {
    const validated = await expectNoTempLeak(() => validate_ir('architecture', PAIR));
    assert.equal(validated.ok, true);
    assert.deepEqual(validated.diagnostics, []);
  });

  test('PROPOSED repository evidence is rejected before Git', async () => {
    const withRepository = clone(PAIR);
    withRepository.meta.repository = {
      url: 'https://github.com/acme/app',
      revision: 'a'.repeat(40),
    };
    const withSources = clone(PAIR);
    withSources.components[0].sources = [{ path: 'src/api.ts' }];

    await withGitTrap(async () => {
      const repository = await expectNoTempLeak(() => validate_ir('architecture', withRepository, 'PROPOSED'));
      assert.equal(repository.ok, false);
      assert.equal(repository.diagnostics[0].code, 'diagram/proposed-evidence');
      assert.deepEqual(repository.diagnostics[0].subject.paths, ['/meta/repository']);

      const dir = mkdtempSync(path.join(tmpdir(), 'produktiv-diagram-out-'));
      try {
        const sources = await render_ir('architecture', withSources, path.join(dir, 'proposed.html'), 'PROPOSED');
        assert.equal(sources.ok, false);
        assert.equal(sources.diagnostics[0].code, 'diagram/proposed-evidence');
        assert.deepEqual(sources.diagnostics[0].subject.paths, ['/components/0/sources']);
        assert.equal(existsSync(path.join(dir, 'proposed.html')), false);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  test('render_ir keeps HTML only after the checker passes', async () => {
    const previousProfile = process.env.ARCHIFY_QUALITY_PROFILE;
    const previousBrand = process.env.ARCHIFY_BRAND_MARK;
    process.env.ARCHIFY_QUALITY_PROFILE = 'showcase';
    process.env.ARCHIFY_BRAND_MARK = '1';
    const dir = mkdtempSync(path.join(tmpdir(), 'produktiv-diagram-out-'));
    const output = path.join(dir, 'pair.html');
    try {
      const rendered = await expectNoTempLeak(() => render_ir('architecture', PAIR, output));
      assert.equal(rendered.ok, true);
      assert.equal(rendered.path, output);
      assert.equal(existsSync(output), true);
      const html = readFileSync(output, 'utf8');
      assert.match(html, /data-quality-profile="standard"/);
      assert.match(html, /data-quality-gates="advisory"/);
      assert.doesNotMatch(html, /data-quality-profile="showcase"/);
      assert.equal(readdirSync(dir).some((name) => name.startsWith('.archify-')), false);
      const checked = await verify_artifact(output);
      assert.equal(checked.ok, true);
      assert.ok(checked.checks.some((check) => check.name === 'single_svg' && check.ok));
    } finally {
      if (previousProfile === undefined) delete process.env.ARCHIFY_QUALITY_PROFILE;
      else process.env.ARCHIFY_QUALITY_PROFILE = previousProfile;
      if (previousBrand === undefined) delete process.env.ARCHIFY_BRAND_MARK;
      else process.env.ARCHIFY_BRAND_MARK = previousBrand;
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('destination inside the vendored tree is refused', async () => {
    const forbidden = path.join(workflowDir, 'vendor/archify/not-an-artifact.html');
    const rendered = await render_ir('architecture', PAIR, forbidden);
    assert.equal(rendered.ok, false);
    assert.equal(rendered.diagnostics[0].code, 'diagram/output-inside-vendor');
    assert.equal(existsSync(forbidden), false);

    const dir = mkdtempSync(path.join(tmpdir(), 'produktiv-diagram-out-'));
    const link = path.join(dir, 'alias.html');
    symlinkSync(forbidden, link);
    try {
      const throughLink = await render_ir('architecture', PAIR, link);
      assert.equal(throughLink.ok, false);
      assert.equal(throughLink.diagnostics[0].code, 'diagram/output-inside-vendor');
      assert.equal(existsSync(forbidden), false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test('compare drops a row move and requires connection ids', () => {
    const moved = compare_architecture(architecture(0), architecture(1));
    assert.equal(moved.ok, true);
    assert.equal(moved.receipt.summary.components.moved, 1);
    assert.equal(moved.receipt.changes.components.some((change) => change.status === 'moved'), true);
    assert.equal(moved.semantic.changes.components.some((change) => change.status === 'moved'), false);
    assert.equal(Object.hasOwn(moved.semantic.summary.components, 'moved'), false);
    assert.equal(moved.semantic.changes.components.length, 0);

    const missingId = architecture(0);
    delete missingId.connections[0].id;
    const rejected = compare_architecture(architecture(0), missingId);
    assert.equal(rejected.ok, false);
    assert.equal(rejected.receipt, null);
    assert.equal(rejected.diagnostics[0].code, 'delta/relationship-id-required');

    const proposed = architecture(0);
    proposed.meta.repository = {
      url: 'https://github.com/acme/app',
      revision: 'a'.repeat(40),
    };
    const evidence = compare_architecture(architecture(0), proposed);
    assert.equal(evidence.ok, false);
    assert.equal(evidence.diagnostics[0].code, 'diagram/proposed-evidence');
  });
});
