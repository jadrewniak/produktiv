import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');
const skill = read('skills/pk-to-plan/SKILL.md');

// Benchmark T3: both Produktiv routes wrote "a successful init replaces the ledger" into a Spec unasked.
test('carried-over data loss needs an explicit owner choice', () => {
  assert.match(read('policies/decisions.md'), /Carrying existing behavior into a contract is also a choice/);
  assert.match(read('policies/decisions.md'), /Current code is not consent/);
  assert.match(read('skills/pk-to-spec/SKILL.md'), /name every guarantee that destroys or overwrites user data/);
});

// Benchmark T3: /pk-debug refused three times although the report itself said "Init must refuse".
test('an explicit owner statement resolves a contract disagreement in debug', () => {
  const debug = read('skills/pk-debug/SKILL.md');
  assert.match(debug, /that statement is the owner's choice for this behavior/);
  assert.match(debug, /change only the disagreeing sentence in its owner/);
  assert.match(debug, /quoted without that statement does not count/);
  assert.match(debug, /Do not edit a test, an Issue, or a Spec so the failure matches the code/);
});

// A benchmark Plan saw that the README rule also covered --shares, froze the literal report and left it broken.
test('a defect Plan covers same-cause paths or names them as exclusions', () => {
  assert.match(skill, /the requested behavior is the broken rule, not only the reported example/);
  assert.match(skill, /same cause or governed by the same documented rule/);
  assert.match(skill, /owner-visible exclusion/);
  assert.match(skill, /they are not invented acceptance/);
  assert.match(skill, /Report unrelated defects without adding them to the route/);
});
