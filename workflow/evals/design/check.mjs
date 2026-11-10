import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workflow = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

// Fixture portability only: no skill invocation, acceptance decision or browser proof.
test('accepted visual slices survive transfer without the draft, cache or conversation', () => {
  // Byte copy of an accepted visual context, kept as a fixture.
  const source = path.join(workflow, 'evals/fixtures/design-transfer/project');
  const root = mkdtempSync(path.join(tmpdir(), 'produktiv-design-transfer-'));
  try {
    mkdirSync(path.join(root, '.workflow/context'), { recursive: true });
    cpSync(path.join(source, '.workflow/context/design.md'), path.join(root, '.workflow/context/design.md'));
    cpSync(path.join(source, 'docs/design'), path.join(root, 'docs/design'), { recursive: true });
    const contextPath = path.join(root, '.workflow/context/design.md');
    const context = readFileSync(contextPath, 'utf8');
    const selected = [...context.matchAll(/\]\(([^)]+)\)/g)].map(m => m[1]).filter(link => link.startsWith('../../docs/design/'));
    assert.ok(selected.length > 5, 'fixture must exercise several actual accepted states');
    for (const link of selected) {
      const [relative, fragment] = link.split('#');
      const target = path.resolve(path.dirname(contextPath), relative);
      assert.ok(target.startsWith(path.join(root, 'docs/design') + path.sep));
      const html = readFileSync(target, 'utf8');
      if (fragment) {
        const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
        assert.equal(ids.filter(id => id === fragment).length, 1, link);
      }
      // This historical artifact declares itself self-contained. Guard that
      // property without pretending this narrow scan is a general HTML checker.
      assert.doesNotMatch(html, /<(?:script|img|link)\b[^>]*\b(?:src|href)\s*=|@import\b|url\s*\(/i);
    }
    for (const absent of ['design-proposal.html', '.workflow/cache', '.workflow/handoff.md']) {
      assert.equal(existsSync(path.join(root, absent)), false);
    }
    // Historical evidence links are intentionally not copied or promoted into
    // accepted presentation dependencies; the original receipt stays untouched.
  } finally { rmSync(root, { recursive: true, force: true }); }
});
