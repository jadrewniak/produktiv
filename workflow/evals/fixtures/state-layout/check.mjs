/**
 * Static check that the state reference and gitignore template match
 * the section 2 encoding. Nothing here creates .workflow/.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const workflowDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const reference = readFileSync(path.join(workflowDir, 'references/state-layout.md'), 'utf8');
const template = readFileSync(path.join(workflowDir, 'templates/gitignore-workflow.txt'), 'utf8');

const IGNORED = [
  '.workflow/graph/',
  '.workflow/cache/',
  '.workflow/local/',
  '.workflow/handoff.md',
];

test('the gitignore template names the four ignored paths and not config', () => {
  const patterns = template
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'));
  assert.deepEqual([...patterns].sort(), [...IGNORED].sort());
  assert.equal(patterns.includes('.workflow/config.yaml'), false);
  assert.equal(patterns.some((line) => line.includes('config.yaml')), false);
  assert.equal(patterns.some((line) => line.includes('.workflow/context')), false);
});

test('the reference assigns each section 2 path to a state class', () => {
  const paths = [
    '.workflow/',
    '.workflow/config.yaml',
    '.workflow/context/project.md',
    '.workflow/context/domain.md',
    '.workflow/context/quality.md',
    '.workflow/context/design.md',
    '.workflow/local/preferences.yaml',
    '.workflow/graph/',
    '.workflow/cache/graph/',
    '.workflow/handoff.md',
    'docs/issues/*.md',
    'docs/tickets/*.md',
    'docs/specs/',
    'docs/plans/',
    'docs/adr/',
  ];
  for (const entry of paths) assert.ok(reference.includes(entry), entry);

  for (const name of ['Durable shared', 'Local durable', 'Generated', 'Temporary', 'Runtime fact']) {
    assert.ok(reference.includes(name), name);
  }

  assert.match(reference, /Runtime facts are not written into config/);
  assert.match(reference, /Replaced, never appended/);
  assert.match(reference, /technical_depth/);
  assert.match(reference, /graph\.enabled/);
  assert.match(reference, /does not ignore `\.workflow\/config\.yaml` or `\.workflow\/context\/`/);
  for (const entry of IGNORED) assert.ok(reference.includes(entry), entry);
});
