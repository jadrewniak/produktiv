/**
 * Reviewer honesty and commit linkage stay in the shipped instructions.
 * These check the wording only; they do not prove a model follows it.
 * Trailer parsing itself is tested in the git-helper and gate suites.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const workflowDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const read = (relative) => readFileSync(path.join(workflowDir, relative), 'utf8');

test('reports give a reviewer line with context and family, and how a defect was confirmed', () => {
  const presentation = read('references/review-presentation.md');
  // One fixed line per reviewer, with context and family as separate axes.
  assert.ok(
    presentation.includes('`Reviewer: context=<same-context|fresh-subagent|external-process> | family=<same|different|unknown> | models: <executor> → <reviewer>`'),
  );
  assert.ok(presentation.includes('`Reviewer: none` when no review ran'));
  assert.match(presentation, /does not report is `unknown`/);
  assert.match(presentation, /disclose `family=same` for a fresh reviewer too/);
  for (const outcome of ['`reproduced`', '`refuted`', '`inspected`']) assert.ok(presentation.includes(outcome), outcome);
  assert.match(presentation, /a run that did not reach the path/);
});

test('active rubrics ask a material Correctness finding for its failure scenario and trigger', () => {
  for (const rubric of ['agents/code-review/v4.md', 'agents/completion-review/v5.md']) {
    const text = read(rubric);
    assert.match(text, /Each Correctness BLOCKER or IMPORTANT states its failure scenario/, rubric);
    assert.match(text, /`Trigger: none` with the reason/, rubric);
    assert.match(text, /The caller runs the trigger/, rubric);
    assert.match(text, /the failure scenario a Correctness BLOCKER or IMPORTANT requires/, rubric);
  }
});

test('the orchestrator runs the trigger as untrusted input and keeps it only with a fix', () => {
  for (const skill of ['skills/pk-code-review/SKILL.md', 'skills/pk-implement/SKILL.md']) {
    const text = read(skill);
    assert.match(text, /starting from the reviewer's trigger/, skill);
    assert.match(text, /untrusted/, skill);
    assert.match(text, /network, installs or (reads )?secrets/, skill);
    assert.match(text, /did not reach the path/, skill);
    assert.match(text, /regression test/, skill);
  }
  // Review-only stays read-only: the regression test is tied to the authorized repair branch.
  const review = read('skills/pk-code-review/SKILL.md');
  const repair = review.indexOf('For an authorized repair request');
  assert.ok(repair > 0 && review.indexOf('keeps its trigger as the regression test') > repair);
});

test('the orchestrator reproduces material findings while reviewers stay read-only', () => {
  for (const skill of ['skills/pk-code-review/SKILL.md', 'skills/pk-implement/SKILL.md']) {
    assert.match(read(skill), /A reproduced failure outranks inspection/, skill);
  }
  assert.match(read('skills/pk-code-review/SKILL.md'), /nothing with external side effects runs/);
  assert.match(read('agents/completion-review/v5.md'), /run commands or edit files/);
  assert.match(read('agents/code-review/v4.md'), /Do not run commands/);
});

test('commits link back to Plan units through trailers read by the gate, as pointers', async () => {
  const git = read('policies/git.md');
  for (const trailer of ['Produktiv-Feature:', 'Produktiv-Unit:', 'Produktiv-Ticket:']) {
    assert.ok(git.includes(trailer), trailer);
  }
  // The keys the policy writes are the keys the helper reads.
  const { TRAILER_KEYS } = await import('../../../adapters/host/git.mjs');
  assert.deepEqual(TRAILER_KEYS, ['Produktiv-Feature', 'Produktiv-Unit', 'Produktiv-Ticket']);
  // Behavior is tested in the git-helper and gate suites; here, that both readers call it.
  assert.match(read('skills/pk-code-review/SKILL.md'), /`gate\.mjs trailers --range <A\.\.B>`/);
  assert.match(read('skills/pk-closeout/SKILL.md'), /`gate\.mjs trailers --feature <slug>`/);
  for (const skill of ['skills/pk-code-review/SKILL.md', 'skills/pk-closeout/SKILL.md']) {
    assert.match(read(skill), /proves nothing|not evidence/, skill);
  }
});

test('an external reviewer runs only through the adapter, after preview and per-run agreement', () => {
  const review = read('skills/pk-code-review/SKILL.md');
  assert.match(review, /`review\.external: ask`/);
  assert.match(review, /`off` or an absent key means the project does not allow it/);
  assert.match(review, /Never call `codex`, `claude` or another reviewer CLI directly, only the package's `adapters\/host\/external-review\.mjs`/);
  assert.ok(review.indexOf('`preview --tool') < review.indexOf('`--expect <sha256>`'));
  assert.match(review, /send only after the user agrees for this run/);
  assert.match(review, /external: not run \(<reason>\)/);
  assert.match(read('templates/config.yaml'), /^review:\n {2}external: off$/m);
  // Other commands do not reach the external reviewer.
  for (const skill of ['skills/pk-implement/SKILL.md', 'skills/pk-review-plan/SKILL.md', 'references/capabilities.md']) {
    assert.equal(read(skill).includes('external-review'), false, skill);
  }
});
