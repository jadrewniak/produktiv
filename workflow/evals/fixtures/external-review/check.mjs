/**
 * Checks for the external reviewer adapter (adapters/host/external-review.mjs)
 * with fake `codex` and `claude` binaries that record each call.
 *
 * PATH holds only the fake binaries and this Node, so a reviewer CLI
 * installed on the machine is never reached: every test that expects a call
 * asserts that the fake recorded it. With policy off or the key absent,
 * nothing runs, not even `--version`.
 */

import { execFile } from 'node:child_process';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, beforeEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import {
  CODEX_DISABLED_FEATURES,
  PAYLOAD_DIR,
  RUBRIC,
  composeMessage,
  detect,
  diffFiles,
  findExecutable,
  parseArgs,
  parsePolicy,
  preview,
  reviewerEnv,
  run,
  secretSignals,
} from '../../../adapters/host/external-review.mjs';

const execFileAsync = promisify(execFile);
const here = path.dirname(fileURLToPath(import.meta.url));
const workflow = path.resolve(here, '../../..');
const adapter = path.join(workflow, 'adapters/host/external-review.mjs');

const bin = mkdtempSync(path.join(tmpdir(), 'produktiv-external-bin-'));
process.env.PATH = [bin, path.dirname(process.execPath)].join(path.delimiter);
process.env.GITHUB_TOKEN = 'ghp_should_not_reach_the_reviewer';
process.env.ANTHROPIC_API_KEY = 'test-key-for-the-fake';

// One fake for both tools. Behavior comes from <bin>/<tool>.mode, because the
// adapter passes the reviewer only a reduced environment.
const FAKE = `#!${process.execPath}
const fs = require('fs');
const path = require('path');
const tool = path.basename(process.argv[1]);
const dir = path.dirname(process.argv[1]);
const argv = process.argv.slice(2);
if (argv[0] === '--version') { console.log(tool + ' fake 9.9.9'); process.exit(0); }
const mode = fs.existsSync(path.join(dir, tool + '.mode')) ? fs.readFileSync(path.join(dir, tool + '.mode'), 'utf8').trim() : 'ok';
const stdin = fs.readFileSync(0, 'utf8');
fs.appendFileSync(path.join(dir, tool + '.calls.jsonl'), JSON.stringify({
  argv, cwd: process.cwd(), cwdEntries: fs.readdirSync(process.cwd()), stdin, envKeys: Object.keys(process.env),
}) + '\\n');
if (mode === 'exit3') { console.error('fake failure'); process.exit(3); }
if (mode === 'hang') {
  const child = require('child_process').spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
  fs.writeFileSync(path.join(dir, tool + '.child'), String(child.pid));
  setInterval(() => {}, 1000);
  return;
}
const findings = '## Findings\\n\\n\`IMPORTANT\` coupon applied per line.';
if (tool === 'claude') {
  if (mode === 'garbage') { process.stdout.write('not json'); process.exit(0); }
  const out = { type: 'result', subtype: 'success', is_error: false, result: findings, total_cost_usd: 0.01 };
  if (mode !== 'nomodel') out.modelUsage = { 'claude-fake-1': { inputTokens: 1 } };
  process.stdout.write(JSON.stringify(out));
  process.exit(0);
}
const last = argv[argv.indexOf('--output-last-message') + 1];
const events = [{ type: 'thread.started', thread_id: 't1' }];
if (mode !== 'nomodel') events.push({ type: 'turn.started', model: 'gpt-fake-1' });
if (mode === 'tool') events.push({ type: 'item.completed', item: { type: 'error', message: 'code-mode host is disabled' } }, { type: 'item.completed', item: { type: 'command_execution', command: 'ls ~' } });
events.push({ type: 'item.completed', item: { type: 'agent_message', text: 'done' } });
events.push({ type: 'turn.completed', usage: { input_tokens: 1 } });
process.stdout.write(events.map((e) => JSON.stringify(e)).join('\\n') + '\\n');
fs.writeFileSync(last, mode === 'empty' ? '' : findings);
`;

for (const tool of ['codex', 'claude']) {
  writeFileSync(path.join(bin, tool), FAKE);
  chmodSync(path.join(bin, tool), 0o755);
}

const DIFF = [
  'diff --git a/src/cart.mjs b/src/cart.mjs',
  '--- a/src/cart.mjs',
  '+++ b/src/cart.mjs',
  '@@ -1,3 +1,3 @@',
  '-  return total - coupon;',
  '+  return lines.reduce((sum, line) => sum + line.price - coupon, 0);',
].join('\n');

const roots = [];
function project({ policy = 'ask', config = null, payload = `# Scope\n\nWorking tree.\n\n${DIFF}\n` } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), 'produktiv-external-project-'));
  roots.push(root);
  mkdirSync(path.join(root, '.workflow'), { recursive: true });
  const text = config ?? (policy === null ? 'version: 1\ncost:\n  profile: balanced\n' : `version: 1\nreview:\n  external: ${policy}\n`);
  writeFileSync(path.join(root, '.workflow/config.yaml'), text);
  mkdirSync(path.join(root, PAYLOAD_DIR), { recursive: true });
  const file = path.join(root, PAYLOAD_DIR, 'payload.md');
  writeFileSync(file, payload);
  return { root, file, rel: `${PAYLOAD_DIR}/payload.md` };
}

const calls = (tool) => {
  const file = path.join(bin, `${tool}.calls.jsonl`);
  return existsSync(file) ? readFileSync(file, 'utf8').trim().split('\n').map((line) => JSON.parse(line)) : [];
};
const setMode = (tool, mode) => writeFileSync(path.join(bin, `${tool}.mode`), mode);

beforeEach(() => {
  for (const name of readdirSync(bin)) if (!['codex', 'claude'].includes(name)) rmSync(path.join(bin, name), { force: true });
});
after(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true });
  rmSync(bin, { recursive: true, force: true });
});

async function previewAndRun(tool, opts = {}) {
  const shown = await preview({ ...opts, tool });
  assert.equal(shown.result, 'OK', JSON.stringify(shown));
  return run({ ...opts, tool, expect: shown.sha256 });
}

test('the fakes shadow any reviewer CLI installed on this machine', () => {
  for (const tool of ['codex', 'claude']) assert.equal(findExecutable(tool), path.join(bin, tool));
});

test('policy is off unless review.external is exactly ask', () => {
  const policy = (text) => parsePolicy(text).policy;
  assert.equal(policy('review:\n  external: ask\n'), 'ask');
  assert.equal(policy('review:\n  external: "ask"  # per run consent\n'), 'ask');
  assert.equal(policy('review:\r\n  external: ask\r\n'), 'ask');
  assert.equal(policy('review: {external: ask}\n'), 'ask');
  assert.equal(policy('version: 1\n'), 'off');
  assert.equal(policy('review:\n  external: off\n'), 'off');
  assert.equal(policy('review:\n  external: false\n'), 'off');
  assert.equal(policy('review:\n  external: Ask\n'), 'off');
  assert.equal(policy('review:\n  external: ask\n  external: off\n'), 'off');
  assert.equal(policy('review:\n  external: ask\nreview:\n  external: ask\n'), 'off');
  assert.equal(policy('review: ask\n'), 'off');
  assert.equal(policy('other:\n  external: ask\n'), 'off');
});

test('off, an absent key, an unsupported value or no config runs nothing', async () => {
  const cases = [
    project({ policy: 'off' }),
    project({ policy: null }),
    project({ policy: 'yes' }),
    project({ config: 'review:\n  external: ask\n  external: ask\n' }),
  ];
  const missing = project();
  rmSync(path.join(missing.root, '.workflow/config.yaml'));
  cases.push(missing);
  for (const { root, rel } of cases) {
    for (const tool of ['codex', 'claude']) {
      const shown = await preview({ root, tool, payload: rel });
      assert.equal(shown.result, 'NOT_RUN');
      assert.equal(shown.reason, 'disabled');
      assert.equal(shown.sent, false);
      assert.equal(shown.sha256, undefined, 'nothing is composed when disabled');
      const ran = await run({ root, tool, payload: rel, expect: 'a'.repeat(64) });
      assert.equal(ran.reason, 'disabled');
    }
  }
  assert.deepEqual(calls('codex'), []);
  assert.deepEqual(calls('claude'), []);
  assert.equal(existsSync(path.join(bin, 'codex.calls.jsonl')), false);
});

test('preview shows size, hash, diff files and secret lines without running the tool', async () => {
  const secret = 'AKIAABCDEFGHIJKLMNOP';
  const { root, rel } = project({ payload: `${DIFF}\n+const key = "${secret}";\n` });
  const shown = await preview({ root, tool: 'codex', payload: rel, model: 'gpt-fake-1' });
  assert.equal(shown.result, 'OK');
  assert.equal(shown.sent, false);
  assert.equal(shown.provider, 'openai');
  assert.equal(shown.requestedModel, 'gpt-fake-1');
  assert.equal(shown.version, 'codex fake 9.9.9');
  assert.deepEqual(shown.files, ['src/cart.mjs']);
  assert.match(shown.sha256, /^[0-9a-f]{64}$/);
  assert.ok(shown.bytes > shown.payloadBytes, 'the rubric is part of the message');
  assert.deepEqual(shown.secretSignals.map((s) => s.kind), ['aws-access-key']);
  assert.equal(JSON.stringify(shown).includes(secret), false, 'a secret value is never echoed');
  assert.deepEqual(calls('codex'), []);
  assert.equal(readFileSync(path.join(root, PAYLOAD_DIR, '.gitignore'), 'utf8').includes('*'), true);
});

test('the file list also reads ---/+++ lines when a payload has no diff --git header', () => {
  const plain = '```diff\n--- a/src/cart.mjs\n+++ b/src/cart.mjs\n-old\n+new\n--- a/src/cart.test.mjs\n+++ b/src/cart.test.mjs\n--- /dev/null\n+++ b/src/new.mjs\n```';
  assert.deepEqual(diffFiles(plain), ['src/cart.mjs', 'src/cart.test.mjs', 'src/new.mjs']);
  assert.deepEqual(diffFiles('-- a comment\n+++ not a path'), []);
});

test('the reviewer is told to leave settlement and the Reviewer line to the caller', () => {
  assert.match(composeMessage('x'), /The caller settles each finding and writes the Reviewer line/);
});

test('secret signals cover keys, tokens, .env files and assigned secrets', () => {
  const kinds = (text) => secretSignals(text).map((s) => s.kind);
  assert.deepEqual(kinds('-----BEGIN OPENSSH PRIVATE KEY-----'), ['private-key']);
  assert.deepEqual(kinds(`token ghp_${'a'.repeat(36)}`), ['github-token']);
  assert.deepEqual(kinds('diff --git a/.env b/.env'), ['env-file']);
  assert.deepEqual(kinds('+DB_PASSWORD=hunter2hunter2'), ['assigned-secret']);
  assert.deepEqual(kinds('+const total = price * qty;'), []);
});

test('the message carries the package rubric and presentation, then the payload', () => {
  const message = composeMessage('PAYLOAD-MARKER');
  const rubric = readFileSync(path.join(workflow, RUBRIC), 'utf8');
  const presentation = readFileSync(path.join(workflow, 'references/review-presentation.md'), 'utf8');
  assert.ok(message.includes(rubric.trim()));
  assert.ok(message.includes(presentation.trim()));
  assert.ok(message.indexOf(rubric.trim()) < message.indexOf('PAYLOAD-MARKER'));
  assert.match(message, /untrusted/);
});

test('the adapter sends the rubric /pk-code-review applies', () => {
  const skill = readFileSync(path.join(workflow, 'skills/pk-code-review/SKILL.md'), 'utf8');
  assert.ok(skill.includes(`Apply \`${RUBRIC}\``), `${RUBRIC} is not the rubric the skill names`);
});

test('run refuses a message that differs from the preview', async () => {
  const { root, rel, file } = project();
  const shown = await preview({ root, tool: 'claude', payload: rel });
  writeFileSync(file, `${readFileSync(file, 'utf8')}\nchanged\n`);
  const ran = await run({ root, tool: 'claude', payload: rel, expect: shown.sha256 });
  assert.equal(ran.result, 'NOT_RUN');
  assert.equal(ran.reason, 'payload-changed');
  assert.deepEqual(calls('claude'), []);
  assert.equal(existsSync(file), true, 'the payload stays for a new preview');
});

test('claude runs with no tools, no MCP, no settings, from an empty directory outside the repository', async () => {
  const { root, rel, file } = project();
  const ran = await previewAndRun('claude', { root, payload: rel, model: 'claude-fake-1' });
  assert.equal(ran.result, 'OK', JSON.stringify(ran));
  assert.equal(ran.sent, true);
  assert.equal(ran.reportedModel, 'claude-fake-1');
  assert.equal(ran.costUsd, 0.01);
  assert.match(ran.findings, /coupon applied per line/);
  assert.match(ran.notice, /untrusted/);
  const [call] = calls('claude');
  assert.deepEqual(call.argv, ['-p', '--tools', '', '--strict-mcp-config', '--setting-sources', '', '--disable-slash-commands',
    '--no-session-persistence', '--output-format', 'json', '--model', 'claude-fake-1']);
  assert.deepEqual(call.cwdEntries, []);
  assert.equal(path.relative(root, call.cwd).startsWith('..'), true, 'cwd lies outside the repository');
  assert.equal(existsSync(call.cwd), false, 'the temporary directory is removed');
  assert.ok(call.stdin.includes(readFileSync(path.join(workflow, RUBRIC), 'utf8').trim()));
  assert.ok(call.stdin.includes('diff --git a/src/cart.mjs'));
  assert.equal(call.envKeys.includes('GITHUB_TOKEN'), false);
  assert.equal(call.envKeys.includes('ANTHROPIC_API_KEY'), true);
  assert.equal(existsSync(file), false, 'the payload is removed after the run');
});

test('codex runs read-only with its tool features disabled and user config ignored', async () => {
  const { root, rel } = project();
  const ran = await previewAndRun('codex', { root, payload: rel });
  assert.equal(ran.result, 'OK', JSON.stringify(ran));
  assert.equal(ran.reportedModel, 'gpt-fake-1');
  assert.deepEqual(ran.toolEvents, []);
  const [call] = calls('codex');
  const flag = (name) => call.argv[call.argv.indexOf(name) + 1];
  assert.equal(call.argv[0], 'exec');
  assert.equal(flag('--sandbox'), 'read-only');
  assert.equal(flag('--cd'), call.cwd);
  for (const option of ['--skip-git-repo-check', '--ephemeral', '--ignore-user-config', '--ignore-rules', '--strict-config', '--json']) {
    assert.ok(call.argv.includes(option), option);
  }
  const disabled = call.argv.flatMap((arg, i) => (arg === '--disable' ? [call.argv[i + 1]] : []));
  assert.deepEqual(disabled, CODEX_DISABLED_FEATURES);
  for (const feature of ['shell_tool', 'unified_exec', 'browser_use', 'computer_use', 'apps', 'plugins', 'hooks']) {
    assert.ok(disabled.includes(feature), feature);
  }
  assert.equal(flag('-c'), 'web_search="disabled"');
  assert.equal(call.argv.at(-1), '-', 'the message arrives on stdin');
  assert.equal(call.argv.includes('--model'), false, 'no model is requested unless asked');
  assert.deepEqual(call.cwdEntries, []);
  assert.equal(call.envKeys.includes('GITHUB_TOKEN'), false);
});

test('a reviewer that uses or attempts a tool is reported, not hidden', async () => {
  setMode('codex', 'tool');
  const { root, rel } = project();
  const ran = await previewAndRun('codex', { root, payload: rel });
  assert.equal(ran.result, 'OK');
  assert.deepEqual(ran.toolEvents, ['error', 'command_execution']);
});

test('an unreported model is unknown, not a failure', async () => {
  for (const tool of ['codex', 'claude']) {
    setMode(tool, 'nomodel');
    const { root, rel } = project();
    const ran = await previewAndRun(tool, { root, payload: rel });
    assert.equal(ran.result, 'OK', tool);
    assert.equal(ran.reportedModel, null, tool);
  }
});

test('failures say why and whether data was sent', async () => {
  setMode('claude', 'exit3');
  let { root, rel } = project();
  let ran = await previewAndRun('claude', { root, payload: rel });
  assert.equal(ran.result, 'FAILED');
  assert.equal(ran.reason, 'exit 3');
  assert.equal(ran.sent, true);
  assert.match(ran.stderrTail, /fake failure/);

  setMode('claude', 'garbage');
  ({ root, rel } = project());
  ran = await previewAndRun('claude', { root, payload: rel });
  assert.equal(ran.reason, 'unparseable-output');

  setMode('codex', 'empty');
  ({ root, rel } = project());
  ran = await previewAndRun('codex', { root, payload: rel });
  assert.equal(ran.reason, 'unparseable-output');
});

test('a timeout stops the tool and its children', async () => {
  setMode('codex', 'hang');
  const { root, rel } = project();
  const ran = await previewAndRun('codex', { root, payload: rel, timeoutS: 1 });
  assert.equal(ran.result, 'FAILED');
  assert.equal(ran.reason, 'timeout');
  const pid = Number(readFileSync(path.join(bin, 'codex.child'), 'utf8'));
  let alive = true;
  for (let i = 0; i < 50 && alive; i += 1) {
    try {
      process.kill(pid, 0);
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch {
      alive = false;
    }
  }
  assert.equal(alive, false, 'the child process was stopped');
});

test('an absent tool and an empty or missing payload stop before any call', async () => {
  const saved = process.env.PATH;
  process.env.PATH = path.dirname(process.execPath);
  try {
    const { root, rel } = project();
    const shown = await preview({ root, tool: 'codex', payload: rel });
    assert.equal(shown.reason, 'tool-absent');
    assert.match(shown.detail, /PATH/);
  } finally {
    process.env.PATH = saved;
  }
  const empty = project({ payload: '  \n' });
  assert.equal((await preview({ root: empty.root, tool: 'claude', payload: empty.rel })).reason, 'payload-empty');
  assert.equal((await preview({ root: empty.root, tool: 'claude', payload: 'nope.md' })).reason, 'payload-missing');
  const big = project({ payload: `${DIFF}\n${'x'.repeat(1_100_000)}\n` });
  assert.equal((await preview({ root: big.root, tool: 'claude', payload: big.rel })).reason, 'payload-too-large');
  assert.deepEqual(calls('claude'), []);
});

test('detect reports tools and policy without running a review', async () => {
  const { root } = project({ policy: 'off' });
  const found = await detect({ root });
  assert.equal(found.result, 'OK');
  assert.equal(found.policy.policy, 'off');
  assert.deepEqual(found.tools.map((t) => [t.tool, t.provider, t.version]), [
    ['codex', 'openai', 'codex fake 9.9.9'],
    ['claude', 'anthropic', 'claude fake 9.9.9'],
  ]);
  assert.deepEqual(calls('codex'), []);
});

test('the reviewer environment keeps auth and proxies and drops other tokens', () => {
  const env = reviewerEnv({ PATH: '/bin', HOME: '/h', OPENAI_API_KEY: 'k', ANTHROPIC_BASE_URL: 'u', HTTPS_PROXY: 'p', GITHUB_TOKEN: 'g', AWS_SECRET_ACCESS_KEY: 's', CLAUDECODE: '1' });
  assert.deepEqual(Object.keys(env).sort(), ['ANTHROPIC_BASE_URL', 'HOME', 'HTTPS_PROXY', 'OPENAI_API_KEY', 'PATH']);
});

test('usage errors exit 2; the CLI works through the produktiv link', async () => {
  for (const argv of [[], ['run', '--tool', 'codex', '--payload', 'p'], ['preview', '--tool', 'gemini', '--payload', 'p'],
    ['preview', '--tool', 'codex'], ['run', '--tool', 'codex', '--payload', 'p', '--expect', 'abc'], ['detect', '--tool', 'codex'],
    ['preview', '--tool', 'codex', '--payload', 'p', '--model', 'a b']]) {
    assert.throws(() => parseArgs(argv), undefined, argv.join(' '));
  }
  const { root, rel } = project();
  const links = mkdtempSync(path.join(tmpdir(), 'produktiv-external-link-'));
  roots.push(links);
  symlinkSync(workflow, path.join(links, 'produktiv'), 'dir');
  const linked = path.join(links, 'produktiv/adapters/host/external-review.mjs');
  const cli = (args) => execFileAsync(process.execPath, [linked, ...args], { cwd: root }).then(
    ({ stdout }) => ({ code: 0, out: JSON.parse(stdout) }),
    (error) => ({ code: error.code, out: error.stdout ? JSON.parse(error.stdout) : null }),
  );
  const shown = await cli(['preview', '--tool', 'claude', '--payload', rel]);
  assert.equal(shown.code, 0);
  const ran = await cli(['run', '--tool', 'claude', '--payload', rel, '--expect', shown.out.sha256]);
  assert.equal(ran.code, 0);
  assert.equal(ran.out.result, 'OK');
  assert.equal(calls('claude').length, 1);
  const again = await cli(['run', '--tool', 'claude', '--payload', rel, '--expect', shown.out.sha256]);
  assert.equal(again.code, 1);
  assert.equal(again.out.reason, 'payload-missing');
  const usage = await cli(['nope']);
  assert.equal(usage.code, 2);
  assert.ok(adapter.endsWith('external-review.mjs'));
});
