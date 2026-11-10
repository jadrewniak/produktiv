/**
 * Minimal eval harness.
 *
 * One suite name, one exit code. No plugin loader, snapshot service, or network.
 *
 * skill-probe (workflow/evals/fixtures/skill-probe) is an eval fixture.
 * It is not a public command and is excluded from the packaged skill set
 * under workflow/skills. Cursor discovers it in local development through
 * the symlink .cursor/skills/skill-probe, which points at that fixture.
 * That pointer is not a second prompt file and is not a host fork.
 *
 * Usage: node workflow/evals/run.mjs <suite>
 *        node workflow/evals/run.mjs --all
 *
 * --all runs every runnable suite, each in its own child, and exits non-zero
 * when any of them fails. It is the command CI runs. It also fails when a
 * fixture directory holds scripts but a same-named eval directory shadows it.
 *
 * Resolves workflow/evals/<suite>/, then workflow/evals/fixtures/<suite>/.
 * Runs Node's built-in test runner for *.test.mjs, otherwise check.mjs,
 * otherwise every other *.mjs except init-*.mjs helpers. Those scripts run
 * one after another so they do not share a process. medium.mjs is last so
 * the benchmark does not hide an earlier failure. A directory with SKILL.md
 * and expect.json is the discovery probe and is asserted in this process.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

// v1 public commands: the 17 pk- skills.
const PUBLIC_COMMANDS = new Set([
  'pk-setup',
  'pk-discover',
  'pk-research',
  'pk-prototype',
  'pk-design',
  'pk-diagram',
  'pk-to-spec',
  'pk-to-plan',
  'pk-review-plan',
  'pk-decompose',
  'pk-implement',
  'pk-code-review',
  'pk-simplicity-review',
  'pk-closeout',
  'pk-debug',
  'pk-handoff',
  'pk-explain',
]);

const REPLY_LINE =
  /^When this skill is invoked, reply with exactly this token and nothing else: (\S+)\s*$/m;

const evalsDir = path.dirname(fileURLToPath(import.meta.url));
const workflowDir = path.dirname(evalsDir);

function fail(message, code = 1) {
  console.error(message);
  process.exit(code);
}

function resolveSuite(name) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
    fail(`Invalid suite name: ${name}`, 2);
  }
  const candidates = [path.join(evalsDir, name), path.join(evalsDir, 'fixtures', name)];
  for (const dir of candidates) {
    if (existsSync(dir) && statSync(dir).isDirectory()) return dir;
  }
  fail(`Suite not found: ${name}\nLooked in:\n  ${candidates.join('\n  ')}`);
}

function filesIn(dir) {
  return readdirSync(dir)
    .filter((name) => statSync(path.join(dir, name)).isFile())
    .sort();
}

function runTestFiles(files) {
  // One child. This file does not import node:test, because that runner
  // takes over the process exit code and would hide probe failures.
  const result = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
  if (result.error) fail(result.error.message);
  process.exit(result.status ?? 1);
}

function parseFrontmatter(markdown) {
  if (!markdown.startsWith('---\n')) {
    throw new Error('SKILL.md is missing frontmatter');
  }
  const end = markdown.indexOf('\n---\n', 4);
  if (end === -1) throw new Error('SKILL.md frontmatter is not closed');
  const fields = {};
  for (const line of markdown.slice(4, end).split('\n')) {
    if (line.length === 0) continue;
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!match) throw new Error(`SKILL.md frontmatter line is not a simple field: ${line}`);
    fields[match[1]] = match[2].trim();
  }
  return { fields, body: markdown.slice(end + '\n---\n'.length) };
}

function assertSkillProbe(dir) {
  assert.equal(PUBLIC_COMMANDS.size, 17, 'the public-command denylist must stay the v1 target set of 17');

  const skill = readFileSync(path.join(dir, 'SKILL.md'), 'utf8');
  let expected;
  try {
    expected = JSON.parse(readFileSync(path.join(dir, 'expect.json'), 'utf8'));
  } catch (error) {
    throw new Error(`expect.json is not JSON: ${error.message}`);
  }

  assert.equal(typeof expected.name, 'string', 'expect.json name must be a string');
  assert.equal(typeof expected.token, 'string', 'expect.json token must be a string');
  assert.ok(expected.name.length > 0, 'expect.json name is empty');
  assert.ok(expected.token.length > 0, 'expect.json token is empty');

  const { fields, body } = parseFrontmatter(skill);
  assert.equal(fields.name, expected.name, 'SKILL.md name does not match expect.json');
  assert.ok(
    !PUBLIC_COMMANDS.has(fields.name),
    `${fields.name} is a public command; the probe must not be one of the 17`,
  );
  assert.equal(fields.name, path.basename(dir), 'SKILL.md name does not match the fixture directory');
  assert.ok(fields.description && fields.description.length > 0, 'SKILL.md description is empty');
  assert.ok(
    !existsSync(path.join(workflowDir, 'skills', fields.name, 'SKILL.md')),
    `${fields.name} is excluded from the packaged skill set`,
  );

  const reply = REPLY_LINE.exec(body);
  assert.ok(reply, 'SKILL.md does not instruct a single reply token');
  assert.equal(reply[1], expected.token, 'reply token does not match expect.json');
}

function runnable(dir) {
  const names = filesIn(dir);
  return (
    names.some((name) => name.endsWith('.mjs') && !name.startsWith('init-')) ||
    (names.includes('SKILL.md') && names.includes('expect.json'))
  );
}

function allSuites() {
  const suites = new Set();
  for (const root of [evalsDir, path.join(evalsDir, 'fixtures')]) {
    for (const name of readdirSync(root).sort()) {
      if (name === 'fixtures') continue;
      const dir = path.join(root, name);
      if (!statSync(dir).isDirectory()) continue;
      // A fixture directory shadowed by a same-named eval directory never resolves,
      // so scripts left in it would silently never run.
      if (resolveSuite(name) !== dir) {
        if (runnable(dir)) fail(`Scripts in ${dir} never run: ${name} resolves to ${resolveSuite(name)}`);
        continue;
      }
      if (runnable(dir)) suites.add(name);
    }
  }
  return [...suites];
}

function runAll() {
  const failed = [];
  for (const suite of allSuites()) {
    const started = Date.now();
    const result = spawnSync(process.execPath, [fileURLToPath(import.meta.url), suite], { stdio: 'inherit' });
    const status = result.error ? 1 : result.status ?? 1;
    console.log(`# suite ${suite}: ${status === 0 ? 'ok' : 'FAILED'} (${Date.now() - started} ms)`);
    if (status !== 0) failed.push(suite);
  }
  if (failed.length > 0) fail(`Failed suites: ${failed.join(', ')}`);
  console.log('# all suites ok');
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--all') return runAll();
  if (args.length !== 1) fail('Usage: node workflow/evals/run.mjs <suite> | --all', 2);

  const dir = resolveSuite(args[0]);
  const names = filesIn(dir);
  const tests = names.filter((name) => name.endsWith('.test.mjs'));
  if (tests.length > 0) runTestFiles(tests.map((name) => path.join(dir, name)));
  if (names.includes('check.mjs')) runTestFiles([path.join(dir, 'check.mjs')]);

  const scripts = names.filter((name) => name.endsWith('.mjs') && !name.startsWith('init-'));
  if (scripts.length > 0) {
    scripts.sort((left, right) => {
      if (left === 'medium.mjs') return 1;
      if (right === 'medium.mjs') return -1;
      return left < right ? -1 : left > right ? 1 : 0;
    });
    for (const name of scripts) {
      const result = spawnSync(process.execPath, ['--test', path.join(dir, name)], { stdio: 'inherit' });
      if (result.error) fail(result.error.message);
      if ((result.status ?? 1) !== 0) process.exit(result.status ?? 1);
    }
    process.exit(0);
  }

  if (names.includes('SKILL.md') && names.includes('expect.json')) {
    try {
      assertSkillProbe(dir);
    } catch (error) {
      fail(`${args[0]} failed: ${error.message}`);
    }
    console.log(`ok ${args[0]}`);
    return;
  }

  fail(`Suite ${args[0]} has nothing to run in ${dir}`);
}

main();
