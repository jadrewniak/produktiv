import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { parseArtifactIdentity, resolveUnique } from './lib/artifact-identity.mjs';
import { classifyRepositoryAccess } from './lib/repository-access.mjs';

const suite = path.dirname(fileURLToPath(import.meta.url));
const workflow = path.resolve(suite, '../..');
const root = path.dirname(workflow);
const read = (relative) => readFileSync(path.join(root, relative), 'utf8');

test('E01-E16 scenarios are fixed and withhold staged answers', () => {
  const scenarios = JSON.parse(readFileSync(path.join(suite, 'scenarios.json'), 'utf8'));
  assert.deepEqual(Object.keys(scenarios.cases), Array.from({ length: 16 }, (_, index) => `E${String(index + 1).padStart(2, '0')}`));
  assert.match(scenarios.withholdingRule, /Do not include staged answers/);
});

test('active contracts select closure loop and current rubrics', () => {
  const implement = read('workflow/skills/pk-implement/SKILL.md');
  assert.match(implement, /references\/execution\.md/);
  const execution = read('workflow/references/execution.md');
  for (const phrase of ['Session checklist and frontier', 'pending`, `in_progress`, `passed`, `deferred`, or `blocked', 'completion-review/v5.md', 'never shortens execution']) assert.match(execution, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(read('workflow/skills/pk-review-plan/SKILL.md'), /plan-review\/v8\.md/);
  assert.match(read('workflow/references/capabilities.md'), /Missing `HEAD` limits history\/graph operations/);
  assert.match(read('workflow/skills/pk-discover/SKILL.md'), /retain the whole V1/);
  assert.match(read('workflow/policies/design.md'), /chronology does not override acceptance/);
  assert.match(read('workflow/skills/pk-to-spec/SKILL.md'), /partial payment after a due date/);
  assert.match(read('workflow/agents/plan-review/v8.md'), /cold executor/);
});

test('E01 separates Git, HEAD, graph and Issues causes without a write probe', () => {
  const base = { gitRepo: true, remotes: ['owner/repo'], head: false, shell: true, ghFound: true };
  const gh = classifyRepositoryAccess({ ...base, ghRead: 'ok' });
  assert.equal(gh.git, 'repository');
  assert.equal(gh.head, 'missing');
  assert.equal(gh.graph, 'unavailable');
  assert.deepEqual(gh.issues, { read: true, write: 'unknown', reason: null });
  const connector = classifyRepositoryAccess({ ...base, issuesConnector: true, connectorRead: 'ok' });
  assert.equal(connector.issues.read, true);
  for (const reason of ['auth-missing', 'repo-denied', 'network-error']) {
    assert.equal(classifyRepositoryAccess({ ...base, ghRead: reason }).issues.reason, reason);
  }
  assert.equal(classifyRepositoryAccess({ ...base, ghFound: false }).issues.reason, 'tool-absent');
  assert.equal(classifyRepositoryAccess({ ...base, remotes: [] }).issues.reason, 'no-remote');
  assert.equal(classifyRepositoryAccess({ ...base, remotes: ['a/repo', 'b/repo'] }).issues.reason, 'ambiguous-remote');
});

test('E15 current comment, legacy YAML and matching dual declarations resolve', () => {
  const current = '<!-- produktiv: {"version":1,"feature":"label"} -->\n# Label\n';
  const legacy = '---\nfeature: label\n---\n# Label\n';
  const both = '<!-- produktiv: {"version":1,"feature":"label"} -->\n---\nfeature: label\n---\n# Label\n';
  assert.deepEqual(parseArtifactIdentity(current, 'issue'), { identity: { feature: 'label' }, encoding: 'comment' });
  assert.deepEqual(parseArtifactIdentity(legacy, 'issue'), { identity: { feature: 'label' }, encoding: 'yaml' });
  assert.deepEqual(parseArtifactIdentity(both, 'issue'), { identity: { feature: 'label' }, encoding: 'both' });
});

test('E15 invalid, conflicting, duplicate and wrong-kind declarations fail without fallback', () => {
  assert.throws(() => parseArtifactIdentity('<!-- produktiv: nope -->\n# Label\n', 'issue'), /invalid-produktiv-json/);
  assert.throws(() => parseArtifactIdentity('<!-- produktiv: {"version":1,"feature":"a"} -->\n---\nfeature: b\n---\n', 'issue'), /identity-conflict:feature/);
  assert.throws(() => parseArtifactIdentity('<!-- produktiv: {"version":1,"feature":"a"} -->\n<!-- produktiv: {"version":1,"feature":"a"} -->\n', 'issue'), /duplicate-produktiv-comment/);
  assert.throws(() => parseArtifactIdentity('# Title\n<!-- produktiv: {"version":1,"feature":"a"} -->\n', 'issue'), /produktiv-comment-not-first/);
  assert.throws(() => parseArtifactIdentity('<!-- produktiv: {"version":1,"feature":"a","slice":"s","plan":"p"} -->\n', 'issue'), /disallowed-key:slice/);
  assert.deepEqual(parseArtifactIdentity('# No declaration\n', 'plan'), { identity: null, encoding: 'none' });
});

test('E15 ticket identity is distinct and duplicate store candidates are explicit', () => {
  const issue = { path: 'issue.md', markdown: '<!-- produktiv: {"version":1,"feature":"label"} -->\n# Label\n' };
  const ticketText = '<!-- produktiv: {"version":1,"feature":"label","slice":"write","plan":"docs/plans/label.md"} -->\n# Write\n';
  assert.equal(resolveUnique([issue], 'issue', { feature: 'label' }).path, 'issue.md');
  assert.deepEqual(parseArtifactIdentity(ticketText, 'ticket').identity, { feature: 'label', slice: 'write', plan: 'docs/plans/label.md' });
  assert.throws(() => resolveUnique([{ path: 'a.md', markdown: ticketText }, { path: 'b.md', markdown: ticketText }], 'ticket', { feature: 'label', slice: 'write' }), /duplicate-artifact-identity/);
});

test('templates write hidden v1 comments while legacy fixtures remain readable', () => {
  for (const name of ['issue', 'spec', 'plan', 'ticket']) {
    const template = read(`workflow/templates/${name}.md`);
    assert.match(template, /^<!-- produktiv: /);
    assert.doesNotMatch(template, /^---\n/);
  }
  const oldIssue = read('workflow/evals/artifact-format/fixtures/docs/issues/saved-label.md');
  const newIssue = read('workflow/evals/artifact-format/fixtures/docs/issues/saved-label-v1.md');
  assert.equal(parseArtifactIdentity(oldIssue, 'issue').encoding, 'yaml');
  assert.equal(parseArtifactIdentity(newIssue, 'issue').encoding, 'comment');
  assert.match(read('workflow/evals/artifact-format/contract.md'), /not a fixed heading order/);
});

test('behavioral acceptance remains evidence-gated rather than self-declaring behavioral PASS', () => {
  const readme = read('workflow/evals/greenfield-repair/README.md');
  assert.match(readme, /does not claim that an agent followed/);
  assert.match(readme, /does not close behavioral acceptance/);
});
