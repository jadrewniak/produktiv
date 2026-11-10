/**
 * The completion-review prompt is the only criteria, and the negative fixture
 * plants an extra export the Issue and the Plan do not name.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const workflowDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const prompt = readFileSync(path.join(workflowDir, 'agents/completion-review/v5.md'), 'utf8');
const skill = readFileSync(path.join(workflowDir, 'skills/pk-implement/SKILL.md'), 'utf8');
const fixtureDir = path.join(workflowDir, 'evals/fixtures/completion-review/extra-export');
const issue = readFileSync(path.join(fixtureDir, 'issue.md'), 'utf8');
const plan = readFileSync(path.join(fixtureDir, 'plan.md'), 'utf8');
const source = readFileSync(path.join(fixtureDir, 'src/greet.mjs'), 'utf8');
const spec = readFileSync(path.join(fixtureDir, 'src/greet.test.mjs'), 'utf8');
const diff = readFileSync(path.join(fixtureDir, 'slice.diff'), 'utf8');

const SCORE = /\b\d+\s*\/\s*\d+\b|\b\d+\s*%|grade\s*[:=]|score\s*[:=]\s*\d/i;

test('the prompt states v5 on the first line and keeps the fixed rubric', () => {
  assert.equal(prompt.split('\n')[0], 'Version: v5');
  for (const axis of ['### Correctness', '### Compliance', '### Standards']) {
    assert.ok(prompt.includes(axis), axis);
  }
  for (const severity of ['BLOCKER', 'IMPORTANT', 'MINOR', 'NOTE']) {
    assert.ok(prompt.includes(severity), severity);
  }
  assert.match(prompt, /new public surface, dependency, service or configuration/);
  assert.match(prompt, /no numeric grade/);
  assert.match(prompt, /edit files/);
  assert.equal(SCORE.test(prompt), false);
});

test('the implement skill points at the prompt and does not define the criteria', () => {
  assert.match(skill, /agents\/completion-review\/v5\.md/);
  assert.match(skill, /That file is the only criteria/);
  for (const axis of ['### Correctness', '### Compliance', '### Standards']) {
    assert.equal(skill.includes(axis), false, axis);
  }
  assert.equal(skill.includes('exported function'), false);
  assert.equal(skill.includes('A new public surface'), false);
});

test('the negative fixture exports a function the Issue and the Plan do not name', () => {
  const waveLine = source.split('\n').findIndex((line) => line.startsWith('export function wave')) + 1;
  assert.ok(waveLine > 0);
  assert.equal(issue.includes('wave'), false);
  assert.equal(plan.includes('wave'), false);
  assert.equal(spec.includes('wave'), false);
  assert.match(diff, /export function wave/);
  assert.match(issue, /farewell/);
  assert.match(plan, /farewell/);
});
