/**
 * Temp-repo checks for the quality gate (adapters/host/gate.mjs) and the
 * working-tree snapshot it uses (adapters/host/git.mjs).
 *
 * Both directions: a bad state fails with a log tail, a good state passes.
 * A receipt is reused only while the tree and the command match. The real
 * index and object directory are never written. Commit trailers are read
 * as pointers: conflicts, reverts and unsafe values are reported.
 */

import { execFile } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { openWorkingTree } from '../../../adapters/host/git.mjs';
import {
  HIGH_LIMITS,
  LOOP_LIMIT,
  TRIVIAL_LIMITS,
  begin,
  classify,
  classifyStats,
  end,
  parseQuality,
  run,
  scan,
  scanPatch,
  selectRows,
  status,
  summarizeTrailers,
} from '../../../adapters/host/gate.mjs';

const execFileAsync = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const workflow = path.resolve(here, '../../..');
const gateCli = path.join(workflow, 'adapters/host/gate.mjs');

const git = (cwd, args) => execFileAsync('git', args, { cwd }).then(({ stdout }) => stdout.trim());

function quality(rows) {
  const lines = rows.map(([purpose, command]) => `| ${purpose} | \`${command.replace(/\|/g, '\\|')}\` | \`package.json#scripts.x\` |`);
  return `# Quality\n\n## Commands\n\n| Purpose | Command | Source |\n|---|---|---|\n${lines.join('\n')}\n\n## Definition of Done\n\n| Ignored | \`false\` | no |\n`;
}

// Fails while a file named `bad` exists in the repository root.
const CHECK_BAD = `node -e "if (require('fs').existsSync('bad')) { console.error('bad is present'); process.exit(1) }"`;
// Appends to a counter outside the repository, so reuse is observable.
const COUNT = `node -e "require('fs').appendFileSync(process.env.PRODUKTIV_GATE_COUNT, 'x')"`;

async function repo({ rows = [['Test', CHECK_BAD], ['Lint', 'echo lint ok']], commit = true } = {}) {
  const cwd = mkdtempSync(path.join(tmpdir(), 'produktiv-gate-'));
  await git(cwd, ['init', '-b', 'main']);
  await git(cwd, ['config', 'user.email', 'eval@produktiv.invalid']);
  await git(cwd, ['config', 'user.name', 'Produktiv Eval']);
  await git(cwd, ['config', 'commit.gpgsign', 'false']);
  mkdirSync(path.join(cwd, '.workflow/context'), { recursive: true });
  writeFileSync(path.join(cwd, '.workflow/context/quality.md'), quality(rows));
  writeFileSync(path.join(cwd, 'src.js'), 'export const one = 1;\n');
  writeFileSync(path.join(cwd, '.gitignore'), 'ignored.log\n');
  if (commit) {
    await git(cwd, ['add', '-A']);
    await git(cwd, ['commit', '-m', 'init']);
  }
  return cwd;
}

function counter() {
  const file = path.join(mkdtempSync(path.join(tmpdir(), 'produktiv-gate-count-')), 'count');
  writeFileSync(file, '');
  process.env.PRODUKTIV_GATE_COUNT = file;
  return () => readFileSync(file, 'utf8').length;
}

function looseObjects(cwd) {
  const dir = path.join(cwd, '.git/objects');
  return readdirSync(dir)
    .filter((name) => /^[0-9a-f]{2}$/.test(name))
    .reduce((sum, name) => sum + readdirSync(path.join(dir, name)).length, 0);
}

async function treeOf(cwd) {
  const tree = await openWorkingTree(cwd, { exclude: ['.workflow/cache', '.workflow/local'] });
  try {
    return await tree.hash();
  } finally {
    tree.close();
  }
}

function cli(cwd, args, script = gateCli) {
  return new Promise((resolve) => {
    execFile(process.execPath, [script, ...args], { cwd }, (error, stdout, stderr) => {
      resolve({ code: error ? error.code : 0, stdout, stderr });
    });
  });
}

describe('quality gate', { concurrency: false }, () => {
  test('parses the Commands table and ignores comments, placeholders and later sections', () => {
    const template = readFileSync(path.join(workflow, 'templates/quality.md'), 'utf8');
    assert.deepEqual(parseQuality(template), []);
    const rows = parseQuality(
      `${quality([['Test', 'pnpm run test'], ['Type check', 'pnpm run types'], ['CI', 'pnpm run ci']])}`.replace(
        'pnpm run ci',
        'a \\| b',
      ),
    );
    assert.deepEqual(rows.map((row) => row.purpose), ['Test', 'Type check', 'CI']);
    assert.equal(rows[2].command, 'a | b');
    assert.equal(rows[0].source, 'package.json#scripts.x');
    assert.deepEqual(selectRows(rows).map((row) => row.purpose), ['Test', 'Type check']);
    assert.deepEqual(selectRows(rows, ['ci']).map((row) => row.command), ['a | b']);
  });

  test('a clean tree hashes to HEAD^{tree} and the real index and objects stay untouched', async () => {
    const cwd = await repo();
    try {
      writeFileSync(path.join(cwd, 'new.txt'), 'untracked\n');
      writeFileSync(path.join(cwd, 'src.js'), 'export const one = 2;\n');
      // status refreshes the real index, so read it afterwards.
      const statusBefore = await git(cwd, ['status', '--porcelain']);
      const indexBefore = readFileSync(path.join(cwd, '.git/index'));
      const objectsBefore = looseObjects(cwd);
      const dirty = await treeOf(cwd);
      assert.notEqual(dirty, await git(cwd, ['rev-parse', 'HEAD^{tree}']));
      assert.deepEqual(readFileSync(path.join(cwd, '.git/index')), indexBefore);
      assert.equal(looseObjects(cwd), objectsBefore);
      assert.equal(await git(cwd, ['status', '--porcelain']), statusBefore);

      rmSync(path.join(cwd, 'new.txt'));
      writeFileSync(path.join(cwd, 'src.js'), 'export const one = 1;\n');
      assert.equal(await treeOf(cwd), await git(cwd, ['rev-parse', 'HEAD^{tree}']));
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test('a same-size edit with an unchanged mtime still changes the hash', async () => {
    // Git rehashes an entry whose mtime is not older than the index file. A
    // copied index with a fresh mtime would trust stale stat data instead.
    const cwd = await repo();
    try {
      const file = path.join(cwd, 'src.js');
      const index = path.join(cwd, '.git/index');
      const stamp = Math.floor(Date.now() / 1000) - 100;
      utimesSync(file, stamp, stamp);
      await git(cwd, ['add', 'src.js']);
      utimesSync(index, stamp, stamp);
      const before = await treeOf(cwd);
      writeFileSync(file, 'export const one = 9;\n');
      utimesSync(file, stamp, stamp);
      assert.notEqual(await treeOf(cwd), before);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test('untracked files change the hash; ignored files and gate state do not', async () => {
    const cwd = await repo();
    try {
      const clean = await treeOf(cwd);
      writeFileSync(path.join(cwd, 'ignored.log'), 'noise\n');
      mkdirSync(path.join(cwd, '.workflow/cache/evidence'), { recursive: true });
      writeFileSync(path.join(cwd, '.workflow/cache/evidence/x.json'), '{}\n');
      mkdirSync(path.join(cwd, '.workflow/local'), { recursive: true });
      writeFileSync(path.join(cwd, '.workflow/local/preferences.yaml'), 'detail: concise\n');
      assert.equal(await treeOf(cwd), clean);
      writeFileSync(path.join(cwd, 'added.js'), 'export {};\n');
      assert.notEqual(await treeOf(cwd), clean);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test('a subdirectory hashes the whole worktree', async () => {
    const cwd = await repo();
    try {
      mkdirSync(path.join(cwd, 'pkg'));
      writeFileSync(path.join(cwd, 'pkg/inner.js'), 'export {};\n');
      const fromRoot = await treeOf(cwd);
      const tree = await openWorkingTree(path.join(cwd, 'pkg'), { exclude: [] });
      try {
        assert.equal(await tree.hash(), fromRoot);
      } finally {
        tree.close();
      }
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test('works in a repository without a first commit', async () => {
    const cwd = await repo({ commit: false });
    try {
      const result = await run({ root: cwd });
      assert.equal(result.result, 'PASS');
      assert.match(result.tree, /^[0-9a-f]{40}$/);
      writeFileSync(path.join(cwd, 'a.test.js'), 'it.skip("x", () => {});\n');
      const scanned = await scan({ root: cwd });
      assert.deepEqual(scanned.signals.map((s) => [s.file, s.rule]), [['a.test.js', 'test-skipped']]);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test('fails in the bad state and passes in the good state, through the CLI exit code', async () => {
    const cwd = await repo();
    try {
      await begin({ root: cwd });
      writeFileSync(path.join(cwd, 'bad'), '');
      const failed = await cli(cwd, ['run']);
      assert.equal(failed.code, 1);
      const value = JSON.parse(failed.stdout);
      assert.equal(value.result, 'FAIL');
      const testRow = value.rows.find((row) => row.purpose === 'Test');
      assert.equal(testRow.result, 'FAIL');
      assert.equal(testRow.exitCode, 1);
      assert.equal(typeof testRow.logTail, 'string');
      assert.ok(value.notice);
      assert.equal(value.rows.find((row) => row.purpose === 'Lint').result, 'PASS');

      const receipt = JSON.parse(readFileSync(path.join(cwd, value.receipt), 'utf8'));
      const entry = Object.values(receipt.rows).find((row) => row.purpose === 'Test');
      assert.equal(receipt.tree, value.tree);
      for (const key of ['command', 'exitCode', 'durationMs', 'startedAt', 'logTail', 'treeAfter', 'runtime']) {
        assert.ok(key in entry, key);
      }

      rmSync(path.join(cwd, 'bad'));
      const passed = await cli(cwd, ['run']);
      assert.equal(passed.code, 0);
      assert.equal(JSON.parse(passed.stdout).result, 'PASS');
      assert.equal(await git(cwd, ['status', '--porcelain']), '');
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test('reuses a receipt only while the tree and the command match', async () => {
    const cwd = await repo({ rows: [['Test', COUNT]] });
    const count = counter();
    try {
      assert.equal((await run({ root: cwd })).result, 'PASS');
      const again = await run({ root: cwd });
      assert.equal(again.rows[0].reused, true);
      assert.equal(count(), 1);
      assert.equal((await status({ root: cwd })).fresh, true);

      writeFileSync(path.join(cwd, 'src.js'), 'export const one = 3;\n');
      assert.equal((await status({ root: cwd })).result, 'MISSING');
      assert.equal((await run({ root: cwd })).rows[0].reused, false);
      assert.equal(count(), 2);

      assert.equal((await run({ root: cwd, force: true })).rows[0].reused, false);
      assert.equal(count(), 3);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test('a changed command invalidates its row even when quality context is ignored', async () => {
    const cwd = await repo({ rows: [['Test', COUNT]] });
    counter();
    try {
      writeFileSync(path.join(cwd, '.gitignore'), 'ignored.log\n.workflow/\n');
      await git(cwd, ['rm', '-r', '--cached', '-q', '.workflow']);
      await git(cwd, ['commit', '-qam', 'ignore workflow']);
      await run({ root: cwd });
      assert.equal((await status({ root: cwd })).fresh, true);
      writeFileSync(path.join(cwd, '.workflow/context/quality.md'), quality([['Test', `${COUNT} && echo changed`]]));
      assert.equal((await status({ root: cwd })).result, 'MISSING');
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test('a command that edits the tree leaves no fresh receipt and stops the remaining rows', async () => {
    const cwd = await repo({ rows: [['Lint', `node -e "require('fs').writeFileSync('src.js', 'fixed')"`], ['Test', 'echo ok']] });
    try {
      const result = await run({ root: cwd });
      assert.equal(result.reason, 'tree-changed-during-run');
      assert.equal(result.fresh, false);
      assert.deepEqual(result.rows[0].changedFiles, ['src.js']);
      assert.equal(result.rows[1].reason, 'not-run-tree-changed');
      assert.equal((await status({ root: cwd })).result, 'MISSING');
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test('timeout and a missing tool are BLOCKED, not FAIL', async () => {
    const cwd = await repo({
      rows: [['Test', `node -e "setTimeout(() => {}, 60000)"`], ['Lint', 'produktiv-no-such-tool-xyz']],
    });
    try {
      const started = Date.now();
      const result = await run({ root: cwd, timeoutS: 1 });
      assert.ok(Date.now() - started < 15000);
      assert.equal(result.result, 'BLOCKED');
      assert.deepEqual(result.rows.map((row) => row.reason), ['timeout', 'command-not-found']);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test('missing, empty or unmatched quality context is UNAVAILABLE', async () => {
    const cwd = await repo({ rows: [['CI', 'echo ci']] });
    try {
      const unmatched = await run({ root: cwd });
      assert.equal(unmatched.result, 'UNAVAILABLE');
      assert.equal(unmatched.reason, 'no-gate-rows');
      assert.deepEqual(unmatched.available, ['CI']);
      assert.equal((await run({ root: cwd, purposes: ['CI'] })).result, 'PASS');

      writeFileSync(path.join(cwd, '.workflow/context/quality.md'), readFileSync(path.join(workflow, 'templates/quality.md')));
      assert.equal((await run({ root: cwd })).reason, 'no-commands');
      rmSync(path.join(cwd, '.workflow/context/quality.md'));
      const missing = await cli(cwd, ['run']);
      assert.equal(missing.code, 1);
      assert.equal(JSON.parse(missing.stdout).reason, 'no-quality-context');
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test(`stops after ${LOOP_LIMIT} failing runs on different trees; begin resets the count`, async () => {
    const cwd = await repo();
    try {
      await begin({ root: cwd });
      writeFileSync(path.join(cwd, 'bad'), '');
      for (let i = 0; i < LOOP_LIMIT; i += 1) {
        writeFileSync(path.join(cwd, 'attempt.txt'), String(i));
        assert.equal((await run({ root: cwd })).result, 'FAIL');
        // Same tree again is reused and does not count.
        assert.equal((await run({ root: cwd })).failStreak, i + 1);
      }
      writeFileSync(path.join(cwd, 'attempt.txt'), 'next');
      const limited = await run({ root: cwd });
      assert.equal(limited.reason, 'limit-reached');
      assert.equal(limited.attemptsLeft, 0);

      await begin({ root: cwd });
      assert.equal((await run({ root: cwd })).result, 'FAIL');
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test('outside Git it runs every time and keeps no receipt', async () => {
    const cwd = mkdtempSync(path.join(tmpdir(), 'produktiv-gate-nogit-'));
    const count = counter();
    try {
      mkdirSync(path.join(cwd, '.workflow/context'), { recursive: true });
      writeFileSync(path.join(cwd, '.workflow/context/quality.md'), quality([['Test', COUNT]]));
      const first = await run({ root: cwd });
      assert.equal(first.result, 'PASS');
      assert.equal(first.tree, null);
      assert.equal(first.receipt, null);
      assert.equal(first.fresh, false);
      await run({ root: cwd });
      assert.equal(count(), 2);
      assert.equal((await status({ root: cwd })).result, 'UNAVAILABLE');
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test('scan flags added weakening lines only, outside prose files', async () => {
    const cwd = await repo();
    try {
      writeFileSync(path.join(cwd, 'old.test.js'), 'it.skip("kept", () => {});\n');
      writeFileSync(path.join(cwd, 'vitest.config.ts'), 'export default { test: { coverage: { thresholds: { lines: 90 } } } };\n');
      await git(cwd, ['add', '-A']);
      await git(cwd, ['commit', '-qm', 'base']);
      writeFileSync(path.join(cwd, 'old.test.js'), 'it("kept", () => {});\n');
      writeFileSync(path.join(cwd, 'vitest.config.ts'), 'export default { test: { coverage: { thresholds: { lines: 40 } } } };\n');
      writeFileSync(path.join(cwd, 'src.js'), 'export const one = 1;\n// eslint-disable-next-line\nexport const two = 2; // @ts-ignore\n');
      writeFileSync(path.join(cwd, 'NOTES.md'), 'Use `.skip(` sparingly.\n');
      const { signals } = await scan({ root: cwd });
      assert.deepEqual(
        signals.map((s) => [s.file, s.line, s.rule]),
        [
          ['src.js', 2, 'lint-suppressed'],
          ['src.js', 3, 'type-suppressed'],
          ['vitest.config.ts', 1, 'threshold-changed'],
        ],
      );
      assert.deepEqual(scanPatch(''), []);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test('runs when invoked through a symlinked package link, as skills call it', async () => {
    const cwd = await repo();
    const links = mkdtempSync(path.join(tmpdir(), 'produktiv-gate-link-'));
    try {
      symlinkSync(workflow, path.join(links, 'produktiv'), 'dir');
      const linked = await cli(cwd, ['run'], path.join(links, 'produktiv/adapters/host/gate.mjs'));
      assert.equal(linked.code, 0);
      assert.equal(JSON.parse(linked.stdout).result, 'PASS');
    } finally {
      rmSync(cwd, { recursive: true, force: true });
      rmSync(links, { recursive: true, force: true });
    }
  });

  test('router levels follow size, file kinds and policy-trigger paths', () => {
    const mod = (file, added = 2, deleted = 1) => ({ path: file, status: 'M', added, deleted, binary: false });
    const level = (rows) => classifyStats(rows).level;
    assert.equal(level([]), 'trivial');
    assert.equal(level([mod('src/greet.ts'), { ...mod('src/greet.test.ts'), status: 'A' }]), 'trivial');
    assert.equal(level([mod('docs/authors.md'), mod('src/tokenizer.ts')]), 'trivial');
    assert.equal(level([mod('docs/AGENTS-history.md')]), 'trivial');

    const many = Array.from({ length: TRIVIAL_LIMITS.files + 1 }, (_, i) => mod(`src/f${i}.ts`));
    assert.equal(level(many), 'standard');
    assert.equal(level([mod('src/a.ts', TRIVIAL_LIMITS.lines, 1)]), 'standard');
    assert.equal(level([{ ...mod('src/new.ts'), status: 'A' }]), 'standard');
    assert.equal(level([{ ...mod('src/old.ts'), status: 'D' }]), 'standard');
    assert.equal(level([{ path: 'logo.png', status: 'M', added: null, deleted: null, binary: true }]), 'standard');

    for (const file of [
      'package.json',
      'pnpm-lock.yaml',
      'requirements-dev.txt',
      'db/migrations/001_init.sql',
      'src/authService.ts',
      'api/webhooks/stripe.ts',
      '.env.local',
      '.github/workflows/ci.yml',
      'Dockerfile',
      '.claude/settings.json',
      '.workflow/context/quality.md',
      'packages/api/AGENTS.md',
      'packages/api/CLAUDE.md',
      'packages/api/.claude/settings.json',
      'apps/web/.cursor/rules/style.mdc',
    ]) {
      assert.equal(level([mod(file)]), 'high', file);
    }
    const huge = Array.from({ length: HIGH_LIMITS.files + 1 }, (_, i) => mod(`src/f${i}.ts`));
    assert.equal(level(huge), 'high');
    assert.equal(level([mod('src/a.ts', HIGH_LIMITS.lines, 1)]), 'high');
    assert.deepEqual(classifyStats([mod('src/authService.ts')]).reasons, ['security src/authService.ts']);
  });

  test('classify and scan measure only what changed since begin', async () => {
    const cwd = await repo();
    try {
      // Edits the user had before the command started.
      writeFileSync(path.join(cwd, 'package.json'), '{}\n');
      writeFileSync(path.join(cwd, 'old.test.js'), 'it.skip("earlier", () => {});\n');
      assert.equal((await classify({ root: cwd })).base, 'HEAD');
      assert.equal((await classify({ root: cwd })).level, 'high');

      await begin({ root: cwd });
      assert.equal((await classify({ root: cwd })).files, 0);
      writeFileSync(path.join(cwd, 'src.js'), 'export const one = 2;\n');
      const sized = await classify({ root: cwd });
      assert.equal(sized.base, 'begin');
      assert.equal(sized.level, 'trivial');
      assert.equal(sized.files, 1);
      assert.equal(sized.lines, 2);
      assert.deepEqual((await scan({ root: cwd })).signals, []);
      assert.equal((await scan({ root: cwd, base: 'HEAD' })).signals.length, 1);

      // Repairs after the first classify are counted at end.
      writeFileSync(path.join(cwd, 'package.json'), '{"name":"x"}\n');
      const ended = await end({ root: cwd });
      assert.equal(ended.classification.level, 'high');
      assert.deepEqual(ended.classification.triggers, [{ path: 'package.json', trigger: 'dependencies' }]);
      assert.equal((await end({ root: cwd })).classification, null);
      assert.equal((await classify({ root: cwd })).base, 'HEAD');
      assert.equal(await git(cwd, ['status', '--porcelain', '--', '.workflow']), '');
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test('a dirty submodule disables reuse and freshness; a clean one does not', async () => {
    const dep = await repo({ rows: [] });
    const cwd = await repo({ rows: [['Test', `node -e "process.exit(require('fs').readFileSync('dep/value', 'utf8').startsWith('good') ? 0 : 1)"`]] });
    try {
      writeFileSync(path.join(dep, 'value'), 'good\n');
      await git(dep, ['add', '-A']);
      await git(dep, ['commit', '-qm', 'value']);
      await git(cwd, ['-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', dep, 'dep']);
      await git(cwd, ['commit', '-qm', 'add submodule']);

      assert.equal((await run({ root: cwd })).fresh, true);
      assert.equal((await run({ root: cwd })).rows[0].reused, true);

      writeFileSync(path.join(cwd, 'dep/value'), 'bad\n');
      const dirty = await run({ root: cwd });
      assert.equal(dirty.result, 'FAIL');
      assert.equal(dirty.rows[0].reused, false);
      assert.equal(dirty.fresh, false);
      assert.equal(dirty.reason, 'dirty-submodule');
      assert.deepEqual(dirty.dirtySubmodules, ['dep']);
      assert.equal((await status({ root: cwd })).reason, 'dirty-submodule');
      const sized = await classify({ root: cwd });
      assert.equal(sized.level, 'standard');
      assert.deepEqual(sized.reasons, ['dirty submodule dep']);

      // Fixing the submodule back must not revive the receipt of the dirty run.
      writeFileSync(path.join(cwd, 'dep/value'), 'good\n');
      assert.equal((await run({ root: cwd })).result, 'PASS');

      const edits = await repo({ rows: [['Test', `node -e "require('fs').writeFileSync('dep/value', 'edited')"`]] });
      try {
        await git(edits, ['-c', 'protocol.file.allow=always', 'submodule', 'add', '-q', dep, 'dep']);
        await git(edits, ['commit', '-qm', 'add submodule']);
        const result = await run({ root: edits });
        assert.equal(result.reason, 'tree-changed-during-run');
        assert.deepEqual(result.rows[0].changedFiles, ['dep']);
      } finally {
        rmSync(edits, { recursive: true, force: true });
      }
    } finally {
      rmSync(cwd, { recursive: true, force: true });
      rmSync(dep, { recursive: true, force: true });
    }
  });

  test('trailers group by feature, flag conflicts and drop invalid values', () => {
    const c = (sha, trailers, extra = {}) => ({
      sha,
      parents: ['p'],
      subject: `s ${sha}`,
      trailers: Object.entries(trailers).flatMap(([key, values]) => [values].flat().map((value) => ({ key: `Produktiv-${key}`, value }))),
      unparsed: [],
      revertOf: null,
      ...extra,
    });
    const value = summarizeTrailers([
      c('a1', { Feature: 'checkout', Unit: 'U1, U3', Ticket: 'prepare-snapshot' }),
      c('a2', { Feature: 'checkout', Unit: ['U2', 'U10'] }),
      c('b1', { Feature: 'billing', Ticket: 'prepare-snapshot' }),
      c('x1', { Unit: 'U4' }),
      c('x2', { Feature: ['checkout', 'billing'] }),
      c('x3', { Feature: 'checkout', Ticket: ['one', 'two'] }),
      c('x4', { Feature: '../../etc', Ticket: 'docs/x', Unit: 'U5 $(rm)' }),
      c('m1', {}, { parents: ['p', 'q'] }),
      c('n1', {}, { unparsed: [{ key: 'Produktiv-Unit', value: 'U9' }] }),
    ]);
    assert.equal(value.commits, 9);
    assert.equal(value.merges, 1);
    assert.equal(value.mixed, true);
    // A merge without trailers is not an untagged change.
    assert.deepEqual(value.untagged, ['n1']);
    const checkout = value.features.find((f) => f.feature === 'checkout');
    assert.deepEqual(checkout.units, ['U1', 'U2', 'U3', 'U10']);
    assert.deepEqual(checkout.tickets, ['one', 'prepare-snapshot', 'two']);
    const types = value.conflicts.map((x) => `${x.type}:${x.sha ?? x.ticket}`).sort();
    assert.deepEqual(types, [
      'invalid-value:x4',
      'invalid-value:x4',
      'invalid-value:x4',
      'no-feature:x1',
      'no-feature:x4',
      'several-features:x2',
      'several-tickets:x3',
      'ticket-in-several-features:prepare-snapshot',
    ]);
    // An unsafe value is reported, never passed on as a name.
    assert.ok(value.conflicts.some((x) => x.value === '../../etc'));
    assert.ok(!JSON.stringify(value.features).includes('etc'));
    assert.deepEqual(value.unparsed, [{ sha: 'n1', key: 'Produktiv-Unit', value: 'U9' }]);
  });

  test('a reverted commit no longer counts; reverting the revert restores it', () => {
    const c = (sha, unit, revertOf = null) => ({
      sha,
      parents: ['p'],
      subject: sha,
      trailers: unit ? [{ key: 'Produktiv-Feature', value: 'checkout' }, { key: 'Produktiv-Unit', value: unit }] : [],
      unparsed: [],
      revertOf,
    });
    const sha = (n) => n.repeat(40);
    const once = summarizeTrailers([c(sha('b'), null, sha('a')), c(sha('a'), 'U1'), c(sha('c'), 'U2')], { feature: 'checkout' });
    assert.deepEqual(once.features[0].units, ['U2']);
    assert.deepEqual(once.reverted, [{ sha: sha('a'), by: [sha('b')] }]);
    assert.equal(once.features[0].commits.find((x) => x.sha === sha('a')).reverted, true);
    assert.deepEqual(once.untagged, []);
    const twice = summarizeTrailers([c(sha('d'), null, sha('b')), c(sha('b'), null, sha('a')), c(sha('a'), 'U1')], { feature: 'checkout' });
    assert.deepEqual(twice.features[0].units, ['U1']);
    assert.deepEqual(twice.reverted.map((x) => x.sha), [sha('b')]);
  });

  test('trailers through the CLI and the package link: range, feature, revert, failures', async () => {
    const cwd = await repo();
    const links = mkdtempSync(path.join(tmpdir(), 'produktiv-gate-link-'));
    // One new file per commit, so a later revert applies cleanly.
    const commit = async (message) => {
      const file = `c${Math.random().toString(36).slice(2)}.txt`;
      writeFileSync(path.join(cwd, file), 'x\n');
      await git(cwd, ['add', file]);
      const child = execFile('git', ['commit', '-q', '-F', '-'], { cwd });
      child.stdin.end(message);
      await new Promise((resolve, reject) => child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`commit ${code}`)))));
      return git(cwd, ['rev-parse', 'HEAD']);
    };
    try {
      symlinkSync(workflow, path.join(links, 'produktiv'), 'dir');
      const linked = path.join(links, 'produktiv/adapters/host/gate.mjs');
      const base = await git(cwd, ['rev-parse', 'HEAD']);
      const first = await commit('feat: one\n\nProduktiv-Feature: checkout\nProduktiv-Unit: U1\nProduktiv-Ticket: prepare-snapshot\n');
      await commit('chore: untagged\n');
      await commit('feat: other\n\nProduktiv-Feature: billing\nProduktiv-Unit: U1\n');
      await git(cwd, ['revert', '--no-edit', first]);

      const ranged = await cli(cwd, ['trailers', '--range', `${base}..HEAD`], linked);
      assert.equal(ranged.code, 0, ranged.stderr);
      const r = JSON.parse(ranged.stdout);
      assert.equal(r.kind, 'produktiv-trailers');
      assert.equal(r.result, 'OK');
      assert.equal(r.commits, 4);
      assert.equal(r.mixed, true);
      assert.equal(r.untaggedCount, 1);
      assert.deepEqual(r.reverted.map((x) => x.sha), [first]);
      assert.deepEqual(r.features.find((f) => f.feature === 'checkout').units, []);
      assert.match(r.notice, /not evidence/);

      const byFeature = JSON.parse((await cli(cwd, ['trailers', '--feature', 'checkout'])).stdout);
      assert.equal(byFeature.commits, 2);
      assert.equal(byFeature.mixed, false);
      assert.deepEqual(byFeature.reverted.map((x) => x.sha), [first]);

      const bad = await cli(cwd, ['trailers', '--range', 'nope..HEAD']);
      assert.equal(bad.code, 1);
      assert.equal(JSON.parse(bad.stdout).result, 'BLOCKED');
      const outside = mkdtempSync(path.join(tmpdir(), 'produktiv-gate-nogit-'));
      try {
        const none = await cli(outside, ['trailers', '--feature', 'checkout']);
        assert.equal(none.code, 1);
        assert.equal(JSON.parse(none.stdout).reason, 'not-a-git-repository');
      } finally {
        rmSync(outside, { recursive: true, force: true });
      }
      for (const args of [['trailers'], ['trailers', '--range', 'HEAD'], ['trailers', '--feature', '../x'], ['scan', '--feature', 'a'], ['trailers', '--range', 'a..b', '--feature', 'c']]) {
        assert.equal((await cli(cwd, args)).code, 2, args.join(' '));
      }
    } finally {
      rmSync(cwd, { recursive: true, force: true });
      rmSync(links, { recursive: true, force: true });
    }
  });

  test('usage errors exit 2', async () => {
    assert.equal((await cli(tmpdir(), [])).code, 2);
    assert.equal((await cli(tmpdir(), ['run', '--timeout', '0'])).code, 2);
    assert.equal((await cli(tmpdir(), ['run', '--bogus'])).code, 2);
  });
});
