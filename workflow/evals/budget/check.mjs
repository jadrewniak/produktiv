/**
 * Instruction budget: the shipped instructions may not grow without a recorded
 * decision. Each command has a declared mandatory set and a word ceiling; the
 * corpus, active rubrics, templates and skill descriptions have their own.
 *
 * A ceiling is a ratchet. Going over it fails, and so does leaving more slack
 * than the tolerance, so a cut also lowers the recorded limit.
 * PRODUKTIV_RECORD_RESULTS=1 rewrites every limit to the measured value.
 *
 * Words are counted, not model tokens, and the mandatory set is a declared
 * floor, not the reads of a real run. See budget.json for the method.
 */

import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { check as checkMove } from './moved.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const workflowDir = path.resolve(here, '../..');
const budgetPath = path.join(here, 'budget.json');

const read = (relative) => readFileSync(path.join(workflowDir, relative), 'utf8');
const words = (text) => (text.match(/\S+/g) ?? []).length;
const RESOURCE = /`((?:policies|references|agents|templates)\/[a-zA-Z0-9/.-]+\.(?:md|yaml|txt))`/g;
const RUBRIC = /agents\/[a-z-]+(?:\/[a-z-]+)?\/v\d+\.md/g;
const PROHIBITION = /\b(?:never|do not|don't|must not|forbid\w*)\b/gi;

// Documents only: OS metadata, placeholders and helper scripts are not instructions.
function documents(directory, extensions) {
  const absolute = path.join(workflowDir, directory);
  if (!existsSync(absolute)) return [];
  return readdirSync(absolute, { withFileTypes: true })
    .filter((entry) => entry.isFile() && !entry.name.startsWith('.') && extensions.some((ext) => entry.name.endsWith(ext)))
    .map((entry) => `${directory}/${entry.name}`)
    .sort();
}

function skillNames() {
  return readdirSync(path.join(workflowDir, 'skills'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(path.join(workflowDir, 'skills', entry.name, 'SKILL.md')))
    .map((entry) => entry.name)
    .sort();
}

const skillPath = (command) => `skills/pk-${command.split(':')[0]}/SKILL.md`;

function skillSection(text, heading) {
  const lines = text.split('\n').map((line) => line.replace(/\r$/, ''));
  const start = lines.findIndex((line) => line === `## ${heading}`);
  assert.ok(start >= 0, `missing section: ## ${heading}`);
  const next = lines.findIndex((line, i) => i > start && /^## /.test(line));
  return lines.slice(start, next < 0 ? undefined : next).join('\n');
}

const resources = (text) => [...text.matchAll(RESOURCE)].map((match) => match[1]);

function instructionCorpus() {
  return [...skillNames().map((name) => `skills/${name}/SKILL.md`), ...documents('policies', ['.md']), ...documents('references', ['.md'])];
}

function activeRubrics() {
  const sources = [...instructionCorpus(), ...documents('templates', ['.md', '.yaml', '.txt'])];
  return [...new Set(sources.flatMap((file) => read(file).match(RUBRIC) ?? []))].sort();
}

const totalPaths = {
  instructions: instructionCorpus,
  rubrics: activeRubrics,
  templates: () => documents('templates', ['.md', '.yaml', '.txt']),
};

function description(file) {
  const match = /^---\n[\s\S]*?^description: (.*)$[\s\S]*?^---$/m.exec(read(file));
  assert.ok(match, `${file}: no description in frontmatter`);
  return match[1];
}

/** The "Must load" line of the skill's ## Context section, or null without one. */
function mustLoad(skill) {
  if (!/^## Context\r?$/m.test(skill)) return null;
  const line = skillSection(skill, 'Context').split('\n').find((text) => text.startsWith('- Must load: '));
  assert.ok(line, 'Context section without a Must load line');
  return line;
}

/**
 * The declared floor for a command: references in the skill's opening, in the
 * "Must load" line of its Context section and in any extra skill sections.
 * A variant such as implement:fast skips the Context section.
 */
function requiredResources(command, entry) {
  const skill = read(skillPath(command));
  const required = new Set(resources(skill.split(/^## /m)[0]));
  if (!command.includes(':')) for (const resource of resources(mustLoad(skill) ?? '')) required.add(resource);
  for (const heading of entry.sections ?? []) for (const resource of resources(skillSection(skill, heading))) required.add(resource);
  return [...required].sort();
}

export function measure(budget) {
  const measured = { totals: {}, commands: {} };
  for (const [name, list] of Object.entries(totalPaths)) {
    const files = list();
    measured.totals[name] = { files, words: files.reduce((sum, file) => sum + words(read(file)), 0) };
  }
  const skills = skillNames().map((name) => `skills/${name}/SKILL.md`);
  measured.totals.descriptions = { files: skills, words: skills.reduce((sum, file) => sum + words(description(file)), 0) };
  for (const [command, entry] of Object.entries(budget.commands)) {
    const files = [skillPath(command), ...entry.files];
    const present = files.filter((file) => existsSync(path.join(workflowDir, file)));
    const text = present.map(read).join('\n');
    measured.commands[command] = {
      files,
      words: present.reduce((sum, file) => sum + words(read(file)), 0),
      estimatedTokens: Math.round(Buffer.byteLength(text) / 4),
      required: existsSync(path.join(workflowDir, skillPath(command))) ? requiredResources(command, entry) : [],
    };
  }
  const corpus = measured.totals.instructions.files.map(read).join('\n');
  measured.prohibitions = (corpus.match(PROHIBITION) ?? []).length;
  measured.skillReferences = skills.reduce((sum, file) => sum + resources(read(file)).length, 0);
  return measured;
}

/** Every reason the budget does not hold, as one message each. */
export function problems(budget, measured) {
  const found = [];
  const skills = skillNames().map((name) => name.replace(/^pk-/, ''));
  const declared = Object.keys(budget.commands);
  for (const skill of skills) if (!declared.includes(skill)) found.push(`${skill}: skill has no budget entry`);
  for (const command of declared) {
    if (!skills.includes(command.split(':')[0])) found.push(`${command}: budget entry has no skill`);
  }
  const check = (label, actual, limit, tolerance) => {
    if (typeof limit !== 'number') return found.push(`${label}: no numeric limit`);
    if (actual > limit) found.push(`${label}: ${actual} words, ${actual - limit} over the limit of ${limit}; shorten the text or raise the limit with a reason`);
    else if (limit - actual > tolerance) found.push(`${label}: ${actual} words, ${limit - actual} under the limit of ${limit}; lower the limit to ${actual}`);
  };
  for (const [name, total] of Object.entries(budget.totals)) {
    if (!measured.totals[name]) {
      found.push(`${name}: unknown total`);
      continue;
    }
    check(`total ${name}`, measured.totals[name].words, total.limit, budget.tolerance.total);
  }
  for (const name of Object.keys(measured.totals)) if (!budget.totals[name]) found.push(`${name}: total has no budget entry`);
  for (const [command, entry] of Object.entries(budget.commands)) {
    const result = measured.commands[command];
    if (!result) continue;
    if (new Set(result.files).size !== result.files.length) found.push(`${command}: duplicate file in the mandatory set`);
    for (const file of result.files) if (!existsSync(path.join(workflowDir, file))) found.push(`${command}: missing file ${file}`);
    const conditional = entry.conditional ?? {};
    for (const [file, reason] of Object.entries(conditional)) {
      if (typeof reason !== 'string' || reason.length < 10) found.push(`${command}: conditional ${file} needs a reason`);
      if (entry.files.includes(file)) found.push(`${command}: ${file} is both mandatory and conditional`);
    }
    for (const file of result.required) {
      if (!result.files.includes(file) && !(file in conditional)) found.push(`${command}: ${file} is required by the skill but not in its budget`);
    }
    check(`command ${command}`, result.words, entry.limit, budget.tolerance.command);
  }
  return found;
}

function record(budget, measured) {
  for (const [name, total] of Object.entries(budget.totals)) if (measured.totals[name]) total.limit = measured.totals[name].words;
  for (const [command, entry] of Object.entries(budget.commands)) if (measured.commands[command]) entry.limit = measured.commands[command].words;
  writeFileSync(budgetPath, JSON.stringify(budget, null, 2) + '\n');
}

const budget = JSON.parse(readFileSync(budgetPath, 'utf8'));
const measured = measure(budget);
if (process.env.PRODUKTIV_RECORD_RESULTS === '1') record(budget, measured);
const clone = () => JSON.parse(JSON.stringify(budget));

test('the shipped instructions stay within the recorded budget', (t) => {
  const table = Object.entries(measured.commands).map(([command, result]) => ({
    command,
    words: result.words,
    limit: budget.commands[command].limit,
    estimatedTokens: result.estimatedTokens,
    files: result.files.length,
  }));
  t.diagnostic(JSON.stringify({
    meaning: 'words of a declared mandatory floor; estimatedTokens is bytes/4, not a tokenizer',
    totals: Object.fromEntries(Object.entries(measured.totals).map(([name, total]) => [name, { words: total.words, limit: budget.totals[name]?.limit, files: total.files.length }])),
    prohibitions: measured.prohibitions,
    skillReferences: measured.skillReferences,
    commands: table,
  }));
  assert.deepEqual(problems(budget, measured), []);
});

test('the budget method and tolerance are recorded', () => {
  assert.equal(budget.unit, 'words');
  assert.ok(budget.method.length > 40);
  assert.ok(Number.isInteger(budget.tolerance.command) && budget.tolerance.command > 0);
  assert.ok(Number.isInteger(budget.tolerance.total) && budget.tolerance.total > 0);
  assert.deepEqual(Object.keys(budget.totals).sort(), ['descriptions', 'instructions', 'rubrics', 'templates']);
});

test('only documents count: OS metadata and placeholders are skipped', () => {
  for (const file of [...measured.totals.instructions.files, ...measured.totals.templates.files]) {
    assert.ok(!path.basename(file).startsWith('.'), file);
  }
  assert.ok(measured.totals.instructions.files.every((file) => file.endsWith('.md')));
});

test('growth over a ceiling fails', () => {
  // Limits come from the measured counts, so a recorded limit with slack inside
  // the tolerance cannot make the control pass or fail by accident.
  const tight = clone();
  tight.commands.debug.limit = measured.commands.debug.words - 1;
  tight.totals.instructions.limit = measured.totals.instructions.words - 1;
  const found = problems(tight, measured);
  assert.ok(found.some((line) => /^command debug: .* 1 over the limit/.test(line)), found.join('\n'));
  assert.ok(found.some((line) => /^total instructions: .* 1 over the limit/.test(line)), found.join('\n'));
});

test('slack beyond the tolerance fails, so a cut lowers the limit', () => {
  const loose = clone();
  loose.commands.explain.limit = measured.commands.explain.words + loose.tolerance.command + 1;
  loose.totals.rubrics.limit = measured.totals.rubrics.words + loose.tolerance.total + 1;
  const found = problems(loose, measured);
  assert.ok(found.some((line) => /^command explain: .* lower the limit/.test(line)), found.join('\n'));
  assert.ok(found.some((line) => /^total rubrics: .* lower the limit/.test(line)), found.join('\n'));
  const within = clone();
  within.commands.explain.limit = measured.commands.explain.words + within.tolerance.command;
  assert.deepEqual(problems(within, measured), []);
});

test('every skill needs an entry and every entry needs a skill', () => {
  const missing = clone();
  delete missing.commands.handoff;
  assert.ok(problems(missing, measured).includes('handoff: skill has no budget entry'));
  const stale = clone();
  stale.commands.ship = { files: [], limit: 1 };
  assert.ok(problems(stale, measure(stale)).includes('ship: budget entry has no skill'));
});

test('a reference the skill requires cannot leave its budget silently', () => {
  const dropped = clone();
  dropped.commands['code-review'].files = dropped.commands['code-review'].files.filter((file) => file !== 'agents/code-review/v4.md');
  assert.ok(problems(dropped, measure(dropped)).some((line) => line === 'code-review: agents/code-review/v4.md is required by the skill but not in its budget'));
  const unverified = clone();
  unverified.commands.debug.files = unverified.commands.debug.files.filter((file) => file !== 'policies/verification.md');
  assert.ok(problems(unverified, measure(unverified)).includes('debug: policies/verification.md is required by the skill but not in its budget'));
  const unexplained = clone();
  unexplained.commands.design.conditional['references/artifact-resolution.md'] = '';
  assert.ok(problems(unexplained, measured).some((line) => /design: conditional .* needs a reason/.test(line)));
  const missingFile = clone();
  missingFile.commands.explain.files.push('references/missing.md');
  assert.ok(problems(missingFile, measure(missingFile)).includes('explain: missing file references/missing.md'));
});

test('every skill declares its Must load line in a Context section', () => {
  for (const name of skillNames()) assert.ok(mustLoad(read(`skills/${name}/SKILL.md`)), `${name}: no Context section`);
});

test('the fast path stays a separate, smaller budget than the full implement path', () => {
  assert.ok(measured.commands['implement:fast'].words < measured.commands.implement.words);
  assert.ok(!budget.commands['implement:fast'].files.includes('references/artifact-resolution.md'));
  assert.ok(!budget.commands['implement:fast'].files.includes('references/context-pack.md'));
});

test('moved.mjs: a faithful move passes and each kind of loss fails', () => {
  const table = '| Command | Load | Skip |\n|---|---|---|\n| a | Read A first | Skip B |\n| b | Read C first | Skip D |\n';
  const old = { 'src.md': `# Pack\n\nKeep this rule. Move this rule.\n\n${table}`, 'a.md': '# A\n\nOther rule.\n', 'b.md': '# B\n' };
  const spec = { base: 'x', from: ['src.md'], to: ['src.md', 'a.md', 'b.md'], rows: { target: '{key}.md', lines: ['- Load: ', '- Skip: '] } };
  const moved = { 'src.md': '# Pack\n\nKeep this rule.\n', 'a.md': '# A\n\nOther rule. Move this rule.\n\n- Load: Read A first\n- Skip: Skip B\n', 'b.md': '# B\n\n- Load: Read C first\n- Skip: Skip D\n' };
  const run = (edit = (_, text) => text, extra = {}) => checkMove({ ...spec, ...extra }, (file) => old[file] ?? '', (file) => edit(file, moved[file])).problems;
  assert.deepEqual(run(), []);
  assert.deepEqual(run((file, text) => (file === 'a.md' ? text.replace(' Move this rule.', '') : text)), ['missing: Move this rule.']);
  assert.deepEqual(run((file, text) => (file === 'a.md' ? text.replace('Move this rule.', 'Never Move this rule.') : text)), ['missing: Move this rule.']);
  assert.deepEqual(run((file, text) => (file === 'b.md' ? text + '\nMove this rule.\n' : text)), ['duplicate: Move this rule.']);
  assert.deepEqual(run((file, text) => (file === 'a.md' ? text.replace('Skip B', 'Skip B, except on Fridays') : text)), ['missing: Skip B']);
  const swap = (file, text) => (file === 'a.md' ? text.replace('Skip B', 'Skip D') : file === 'b.md' ? text.replace('Skip D', 'Skip B') : text);
  assert.deepEqual(run(swap).sort(), ['missing: Skip B', 'missing: Skip D']);
  assert.deepEqual(run(undefined, { missing: { 'Keep this rule.': 'stale reason here' } }), ['stale missing explanation: Keep this rule.']);
  // A sentence removed from the source passes only if its count is unchanged, so an older copy elsewhere does not hide the loss.
  const prior = { ...old, 'a.md': '# A\n\nOther rule. Move this rule.\n' };
  assert.deepEqual(checkMove(spec, (file) => prior[file] ?? '', (file) => moved[file]).problems, ['missing: Move this rule.']);
  assert.ok(checkMove({ ...spec, rows: undefined }, (file) => old[file] ?? '', (file) => moved[file]).problems.some((line) => line.startsWith('table cell needs spec.rows')));
  // A sentence with the right count but in the wrong file is misplaced.
  const place = [{ text: 'Move this rule.', to: 'a.md' }];
  assert.deepEqual(run(undefined, { place }), []);
  const elsewhere = (file, text) => (file === 'a.md' ? text.replace(' Move this rule.', '') : file === 'b.md' ? text + '\nMove this rule.\n' : text);
  assert.deepEqual(run(elsewhere, { place }), ['misplaced: Move this rule. (expected in a.md)']);
  assert.deepEqual(run(undefined, { place: [{ text: 'Not a source rule.', to: 'a.md' }] }), ['place names no source unit: Not a source rule.']);
});
