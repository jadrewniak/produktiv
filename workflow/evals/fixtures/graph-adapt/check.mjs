/**
 * Temp-repo checks for the HEAD inventory and the adapted graph factory.
 *
 * An untracked file and a staged-only add stay out of the inventory.
 * A dirty tracked file is parsed from `git show`, not the worktree.
 * A Git failure does not come back as a fresh status.
 */

import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { GraphBuilder } from '../../../vendor/understand-anything/dist/analyzer/graph-builder.js';
import {
  getChangedFiles,
  getGraphFreshness,
  isStale,
  mergeGraphUpdate,
} from '../../../vendor/understand-anything/dist/staleness.js';
import {
  importTargetsChanged,
  importersOf,
} from '../../../vendor/understand-anything/scripts/prepare-incremental.mjs';

const SHA = '6df3065f1d8ddc2ce3615314d1d493f36d6b1c80';
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const vendorRoot = path.join(repoRoot, 'workflow/vendor/understand-anything');
const scanScript = path.join(vendorRoot, 'scripts/scan-project.mjs');
const extractScript = path.join(vendorRoot, 'scripts/extract-structure.mjs');

const ADAPTED = [
  'scripts/head-source.mjs',
  'scripts/scan-project.mjs',
  'scripts/extract-structure.mjs',
  'scripts/extract-import-map.mjs',
  'scripts/prepare-incremental.mjs',
  'scripts/finalize-incremental.mjs',
  'scripts/validate-incremental-symbols.mjs',
  'core/src/analyzer/graph-builder.ts',
  'core/src/staleness.ts',
  'core/src/index.ts',
];

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function initRepo() {
  const cwd = mkdtempSync(path.join(tmpdir(), 'produktiv-graph-adapt-'));
  git(cwd, ['init', '-b', 'main']);
  git(cwd, ['config', 'user.email', 'eval@produktiv.invalid']);
  git(cwd, ['config', 'user.name', 'Produktiv Eval']);
  git(cwd, ['config', 'commit.gpgsign', 'false']);
  return cwd;
}

function write(cwd, rel, text) {
  const abs = path.join(cwd, rel);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, text);
}

function runNode(args, cwd) {
  return execFileSync(process.execPath, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
}

function nodeFile(id, filePath, name) {
  return {
    id,
    type: 'file',
    name,
    filePath,
    summary: name,
    tags: [],
    complexity: 'simple',
  };
}

describe('HEAD inventory', { concurrency: false }, () => {
  test('adapted files name the upstream SHA and the frozen reason', () => {
    for (const rel of ADAPTED) {
      const text = readFileSync(path.join(vendorRoot, rel), 'utf8');
      const head = text.slice(0, 700);
      assert.match(head, new RegExp(SHA), `${rel} is missing the upstream SHA`);
      assert.match(head, /Frozen reason:/, `${rel} is missing the frozen reason`);
    }
  });

  test('the barrel stays structural and persistent fingerprints do not use the worktree store', () => {
    const barrel = readFileSync(path.join(vendorRoot, 'core/src/index.ts'), 'utf8');
    assert.doesNotMatch(barrel, /llm-analyzer|buildLayerDetectionPrompt|applyLLMLayers|SearchEngine|tour-generator|embedding-search|figma\//);
    assert.doesNotMatch(
      barrel,
      /export\s*\{[\s\S]*\bbuildFingerprintStore\b[\s\S]*\}\s*from\s*["']\.\/fingerprint\.js["']/,
    );

    const prepare = readFileSync(path.join(vendorRoot, 'scripts/prepare-incremental.mjs'), 'utf8');
    assert.doesNotMatch(prepare, /buildFingerprintStore\s*\(/);
    assert.doesNotMatch(prepare, /Working tree has relevant uncommitted changes/);

    const scan = readFileSync(scanScript, 'utf8');
    assert.doesNotMatch(scan, /enumerateViaWalk|readdirSync/);
    assert.doesNotMatch(scan, /\['ls-files'/);
  });

  test('inventory is HEAD, and a dirty file is parsed from the committed blob', () => {
    const cwd = initRepo();
    const outDir = mkdtempSync(path.join(tmpdir(), 'produktiv-graph-adapt-out-'));
    try {
      write(cwd, 'src/lib.ts', 'export function committedName(): number {\n  return 1;\n}\n');
      write(cwd, 'src/removed.ts', 'export function stillThere(): number {\n  return 1;\n}\n');
      write(cwd, '.env.example', 'EXAMPLE=1\n');
      write(cwd, '.env', 'SECRET=1\n');
      write(cwd, '.env.local', 'LOCAL=1\n');
      write(cwd, 'keys/credentials.json', '{}\n');
      write(cwd, 'src/app-secret.ts', 'export const token = 1;\n');
      write(cwd, '.workflow/config.yaml', 'name: demo\n');
      git(cwd, ['add', '-f', '.']);
      git(cwd, ['commit', '-m', 'initial']);

      write(cwd, 'src/lib.ts', 'export function dirtyName(): number {\n  return 2;\n}\n');
      write(cwd, 'src/untracked.ts', 'export function untrackedName(): number {\n  return 3;\n}\n');
      write(cwd, 'src/staged.ts', 'export function stagedName(): number {\n  return 4;\n}\n');
      git(cwd, ['add', 'src/staged.ts']);
      rmSync(path.join(cwd, 'src/removed.ts'));

      const scanPath = path.join(outDir, 'scan.json');
      runNode([scanScript, cwd, scanPath], cwd);
      const scan = JSON.parse(readFileSync(scanPath, 'utf8'));
      const paths = scan.files.map((file) => file.path).sort();

      assert.deepEqual(paths, ['.env.example', 'src/lib.ts', 'src/removed.ts']);
      assert.equal(scan.failures.length, 0);

      const inputPath = path.join(outDir, 'extract-input.json');
      const outputPath = path.join(outDir, 'extract-output.json');
      writeFileSync(inputPath, JSON.stringify({
        projectRoot: cwd,
        batchFiles: [
          { path: 'src/lib.ts', language: 'typescript', sizeLines: 3, fileCategory: 'code' },
          { path: 'src/removed.ts', language: 'typescript', sizeLines: 3, fileCategory: 'code' },
        ],
      }));
      runNode([extractScript, inputPath, outputPath], cwd);
      const extracted = JSON.parse(readFileSync(outputPath, 'utf8'));
      assert.equal(extracted.filesUnreadable.length, 0);
      const byPath = new Map(extracted.results.map((result) => [result.path, result]));
      assert.deepEqual(byPath.get('src/lib.ts').functions.map((fn) => fn.name), ['committedName']);
      assert.deepEqual(byPath.get('src/removed.ts').functions.map((fn) => fn.name), ['stillThere']);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
      rmSync(outDir, { recursive: true, force: true });
    }
  });

  test('a Git failure is not a fresh graph', async () => {
    const cwd = mkdtempSync(path.join(tmpdir(), 'produktiv-graph-adapt-nogit-'));
    try {
      const report = await getGraphFreshness(cwd, {
        graphCommitHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      });
      assert.notEqual(report.status, 'fresh');
      assert.equal(report.status, 'unknown');
      assert.equal(report.reason, 'git-head-unavailable');

      assert.throws(() => getChangedFiles(cwd, 'HEAD'), /Git command failed/);
      assert.throws(() => isStale(cwd, 'HEAD'), /Git command failed/);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test('dirty paths stay out of the persistent merge, and duplicate function ids gain a line suffix', () => {
    const existing = {
      version: '1.0.0',
      project: {
        name: 'p',
        languages: [],
        frameworks: [],
        description: '',
        analyzedAt: '2020-01-01T00:00:00.000Z',
        gitCommitHash: 'old',
      },
      nodes: [
        nodeFile('file:src/a.ts', 'src/a.ts', 'a'),
        nodeFile('file:src/dirty.ts', 'src/dirty.ts', 'old-dirty'),
      ],
      edges: [],
      layers: [],
      tour: [],
    };
    const merged = mergeGraphUpdate(
      existing,
      ['src/a.ts'],
      [
        nodeFile('file:src/a.ts', 'src/a.ts', 'new-a'),
        nodeFile('file:src/dirty.ts', 'src/dirty.ts', 'dirty'),
      ],
      [],
      'newsha',
      ['src/dirty.ts'],
    );
    assert.deepEqual(
      merged.nodes.map((node) => node.name).sort(),
      ['new-a', 'old-dirty'],
    );
    assert.equal(merged.project.gitCommitHash, 'newsha');

    const builder = new GraphBuilder('p', 'abc');
    builder.addFileWithAnalysis('src/a.ts', {
      functions: [
        { name: 'run', lineRange: [1, 2], params: [] },
        { name: 'run', lineRange: [10, 12], params: [] },
      ],
      classes: [],
      imports: [],
      exports: [],
    }, {
      summaries: {},
      fileSummary: '',
      tags: [],
      complexity: 'moderate',
    });
    builder.addCallEdge('src/a.ts', 'run', 'src/a.ts', 'run');
    builder.addCallEdge('src/a.ts', 'run', 'src/a.ts', 'run', 1, 10);
    const graph = builder.build();
    const functions = graph.nodes.filter((node) => node.type === 'function');
    assert.deepEqual(functions.map((node) => node.id), [
      'function:src/a.ts:run',
      'function:src/a.ts:run#10',
    ]);
    assert.ok(functions.every((node) => node.summary === 'run' && node.tags.length === 0));
    assert.equal(graph.nodes.find((node) => node.type === 'file').summary, 'a.ts');
    assert.deepEqual(
      graph.edges.filter((edge) => edge.type === 'calls').map((edge) => [edge.source, edge.target]),
      [['function:src/a.ts:run', 'function:src/a.ts:run#10']],
    );

    assert.deepEqual(
      importersOf({ 'src/a.ts': ['src/b.ts'], 'src/c.ts': ['src/d.ts'] }, ['src/b.ts']),
      ['src/a.ts'],
    );
    assert.deepEqual(
      importTargetsChanged(
        { 'src/a.ts': ['src/b.ts'] },
        { 'src/a.ts': ['src/d.ts'] },
        ['src/a.ts'],
      ),
      ['src/a.ts'],
    );
  });
});
