import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

test('no tracked text file carries a developer home path', () => {
  const result = spawnSync(
    'git',
    ['grep', '-nIE', '/(Users|home)/[a-z0-9_-]+/(Developer|\\.nvm|\\.npm|\\.codex|\\.claude)', '--', '.', ':!workflow/vendor'],
    { cwd: repo, encoding: 'utf8' },
  );
  assert.equal(result.error, undefined);
  // git grep exits 1 when nothing matches.
  assert.equal(result.status, 1, result.stdout);
});
