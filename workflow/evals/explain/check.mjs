import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { buildRelease } from '../../scripts/release.mjs';

const workflow = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = p => readFileSync(path.join(workflow, p), 'utf8');
let releaseRoot;
let adapter;
before(async () => {
  releaseRoot = mkdtempSync(path.join(tmpdir(), 'produktiv-explain-release-'));
  const output = path.join(releaseRoot, 'package');
  // The release builder emits current TypeScript into an isolated package.
  // Never depend on ignored JS left behind by another suite in the checkout.
  await buildRelease({ source: workflow, output });
  adapter = await import(pathToFileURL(path.join(output, 'adapters/graph/index.js')).href);
});
after(() => {
  if (releaseRoot) rmSync(releaseRoot, { recursive: true, force: true });
});
function snapshot(root, prefix = '') {
  return readdirSync(path.join(root, prefix), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
    if (!prefix && entry.name === '.git') return [];
    const rel = path.join(prefix, entry.name);
    return entry.isDirectory() ? [[rel + '/', 'directory'], ...snapshot(root, rel)]
      : [[rel, createHash('sha256').update(readFileSync(path.join(root, rel))).digest('hex')]];
  });
}

test('explain references resolve through current shared owners', () => {
  const text = read('skills/pk-explain/SKILL.md');
  for (const [, resource] of text.matchAll(/`((?:policies|references)\/[a-zA-Z0-9/.-]+\.md)`/g)) {
    assert.ok(existsSync(path.join(workflow, resource)), resource);
  }
});

for (const withGit of [false, true]) test(`missing graph does not initialize or mutate a ${withGit ? 'dirty Git' : 'non-Git'} project`, async () => {
  // Infrastructure proof, not model behavior. Adapter comes from this run's release.
  const root = mkdtempSync(path.join(tmpdir(), 'produktiv-explain-'));
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } });
  try {
    cpSync(path.join(workflow, 'evals/fixtures/existing-small'), root, { recursive: true });
    writeFileSync(path.join(root, '.gitignore'), read('templates/gitignore-workflow.txt'));
    mkdirSync(path.join(root, '.workflow/local'), { recursive: true });
    writeFileSync(path.join(root, '.workflow/local/preferences.yaml'), 'technical_depth: engineer\ndetail: concise\ngraph_opt_out: false\n');
    if (withGit) {
      git('init', '--quiet'); git('add', '.');
      git('-c', 'user.name=Eval', '-c', 'user.email=eval@localhost', 'commit', '--quiet', '-m', 'baseline');
      writeFileSync(path.join(root, 'staged.txt'), 'preserve staged bytes\n'); git('add', 'staged.txt');
      writeFileSync(path.join(root, 'src/greet.ts'), 'export function greet(name: string): string { return `Hi, ${name}`; }\n');
      writeFileSync(path.join(root, 'untracked.txt'), 'preserve untracked bytes\n');
    }
    const before = snapshot(root);
    const gitBefore = withGit ? [git('rev-parse', 'HEAD'), git('status', '--porcelain', '--untracked-files=all'), git('ls-files', '--stage')] : null;
    for (const result of [await adapter.ensure_fresh(root, undefined, '/explain'), await adapter.related(root, 'greet'), await adapter.architecture_overview(root)]) {
      assert.equal(result.status, 'UNAVAILABLE');
      assert.equal(result.reason, 'missing-graph');
    }
    assert.deepEqual(snapshot(root), before, 'includes ignored files, directories and Markdown');
    if (withGit) assert.deepEqual([git('rev-parse', 'HEAD'), git('status', '--porcelain', '--untracked-files=all'), git('ls-files', '--stage')], gitBefore);
    else assert.equal(existsSync(path.join(root, '.git')), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
