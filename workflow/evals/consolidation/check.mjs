import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArtifactIdentity } from '../greenfield-repair/lib/artifact-identity.mjs';
import { listSkillDirs } from '../../scripts/bootstrap.mjs';

const workflow = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = p => readFileSync(path.join(workflow, p), 'utf8');

test('skill frontmatter stays compatible without installing another validator dependency', () => {
  const require = createRequire(path.join(workflow, 'vendor/understand-anything/package.json'));
  const YAML = require('yaml');
  const allowed = new Set(['name', 'description', 'license', 'allowed-tools', 'metadata']);
  for (const skill of listSkillDirs(path.join(workflow, 'skills'))) {
    const text = readFileSync(path.join(skill.dir, 'SKILL.md'), 'utf8');
    const match = /^---\n([\s\S]*?)\n---/.exec(text);
    assert.ok(match, skill.name);
    const data = YAML.parse(match[1]);
    assert.equal(data.name, skill.name);
    assert.match(data.name, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(data.name.length <= 64);
    assert.equal(typeof data.description, 'string');
    assert.ok(data.description.length > 0 && data.description.length <= 1024);
    assert.doesNotMatch(data.description, /[<>]|\[TODO:/);
    for (const key of Object.keys(data)) assert.ok(allowed.has(key), skill.name + ': ' + key);
    assert.doesNotMatch(text.slice(match[0].length), /^\s*\[TODO:[^\n]*\]\s*$/m);
  }
});

// Structural contracts only: these checks cannot establish agent behavior.
test('changed entrypoints reference existing distributed resources', () => {
  const names = ['discover', 'to-spec', 'to-plan', 'implement', 'prototype', 'design', 'review-plan', 'decompose'];
  let checked = 0;
  for (const name of names) {
    const text = read('skills/pk-' + name + '/SKILL.md');
    for (const [, resource] of text.matchAll(/`((?:policies|references|agents|templates)\/[a-zA-Z0-9/.-]+\.md)`/g)) {
      assert.ok(existsSync(path.join(workflow, resource)), name + ': ' + resource);
      checked++;
    }
  }
  assert.ok(checked > 20);
  for (const resource of ['policies/decisions.md', 'references/execution.md', 'references/design-practice.md']) {
    assert.ok(read('references/context-pack.md').includes(resource), resource);
  }
  // Routing lives in each skill's Context section: the route must sit in that skill's line.
  const contextLine = (name, label) => {
    const section = read('skills/pk-' + name + '/SKILL.md').split(/^## Context\r?$/m)[1]?.split(/^## /m)[0] ?? '';
    const lines = section.split('\n').filter(line => line.startsWith('- ' + label + ': '));
    assert.equal(lines.length, 1, name + ': one ' + label + ' line');
    return lines[0];
  };
  const routes = [
    ['discover', 'Must load', '`policies/decisions.md`'],
    ['to-spec', 'Must load', '`policies/decisions.md`'],
    ['to-plan', 'May load conditionally', 'decisions for material gap/capture'],
    ['implement', 'May load conditionally', 'decisions for material gap'],
    ['implement', 'May load conditionally', 'execution for multi-result/dependencies/resume/findings'],
    ['design', 'May load conditionally', 'design-practice for new direction/hierarchy'],
    ['prototype', 'May load conditionally', 'design-practice for missing direction/hierarchy'],
  ];
  for (const [name, label, route] of routes) assert.ok(contextLine(name, label).includes(route), name + ' ' + label + ': ' + route);
  assert.ok(read('skills/pk-implement/SKILL.md').includes('references/execution.md'));
  for (const name of ['design', 'prototype']) assert.ok(read('skills/pk-' + name + '/SKILL.md').includes('references/design-practice.md'));
});

test('human dates and links do not alter example identity; legacy remains readable', () => {
  const base = 'evals/artifact-format/fixtures/docs/';
  assert.equal(parseArtifactIdentity(read(base + 'plans/rename-action.md'), 'plan').identity.feature, 'rename-action');
  const spec = parseArtifactIdentity(read(base + 'specs/workspace-copy.md'), 'spec').identity;
  const issue = parseArtifactIdentity(read(base + 'issues/workspace-copy.md'), 'issue').identity;
  assert.equal(spec.feature, issue.feature);
  assert.ok(existsSync(path.resolve(workflow, base, 'specs', spec.issue)));
  assert.equal(parseArtifactIdentity(read(base + 'issues/saved-label.md'), 'issue').encoding, 'yaml');
});

test('documented gh read uses the real CLI positional repository syntax without network', t => {
  const document = read('references/capabilities.md');
  const command = 'gh repo view OWNER/REPO --json nameWithOwner,url';
  assert.ok(document.includes(command));
  const version = spawnSync('gh', ['--version'], { encoding: 'utf8' });
  if (version.error?.code === 'ENOENT') return t.skip('gh unavailable; only source syntax checked');
  assert.equal(version.status, 0, version.stderr);
  const args = command.split(' ').slice(1);
  const result = spawnSync('gh', [...args, '--help'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /gh repo view/);
});
