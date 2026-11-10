/**
 * Area 2: a planted Correctness bug the project's own tests do not catch.
 * A reviewer has to propose a trigger and the orchestrator has to run it.
 * These checks prove the fixture is valid: the suite passes on the planted
 * tree, the reference trigger fails there and passes on the fixed code.
 * They do not prove a model finds the bug; that needs a real run.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const project = path.join(here, 'coupon');
const reference = path.join(here, 'reference');
const read = (file) => readFileSync(file, 'utf8');

// Two lines and one coupon: the order loses `off` once, not once per line.
const TRIGGER = { lines: [{ price: 1000, qty: 1 }, { price: 500, qty: 1 }], coupon: { off: 300 }, expected: 1200 };

function withCopy(fn, replaceSource) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'produktiv-review-trigger-'));
  try {
    cpSync(project, dir, { recursive: true });
    if (replaceSource) copyFileSync(replaceSource, path.join(dir, 'src/cart.mjs'));
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function runSuite(dir) {
  // The outer runner's context would make the child skip its test files.
  const { NODE_TEST_CONTEXT, ...env } = process.env;
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=spec'], { cwd: dir, encoding: 'utf8', env });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

async function totalFrom(file) {
  return (await import(`${pathToFileURL(file).href}?t=${Date.now()}`)).total;
}

test('the project suite passes on the planted tree, so the bug is invisible to it', () => {
  const { status, output } = withCopy(runSuite);
  assert.equal(status, 0, output);
  assert.match(output, /^ℹ pass 3$/m);
});

test('the reference trigger shows the defect on the planted code', async () => {
  const total = await totalFrom(path.join(project, 'src/cart.mjs'));
  assert.equal(total(TRIGGER.lines, TRIGGER.coupon), 900);
  assert.notEqual(total(TRIGGER.lines, TRIGGER.coupon), TRIGGER.expected);
});

test('the fixed code passes the trigger and the same suite', async () => {
  const total = await totalFrom(path.join(reference, 'fixed.mjs'));
  assert.equal(total(TRIGGER.lines, TRIGGER.coupon), TRIGGER.expected);
  const { status, output } = withCopy(runSuite, path.join(reference, 'fixed.mjs'));
  assert.equal(status, 0, output);
});

test('the planted change preserves the plain total of the baseline', async () => {
  const planted = await totalFrom(path.join(project, 'src/cart.mjs'));
  const baseline = await totalFrom(path.join(reference, 'baseline.mjs'));
  assert.equal(planted(TRIGGER.lines), baseline(TRIGGER.lines));
  const baselineTest = read(path.join(reference, 'baseline.test.mjs'));
  assert.ok(read(path.join(project, 'src/cart.test.mjs')).startsWith(baselineTest.trimEnd()));
});

test('the contract states the rule and nothing in the code points at the bug', () => {
  assert.match(read(path.join(project, 'docs/issues/cart.md')), /off the order once, whatever the number of lines/);
  assert.match(read(path.join(project, 'docs/plans/cart.md')), /^issue: docs\/issues\/cart\.md$/m);
  for (const file of ['src/cart.mjs', 'src/cart.test.mjs']) {
    const text = read(path.join(project, file));
    assert.equal(/\/\/|\/\*|review|bug|per line|once/i.test(text), false, file);
  }
});
