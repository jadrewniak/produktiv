import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import { buildNpmPackage } from '../../../scripts/npm-package.mjs';
import { buildRelease } from '../../../scripts/release.mjs';

const workflow = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function mockSkillsCli(root) {
  const bin = path.join(root, 'bin');
  mkdirSync(bin, { recursive: true });
  const script = `#!${process.execPath}\n${String.raw`
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
const command = args[4];
const agentAt = args.indexOf('-a');
const agent = agentAt === -1 ? null : args[agentAt + 1];
const base = args.includes('-g') ? process.env.HOME : process.cwd();
const roots = { cursor: ['.agents', 'skills'], codex: ['.agents', 'skills'], 'claude-code': ['.claude', 'skills'] };
if (command === '--version') { console.log('9.9.9-fixture'); process.exit(0); }
if (!roots[agent]) process.exit(7);
const dest = path.join(base, ...roots[agent]);
if (command === 'add') {
  const source = args[5];
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(source)) {
    const skill = path.join(source, name);
    if (!fs.existsSync(path.join(skill, 'SKILL.md'))) continue;
    fs.rmSync(path.join(dest, name), { recursive: true, force: true });
    fs.cpSync(skill, path.join(dest, name), { recursive: true });
  }
} else if (command === 'list') {
  const rows = fs.existsSync(dest) ? fs.readdirSync(dest)
    .filter(name => fs.existsSync(path.join(dest, name, 'SKILL.md')))
    .map(name => ({ name, path: path.join(dest, name), agents: [agent] })) : [];
  console.log(JSON.stringify(rows));
} else process.exit(8);
`}`;
  const file = path.join(bin, 'npx');
  writeFileSync(file, script);
  chmodSync(file, 0o755);
  return bin;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    timeout: 300000,
    windowsHide: true,
    ...options,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, `${command} ${args.join(' ')}\n${result.stderr || result.stdout}`);
  return result.stdout;
}

test('npm tarball installs the exact immutable release through one CLI command', { timeout: 300000 }, async () => {
  const root = mkdtempSync(path.join(tmpdir(), 'produktiv-m6-npm-'));
  try {
    const packageDir = path.join(root, 'package');
    const packDir = path.join(root, 'packed');
    const project = path.join(root, 'project');
    const home = path.join(root, 'home');
    const cache = path.join(root, 'npm-cache');
    mkdirSync(packDir);
    mkdirSync(project);
    mkdirSync(home);
    mkdirSync(cache);
    const skillsBin = mockSkillsCli(root);
    const env = {
      ...process.env,
      HOME: home,
      PATH: `${skillsBin}${path.delimiter}${process.env.PATH}`,
      npm_config_cache: cache,
      npm_config_offline: 'true',
    };

    const built = await buildNpmPackage({ source: workflow, output: packageDir });
    assert.equal(built.manifest.name, 'produktiv');
    assert.equal(built.manifest.license, 'MIT');
    assert.equal(readFileSync(path.join(packageDir, 'LICENSE'), 'utf8'), readFileSync(path.join(workflow, 'LICENSE'), 'utf8'));
    assert.equal(readFileSync(path.join(workflow, 'LICENSE'), 'utf8'), readFileSync(path.join(workflow, '..', 'LICENSE'), 'utf8'));
    assert.equal(built.manifest.bin.produktiv, 'bin/produktiv.mjs');
    assert.equal(built.transport.releaseDigest, built.release.digest);
    assert.match(built.release.digest, /^[0-9a-f]{64}$/);
    // The digest is content-addressed: a rebuild of the same source must reproduce it.
    const rebuilt = await buildRelease({ source: workflow, output: path.join(root, 'rebuilt-release') });
    assert.equal(rebuilt.digest, built.release.digest);

    const packed = JSON.parse(run(
      'npm',
      ['pack', packageDir, '--pack-destination', packDir, '--json'],
      { env },
    ));
    assert.equal(packed.length, 1);
    assert.equal(packed[0].name, 'produktiv');
    assert.ok(packed[0].files.some((file) => file.path === 'LICENSE'));
    const tarball = path.join(packDir, packed[0].filename);
    assert.equal(existsSync(tarball), true);

    run('npm', [
      'exec', '--yes', '--offline', '--package', tarball, '--',
      'produktiv', 'install', '--host', 'codex', '--scope', 'project',
      '--project', project, '--home', home,
    ], { cwd: project, env });

    const pin = JSON.parse(readFileSync(path.join(project, 'produktiv-lock.json'), 'utf8'));
    assert.equal(pin.version, built.release.version);
    assert.equal(pin.digest, built.release.digest);
    const link = path.join(project, '.agents', 'skills', 'pk-setup', 'produktiv');
    assert.equal(existsSync(link), true);
    assert.equal(readdirSync(path.join(project, '.agents', 'skills')).length, 17);
    assert.match(realpathSync(link), new RegExp(`${built.release.digest}$`));
    assert.equal(existsSync(path.join(realpathSync(link), 'README.md')), true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
