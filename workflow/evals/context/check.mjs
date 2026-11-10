// Eval-only pack accounting. This does not invoke skills or implement a runtime assembler.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArtifactIdentity } from '../greenfield-repair/lib/artifact-identity.mjs';

const workflow = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = relative => readFileSync(path.join(workflow, relative), 'utf8');
const hash = text => createHash('sha256').update(text).digest('hex');
const commands = ['setup', 'discover', 'research', 'prototype', 'design', 'diagram', 'to-spec', 'to-plan', 'review-plan', 'decompose', 'implement', 'code-review', 'simplicity-review', 'closeout', 'debug', 'handoff', 'explain'];
const context = read('references/context-pack.md');
const recipes = JSON.parse(read('evals/context/packs.json'));
const labels = ['Must load', 'May load conditionally', 'Must not load by default'];
// Each skill owns its routing row as a ## Context section with three labeled lines.
function contextRow(command) {
  const lines = read(`skills/pk-${command}/SKILL.md`).split('\n').map(line => line.replace(/\r$/, ''));
  const starts = lines.flatMap((line, i) => line === '## Context' ? [i] : []);
  assert.equal(starts.length, 1, `${command}: one ## Context section`);
  const next = lines.findIndex((line, i) => i > starts[0] && /^## /.test(line));
  const body = lines.slice(starts[0] + 1, next < 0 ? undefined : next);
  return [command, ...labels.map(label => {
    const found = body.filter(line => line.startsWith(`- ${label}: `));
    assert.equal(found.length, 1, `${command}: one "${label}" line`);
    return found[0].slice(label.length + 4).trim();
  })];
}
const rows = commands.map(contextRow);
const rowFor = name => rows.find(row => row[0] === name);
const resourcePattern = /`((?:policies|references|agents|templates)\/[a-zA-Z0-9/.-]+\.(?:md|yaml|txt))`/g;

function section(text, heading) {
  const lines = text.split('\n');
  const starts = lines.flatMap((line, i) => line.match(/^#{2,6} (.+)$/)?.[1] === heading ? [i] : []);
  assert.equal(starts.length, 1, `unique section: ${heading}`);
  const start = starts[0];
  const level = lines[start].match(/^#+/)[0].length;
  const next = lines.findIndex((line, i) => i > start && /^#+ /.test(line) && line.match(/^#+/)[0].length <= level);
  // Include identity/title preamble so narrowing never silently loses identity.
  const firstSection = lines.findIndex(line => /^## /.test(line));
  return lines.slice(0, firstSection).concat(lines.slice(start, next < 0 ? undefined : next)).join('\n');
}
function selected(entry, text) {
  assert.ok(!('row' in entry), 'routing rows live in the active skill, not in context-pack');
  if (entry.section) return section(text, entry.section);
  return text;
}
function collect(entries) {
  const seen = new Set();
  const sources = new Map();
  const trace = [];
  for (const entry of entries) {
    assert.ok(!path.isAbsolute(entry.path) && !entry.path.split('/').includes('..'), 'package-relative path');
    const identity = JSON.stringify([entry.path, entry.section ?? null]);
    assert.ok(!seen.has(identity), 'duplicate source section: ' + identity);
    assert.ok(!trace.some(previous => previous.path === entry.path && (!previous.section || !entry.section)), 'overlapping whole/section reads');
    seen.add(identity);
    if (!sources.has(entry.path)) sources.set(entry.path, read(entry.path));
    const source = sources.get(entry.path);
    const content = selected(entry, source);
    trace.push({ ...entry, sourceSha256: hash(source), selectedSha256: hash(content), selectedBytes: Buffer.byteLength(content), content });
  }
  return {
    text: trace.map(item => item.content).join('\n'),
    selectedBytes: trace.reduce((sum, item) => sum + item.selectedBytes, 0),
    sourceBytesRead: [...sources.values()].reduce((sum, source) => sum + Buffer.byteLength(source), 0),
    uniqueFileReads: sources.size,
    trace: trace.map(({ content, ...item }) => item),
  };
}
const files = directory => readdirSync(path.join(workflow, directory), { withFileTypes: true }).filter(entry => entry.isFile() && /\.(?:md|yaml|txt|mjs|html)$/.test(entry.name)).map(entry => directory + '/' + entry.name);
// A declared full-doc baseline: all current entrypoints, shared resources/templates,
// active agent files referenced by current skills/shared owners, and the same fixture.
// Excludes history, vendor sources, real project secrets and unrelated eval receipts.
const activeResources = [...commands.map(name => `skills/pk-${name}/SKILL.md`), ...files('references'), ...files('policies'), ...files('templates')];
const activeAgents = new Set(activeResources.flatMap(file => [...read(file).matchAll(/agents\/[a-z-]+(?:\/[a-z-]+)?\/v\d+\.md/g)].map(match => match[0])));
const baselinePaths = [...new Set([...activeResources, ...activeAgents, ...files('evals/context/fixture')])].sort();
const baseline = collect(baselinePaths.map(p => ({ path: p })));

function assertConstraints(recipe, pack) {
  for (const constraint of recipe.constraints) assert.ok(pack.text.includes(constraint), `${recipe.command}: missing fixture constraint: ${constraint}`);
}
function assertNarrow(recipe, entries) {
  const paths = entries.map(entry => entry.path);
  assert.ok(paths.every(p => baselinePaths.includes(p)), 'pack cannot hide sources outside declared baseline');
  assert.equal(paths.filter(p => p.startsWith('skills/')).length, 1, 'only active skill for these scenarios');
  assert.ok(paths.includes(`skills/pk-${recipe.command}/SKILL.md`));
  assert.equal(paths.filter(p => p === 'references/context-pack.md').length, 1);
  assert.ok(!entries.find(entry => entry.path === 'references/context-pack.md').section, 'whole shared selection contract');
  assert.ok(!paths.some(p => /graph|draft\.html/.test(p)), 'no selected structural question or draft authority in these scenarios');
  assert.ok(!paths.includes('references/policy-triggers.md') && !paths.includes('policies/cost.md'), 'no optional spend in these scenarios');
  const allowedAgents = { implement: ['agents/completion-review/v5.md'], 'review-plan': ['agents/plan-review/v8.md'], debug: [], explain: [], handoff: [] };
  assert.deepEqual(paths.filter(p => p.startsWith('agents/')).sort(), allowedAgents[recipe.command]);
  if (recipe.command === 'debug') assert.ok(!paths.some(p => /fixture\/(?:plan|handoff)\.md/.test(p)), 'local diagnosis has no Plan or implicit handoff');
  if (recipe.command === 'explain') assert.ok(!paths.some(p => /fixture\/(?:issue|spec|plan|handoff)\.md/.test(p)), 'named source explanation needs no artifact pack');
}

test('exactly 17 skill Context sections match public entrypoints with explicit positive, conditional and negative lines', () => {
  assert.equal(rows.length, 17);
  assert.doesNotMatch(context, /^\|/m, 'context-pack keeps no second copy of the routing rows');
  assert.deepEqual(rows.map(row => row[0]).sort(), [...commands].sort());
  assert.deepEqual(readdirSync(path.join(workflow, 'skills')).filter(name => existsSync(path.join(workflow, 'skills', name, 'SKILL.md'))).sort(), commands.map(name => `pk-${name}`).sort());
  for (const row of rows) {
    assert.equal(row.length, 4, row[0]);
    for (const cell of row.slice(1)) assert.ok(cell.length > 20, row[0]);
    assert.doesNotMatch(row[1], /graph-use|graph query|full graph/i, row[0] + ': graph not mandatory');
  }
});

test('resource links exist and unconditional opening loads are represented in the Context section', () => {
  for (const command of commands) {
    const skill = read(`skills/pk-${command}/SKILL.md`);
    for (const [, resource] of skill.matchAll(resourcePattern)) assert.ok(existsSync(path.join(workflow, resource)), command + ': ' + resource);
    const opening = skill.split(/^## /m)[0];
    for (const [, resource] of opening.matchAll(resourcePattern)) {
      if (['policies/kernel.md', 'references/context-pack.md'].includes(resource)) continue;
      // Design explicitly gates artifact-resolution and visual-handoff even in its opening paragraph.
      const gated = command === 'design' && ['references/artifact-resolution.md', 'references/visual-handoff.md'].includes(resource);
      const columns = gated ? rowFor(command).slice(1, 3).join(' ') : rowFor(command)[1];
      assert.ok(columns.includes(resource), `${command}: opening load absent from Context: ${resource}`);
    }
  }
  for (const [, resource] of context.matchAll(resourcePattern)) assert.ok(existsSync(path.join(workflow, resource)), resource);
});

test('artifact writing and visual handoff are reachable from the core and from every skill that needs them', () => {
  const core = read('references/artifact-resolution.md').split(/^## /m)[0];
  assert.match(core, /Before creating or updating an Issue, Spec, Plan or Ticket, also read `references\/artifact-writing\.md`/);
  assert.match(core, /also read `references\/visual-handoff\.md`/);
  const writers = ['discover', 'design', 'to-spec', 'to-plan', 'decompose', 'implement', 'review-plan', 'code-review', 'simplicity-review', 'closeout', 'debug', 'handoff'];
  const visual = ['prototype', 'design', 'to-plan', 'implement', 'review-plan', 'code-review', 'simplicity-review', 'closeout'];
  for (const command of writers) assert.ok(read(`skills/pk-${command}/SKILL.md`).includes('`references/artifact-writing.md`'), command + ': artifact-writing unreachable');
  for (const command of visual) assert.ok(read(`skills/pk-${command}/SKILL.md`).includes('`references/visual-handoff.md`'), command + ': visual-handoff unreachable');
  for (const command of ['to-spec', 'to-plan', 'decompose']) assert.ok(rowFor(command)[1].includes('references/artifact-writing.md'), command + ': a writer must load artifact-writing');
  for (const command of ['review-plan', 'closeout']) assert.ok(rowFor(command)[1].includes('references/visual-handoff.md'), command + ' must load visual-handoff: a weak model skipped it when conditional');
  // Where it stays conditional, the step that applies the checks names it, not only the May line.
  const body = command => read(`skills/pk-${command}/SKILL.md`).split(/^## /m).filter(part => !part.startsWith('Context\n')).join('## ');
  for (const command of ['to-plan', 'implement']) assert.match(body(command), /Apply the accepted visual handoff checks in `references\/visual-handoff\.md`/, command + ': visual-handoff named only in Context');
  assert.match(body('design'), /Issue\/Spec\/Plan sections under `references\/artifact-writing\.md`/, 'design writeback names artifact-writing at the step')
  const writing = read('references/artifact-writing.md') + read('references/visual-handoff.md');
  assert.doesNotMatch(writing, /^## (?:Identity and store|Missing or stale link|Refresh and authority)$/m, 'identity rules stay only in the core');
});

test('current rubric ownership includes foundation preflight, single completion assessment and researcher note', () => {
  const owners = { 'review-plan': 'agents/plan-review/v8.md', implement: 'agents/completion-review/v5.md', 'code-review': 'agents/code-review/v4.md', 'simplicity-review': 'agents/simplicity-review/v4.md', research: 'agents/researcher/v2.md' };
  for (const [command, rubric] of Object.entries(owners)) {
    assert.ok(read(`skills/pk-${command}/SKILL.md`).includes(rubric));
    assert.ok(rowFor(command)[1].includes(rubric));
  }
  assert.ok(rowFor('implement')[2].includes('plan-review v8'));
  assert.ok(read('skills/pk-implement/SKILL.md').includes('agents/plan-review/v8.md'));
  assert.ok(!read('policies/kernel.md').includes('policy-triggers.md'));
});

test('representative inventory is complete and full-doc baseline is reproducible', t => {
  assert.deepEqual(recipes.map(recipe => recipe.command).sort(), ['debug', 'explain', 'handoff', 'implement', 'review-plan']);
  assert.equal(new Set(baselinePaths).size, baselinePaths.length);
  assert.ok(!baselinePaths.some(relative => relative.split('/').at(-1).startsWith('.')), 'OS metadata and placeholders are not documents');
  t.diagnostic(JSON.stringify({ baselineManifest: baselinePaths.map(relative => ({ path: relative, sha256: hash(read(relative)), bytes: Buffer.byteLength(read(relative)) })) }));
});

for (const recipe of recipes) test(`${recipe.command}: curated fixture pack retains required constraints and reduces full-doc reads`, t => {
  assertNarrow(recipe, recipe.entries);
  const pack = collect(recipe.entries);
  assertConstraints(recipe, baseline);
  assertConstraints(recipe, pack);
  assert.ok(pack.selectedBytes < baseline.selectedBytes);
  assert.ok(pack.sourceBytesRead < baseline.sourceBytesRead);
  assert.ok(pack.uniqueFileReads < baseline.uniqueFileReads);
  t.diagnostic(JSON.stringify({ command: recipe.command, request: recipe.request, meaning: 'deterministic recipe accounting; not agent reads, tokens or behavioral PASS', recipeSha256: hash(JSON.stringify(recipe)), constraints: recipe.constraints.length, curated: { selectedBytes: pack.selectedBytes, sourceBytesRead: pack.sourceBytesRead, uniqueFileReads: pack.uniqueFileReads }, baseline: { selectedBytes: baseline.selectedBytes, sourceBytesRead: baseline.sourceBytesRead, uniqueFileReads: baseline.uniqueFileReads }, trace: pack.trace }));
});

test('oracle rejects lost canonical constraint despite an intact Plan, source and check', () => {
  const recipe = recipes.find(item => item.command === 'implement');
  const withoutSpec = collect(recipe.entries.filter(entry => !entry.path.endsWith('/spec.md')));
  assert.throws(() => assertConstraints(recipe, withoutSpec), /missing fixture constraint/);
});

test('budget guard rejects full-doc expansion, another skill\'s routing, a partial contract, foreign rubric and implicit handoff', () => {
  const debug = recipes.find(item => item.command === 'debug');
  assert.throws(() => assertNarrow(debug, baselinePaths.map(p => ({ path: p }))), /only active skill/);
  assert.throws(() => assertNarrow(debug, [...debug.entries, { path: 'skills/pk-implement/SKILL.md' }]), /only active skill/);
  assert.throws(() => assertNarrow(debug, debug.entries.map(entry => entry.path === 'references/context-pack.md' ? { ...entry, section: 'Shared owners' } : entry)), /whole shared selection contract/);
  assert.throws(() => collect([{ path: 'references/context-pack.md', row: 'debug' }]), /routing rows live in the active skill/);
  assert.throws(() => assertNarrow(debug, [...debug.entries, { path: 'agents/code-review/v4.md' }]));
  assert.throws(() => assertNarrow(debug, [...debug.entries, { path: 'evals/context/fixture/handoff.md' }]), /implicit handoff/);
});

test('collector rejects missing sections, duplicate and overlapping artifact bodies', () => {
  assert.throws(() => collect([{ path: 'evals/context/fixture/spec.md', section: 'Missing' }]), /unique section/);
  assert.throws(() => collect([{ path: 'evals/context/fixture/spec.md' }, { path: 'evals/context/fixture/spec.md' }]), /duplicate/);
  assert.throws(() => collect([{ path: 'evals/context/fixture/spec.md', section: 'Rename contract' }, { path: 'evals/context/fixture/spec.md' }]), /overlapping/);
});

test('fixture command really defines the observed model behavior; stale handoff remains only a claim', () => {
  execFileSync(process.execPath, ['check.mjs'], { cwd: path.join(workflow, 'evals/context/fixture') });
  assert.match(read('evals/context/fixture/handoff.md'), /Unverified earlier hypothesis/);
});

test('fixture artifacts preserve current identity and stable Plan unit format', () => {
  for (const kind of ['issue', 'spec', 'plan']) {
    const parsed = parseArtifactIdentity(read(`evals/context/fixture/${kind}.md`), kind);
    assert.equal(parsed.encoding, 'comment');
    assert.equal(parsed.identity.feature, 'rename-label');
    if (kind !== 'issue') assert.equal(parsed.identity.issue, 'issue.md');
  }
  const plan = read('evals/context/fixture/plan.md');
  assert.match(plan, /^### U1$/m);
  assert.match(plan, /^### U2$/m);
  assert.ok(!existsSync(path.join(workflow, 'evals/context/fixture/missing-old-spec.md')));
  assert.equal(parseArtifactIdentity(section(plan, 'U1'), 'plan').identity.feature, 'rename-label');
  assert.ok(!section(plan, 'U1').includes('### U2'));
});
