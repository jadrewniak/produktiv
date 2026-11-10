#!/usr/bin/env node

/** npm bin entrypoint. The immutable Produktiv release is bundled beside it. */
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundledRelease = path.join(packageRoot, 'release');
const bundledBootstrap = path.join(bundledRelease, 'scripts', 'bootstrap.mjs');

if (!existsSync(bundledBootstrap)) {
  console.error('Produktiv npm package is incomplete: release/scripts/bootstrap.mjs is missing.');
  process.exitCode = 1;
} else if (process.argv.slice(2).includes('--source')) {
  console.error('The npm CLI uses its bundled verified release; --source is not accepted.');
  process.exitCode = 2;
} else {
  const stagingRoot = mkdtempSync(path.join(tmpdir(), 'produktiv-npm-release-'));
  const stagedRelease = path.join(stagingRoot, 'release');
  try {
    cpSync(bundledRelease, stagedRelease, { recursive: true, verbatimSymlinks: true });
    restoreReleaseSymlinks(stagedRelease);
    const bootstrap = realpathSync(path.join(stagedRelease, 'scripts', 'bootstrap.mjs'));
    const result = spawnSync(
      process.execPath,
      [bootstrap, ...process.argv.slice(2), '--source', stagedRelease],
      {
        cwd: process.cwd(),
        env: process.env,
        stdio: 'inherit',
        windowsHide: true,
      },
    );
    if (result.error) {
      console.error(result.error.message);
      process.exitCode = 1;
    } else {
      process.exitCode = result.status ?? 1;
    }
  } finally {
    rmSync(stagingRoot, { recursive: true, force: true });
  }
}

function restoreReleaseSymlinks(releaseRoot) {
  const receipt = JSON.parse(readFileSync(path.join(releaseRoot, '.produktiv-release.json'), 'utf8'));
  for (const entry of receipt.inventory ?? []) {
    if (entry.type !== 'symlink') continue;
    if (typeof entry.path !== 'string' || typeof entry.target !== 'string') {
      throw new Error('Produktiv release contains an invalid symlink receipt.');
    }
    const link = path.resolve(releaseRoot, entry.path);
    const parent = path.dirname(link);
    const target = path.resolve(parent, entry.target);
    if (!inside(releaseRoot, link) || !inside(releaseRoot, target)) {
      throw new Error(`Produktiv release symlink escapes its root: ${entry.path}`);
    }
    if (existsSync(link)) continue;
    mkdirSync(parent, { recursive: true });
    symlinkSync(entry.target, link, 'dir');
  }
}

function inside(root, candidate) {
  const rel = path.relative(path.resolve(root), path.resolve(candidate));
  return rel.length > 0 && !rel.startsWith('..') && !path.isAbsolute(rel);
}
