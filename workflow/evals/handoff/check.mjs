import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workflow = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = p => readFileSync(path.join(workflow, p), 'utf8');

// Integration/fixture controls only. Model behavior is recorded separately.
test('handoff resource pointers resolve in the canonical package tree', () => {
  for (const name of ['skills/pk-handoff/SKILL.md', 'references/handoff-resume.md']) {
    for (const [, resource] of read(name).matchAll(/`((?:policies|references|templates)\/[a-zA-Z0-9/.-]+\.(?:md|txt))`/g)) {
      assert.ok(existsSync(path.join(workflow, resource)), name + ': ' + resource);
    }
  }
});

test('setup ignore rules keep a handoff local while durable project context remains visible', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'produktiv-handoff-ignore-'));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });
  try {
    git('init', '--quiet');
    writeFileSync(path.join(root, '.gitignore'), read('templates/gitignore-workflow.txt'));
    mkdirSync(path.join(root, '.workflow/context'), { recursive: true });
    writeFileSync(path.join(root, '.workflow/context/project.md'), '# Accepted foundation\n');
    writeFileSync(path.join(root, '.workflow/handoff.md'), '# Temporary delta\n');
    assert.equal(git('check-ignore', '.workflow/handoff.md').trim(), '.workflow/handoff.md');
    const status = git('status', '--porcelain', '--untracked-files=all');
    assert.ok(status.includes('.workflow/context/project.md'));
    assert.ok(!status.includes('handoff.md'));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('real Git fixture distinguishes unrelated commit drift from same-HEAD affected content drift', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'produktiv-handoff-drift-'));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const put = (p, body) => writeFileSync(path.join(root, p), body);
  const fingerprint = p => createHash('sha256').update(readFileSync(path.join(root, p))).digest('hex');
  const commit = message => git('-c', 'user.name=Eval', '-c', 'user.email=eval@localhost', 'commit', '--quiet', '-m', message);
  try {
    git('init', '--quiet');
    put('plan.md', '# Plan\nU1: inspect retry failure\n'); put('README.md', '# Fixture\n');
    git('add', '.'); commit('A'); const a = git('rev-parse', 'HEAD');
    put('README.md', '# Fixture clarified\n'); git('add', 'README.md'); commit('B');
    const b = git('rev-parse', 'HEAD'); assert.notEqual(a, b);
    assert.equal(git('diff', '--name-only', a, b, '--', 'plan.md'), '');
    put('plan.md', '# Plan\nU1: inspect persistence failure\n');
    const first = fingerprint('plan.md'), status = git('status', '--porcelain');
    put('plan.md', '# Plan\nU1: verify current persistence fix\n');
    assert.equal(git('rev-parse', 'HEAD'), b);
    assert.equal(git('status', '--porcelain'), status);
    assert.notEqual(fingerprint('plan.md'), first);
    git('add', 'plan.md'); commit('C');
    assert.equal(git('diff', '--name-only', b, 'HEAD', '--', 'plan.md'), 'plan.md');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
