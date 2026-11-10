/**
 * Temp-repo checks for the Git helper.
 * show must return HEAD bytes, not a dirty worktree edit.
 * A missing Git binary must throw, not look like an empty tree.
 * commitTrailers reads only Git's trailer block and reports the rest.
 */

import { execFile } from 'node:child_process';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, test } from 'node:test';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import { GIT_TIMEOUT_MS, commitTrailers, diffNames, head, listTree, show } from '../../../adapters/host/git.mjs';

const execFileAsync = promisify(execFile);
const helperSource = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../adapters/host/git.mjs'),
  'utf8',
);

function git(cwd, args) {
  return execFileAsync('git', args, { cwd }).then(({ stdout }) => stdout.toString('utf8').trim());
}

function initRepo() {
  const cwd = mkdtempSync(path.join(tmpdir(), 'produktiv-git-'));
  return git(cwd, ['init', '-b', 'main'])
    .then(() => git(cwd, ['config', 'user.email', 'eval@produktiv.invalid']))
    .then(() => git(cwd, ['config', 'user.name', 'Produktiv Eval']))
    .then(() => git(cwd, ['config', 'commit.gpgsign', 'false']))
    .then(() => cwd);
}

describe('git helper', { concurrency: false }, () => {
  test('uses execFile with a 5 second timeout and no shell', () => {
    assert.equal(GIT_TIMEOUT_MS, 5000);
    assert.match(helperSource, /execFile\(/);
    assert.match(helperSource, /timeout:\s*slow \? GIT_SNAPSHOT_TIMEOUT_MS : GIT_TIMEOUT_MS/);
    assert.doesNotMatch(helperSource, /\bexec\(/);
    assert.doesNotMatch(helperSource, /shell:\s*true/);
  });

  test('show returns committed bytes that differ from a dirty worktree edit', async () => {
    const cwd = await initRepo();
    try {
      const note = path.join(cwd, 'dir', 'note.txt');
      mkdirSync(path.dirname(note), { recursive: true });
      writeFileSync(note, 'committed\n');
      const binary = Buffer.from([0x00, 0xff, 0x10, 0x00]);
      writeFileSync(path.join(cwd, 'blob.bin'), binary);
      await git(cwd, ['add', 'dir/note.txt', 'blob.bin']);
      await git(cwd, ['commit', '-m', 'add files']);

      writeFileSync(note, 'dirty\n');
      writeFileSync(path.join(cwd, 'blob.bin'), Buffer.from([1, 2, 3]));
      writeFileSync(path.join(cwd, 'untracked.txt'), 'untracked\n');

      const text = await show(cwd, 'dir/note.txt');
      assert.ok(Buffer.isBuffer(text));
      assert.equal(text.toString('utf8'), 'committed\n');
      assert.equal(readFileSync(note, 'utf8'), 'dirty\n');
      assert.deepEqual(await show(cwd, 'blob.bin'), binary);

      assert.equal(await head(cwd), await git(cwd, ['rev-parse', 'HEAD']));
      assert.deepEqual([...(await listTree(cwd))].sort(), ['blob.bin', 'dir/note.txt']);
      assert.deepEqual([...(await diffNames(cwd))].sort(), ['blob.bin', 'dir/note.txt']);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test('listTree stays on HEAD while diffNames covers worktree, cached, and A..B', async () => {
    const cwd = await initRepo();
    try {
      writeFileSync(path.join(cwd, 'kept.txt'), 'one\n');
      await git(cwd, ['add', 'kept.txt']);
      await git(cwd, ['commit', '-m', 'first']);
      const first = await head(cwd);

      writeFileSync(path.join(cwd, 'added.txt'), 'two\n');
      await git(cwd, ['add', 'added.txt']);
      await git(cwd, ['commit', '-m', 'second']);

      assert.deepEqual(await diffNames(cwd, [`${first}..HEAD`]), ['added.txt']);

      writeFileSync(path.join(cwd, 'staged.txt'), 'three\n');
      await git(cwd, ['add', 'staged.txt']);
      writeFileSync(path.join(cwd, 'kept.txt'), 'dirty\n');

      assert.deepEqual(await listTree(cwd), ['added.txt', 'kept.txt']);
      assert.deepEqual(await diffNames(cwd, ['--cached']), ['staged.txt']);
      assert.deepEqual(await diffNames(cwd), ['kept.txt']);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test('an empty committed tree is an empty list, and a Git failure is not', async () => {
    const cwd = await initRepo();
    try {
      await git(cwd, ['commit', '--allow-empty', '-m', 'empty']);
      assert.deepEqual(await listTree(cwd), []);
      assert.deepEqual(await diffNames(cwd), []);

      await assert.rejects(show(cwd, 'missing.txt'), (error) => {
        assert.match(error.message, /missing\.txt/);
        assert.match(error.stderr, /missing\.txt/);
        return true;
      });
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }

    const notRepo = mkdtempSync(path.join(tmpdir(), 'produktiv-not-git-'));
    try {
      await assert.rejects(listTree(notRepo), (error) => {
        assert.match(error.message, /not a git repository/i);
        assert.match(error.stderr, /not a git repository/i);
        return true;
      });
    } finally {
      rmSync(notRepo, { recursive: true, force: true });
    }
  });

  test('a missing Git binary throws instead of returning an empty list', async () => {
    const cwd = await initRepo();
    const saved = process.env.PATH;
    process.env.PATH = mkdtempSync(path.join(tmpdir(), 'produktiv-no-git-'));
    try {
      await assert.rejects(listTree(cwd), (error) => {
        assert.equal(error.code, 'ENOENT');
        assert.match(error.message, /git/);
        return true;
      });
    } finally {
      process.env.PATH = saved;
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test('commitTrailers reads the trailer block and reports trailer-like lines Git skipped', async () => {
    const cwd = await initRepo();
    const commit = async (message) => {
      writeFileSync(path.join(cwd, 'f.txt'), `${Math.random()}\n`);
      await git(cwd, ['add', 'f.txt']);
      const child = execFile('git', ['commit', '-q', '-F', '-'], { cwd });
      child.stdin.end(message);
      await new Promise((resolve, reject) => child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`commit ${code}`)))));
      return git(cwd, ['rev-parse', 'HEAD']);
    };
    try {
      const base = await commit('base\n');
      await commit('feat: a\n\nbody\n\nproduktiv-feature : checkout\nProduktiv-Unit: U1,\n  U3\nProduktiv-Ticket: prepare-snapshot\nCo-Authored-By: X <x@y.z>\n');
      await commit('feat: prose above\n\nSome prose that runs into the trailer\nProduktiv-Unit: U4\n');
      // Folded: Git unfolds the value onto the key line, so the feature prefilter must keep it.
      await commit('feat: folded\n\nProduktiv-Feature:\n checkout\nProduktiv-Unit: U2\n');
      await commit('feat: other feature\n\nProduktiv-Feature: billing\n');
      await commit('Squash (#12)\n\n* feat: a\n\nProduktiv-Feature: checkout\nProduktiv-Unit: U1\n\n* feat: b\n\nProduktiv-Feature: checkout\nProduktiv-Unit: U2\nCo-authored-by: X <x@y.z>\n');
      // Repository config must not leak signature output or new separators into the result.
      await git(cwd, ['config', 'log.showSignature', 'true']);
      await git(cwd, ['config', 'trailer.separators', ':#']);
      await commit('fix: hash separator\n\nProduktiv-Unit# U7\n');

      const { commits, truncated } = await commitTrailers(cwd, { range: `${base}..HEAD` });
      assert.equal(truncated, false);
      const [hash, squash, , folded, prose, first] = commits;
      assert.deepEqual(folded.trailers, [
        { key: 'Produktiv-Feature', value: 'checkout' },
        { key: 'Produktiv-Unit', value: 'U2' },
      ]);
      assert.deepEqual(first.trailers, [
        { key: 'Produktiv-Feature', value: 'checkout' },
        { key: 'Produktiv-Unit', value: 'U1, U3' },
        { key: 'Produktiv-Ticket', value: 'prepare-snapshot' },
      ]);
      assert.deepEqual(first.unparsed, []);
      assert.equal(first.subject, 'feat: a');
      assert.deepEqual(prose.trailers, []);
      assert.deepEqual(prose.unparsed, [{ key: 'Produktiv-Unit', value: 'U4' }]);
      // A squash keeps only its last paragraph as trailers; the rest is reported, not lost.
      assert.deepEqual(squash.trailers, [
        { key: 'Produktiv-Feature', value: 'checkout' },
        { key: 'Produktiv-Unit', value: 'U2' },
      ]);
      assert.deepEqual(squash.unparsed, [
        { key: 'Produktiv-Feature', value: 'checkout' },
        { key: 'Produktiv-Unit', value: 'U1' },
      ]);
      assert.deepEqual(hash.trailers, []);
      assert.match(hash.sha, /^[0-9a-f]{40}$/);

      const one = await commitTrailers(cwd, { range: `${base}..HEAD`, maxCount: 2 });
      assert.equal(one.commits.length, 2);
      assert.equal(one.truncated, true);

      const byFeature = await commitTrailers(cwd, { feature: 'checkout' });
      // Other features stay out of the prefilter, so they do not use up the commit limit.
      assert.deepEqual(byFeature.commits.map((c) => c.subject), ['Squash (#12)', 'feat: folded', 'feat: a']);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test('commitTrailers refuses unsafe input and handles a repository without commits', async () => {
    const cwd = await initRepo();
    try {
      assert.deepEqual(await commitTrailers(cwd, { feature: 'checkout' }), { commits: [], truncated: false });
      await assert.rejects(commitTrailers(cwd, { range: '--all' }), /refusing range/);
      await assert.rejects(commitTrailers(cwd, { range: 'HEAD' }), /refusing range/);
      await assert.rejects(commitTrailers(cwd, { feature: '../secret' }), /refusing feature/);
      await assert.rejects(commitTrailers(cwd, { feature: 'a/b' }), /refusing feature/);
      await assert.rejects(commitTrailers(cwd, {}), /exactly one/);
      await assert.rejects(commitTrailers(cwd, { range: 'a..b', feature: 'c' }), /exactly one/);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test('absolute paths, parent segments, and unexpected diff args are refused', async () => {
    const cwd = await initRepo();
    try {
      await git(cwd, ['commit', '--allow-empty', '-m', 'empty']);
      await assert.rejects(show(cwd, '/etc/passwd'), /refusing absolute path/);
      await assert.rejects(show(cwd, 'C:\\Windows\\System32'), /refusing absolute path/);
      await assert.rejects(show(cwd, '../secret'), /refusing path that contains '\.\.'/);
      await assert.rejects(show(cwd, 'foo/../../etc/passwd'), /refusing path that contains '\.\.'/);
      await assert.rejects(diffNames(cwd, '--cached'), /diff args must be an array/);
      await assert.rejects(diffNames(cwd, ['--stat']), /refusing diff argument/);
      assert.deepEqual(await listTree(cwd), []);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
