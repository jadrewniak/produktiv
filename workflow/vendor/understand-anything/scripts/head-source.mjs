/**
 * ADAPT of Understand Anything 6df3065f1d8ddc2ce3615314d1d493f36d6b1c80.
 * Frozen reason: persistent inventory and bytes come from HEAD through the
 * Git helper. Scratch and the published graph live under .workflow/.
 * A missing Git result is a failure, not an empty tree.
 */

import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { listTree, show } from '../../../adapters/host/git.mjs';

export const UPSTREAM_SHA = '6df3065f1d8ddc2ce3615314d1d493f36d6b1c80';

/** v1 extras on top of the vendored ignore defaults. CLI patterns still win. */
export const V1_IGNORE_PATTERNS = Object.freeze([
  '.workflow/',
  '.ua/',
  '.understand-anything/',
  '.env',
  '.env.*',
  '!.env.example',
  '*credentials*',
  '*secret*',
]);

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function graphDir(projectRoot) {
  return join(projectRoot, '.workflow', 'graph');
}

export function scratchDir(projectRoot) {
  return join(projectRoot, '.workflow', 'cache', 'graph');
}

export async function loadCore() {
  return import(pathToFileURL(join(PACKAGE_ROOT, 'dist/index.js')).href);
}

export async function readHeadBlob(projectRoot, relativePath) {
  return show(projectRoot, relativePath);
}

export async function readHeadText(projectRoot, relativePath) {
  return (await show(projectRoot, relativePath)).toString('utf8');
}

/**
 * Committed paths from `git ls-tree -r -z --name-only HEAD`.
 * Symlinks (120000) and gitlinks (160000) are dropped so the scan does not
 * follow them. Git failure throws. There is no directory-walk fallback.
 */
export async function committedInventory(projectRoot) {
  const names = await listTree(projectRoot);
  const modes = committedModeMap(projectRoot);
  const kept = [];
  for (const name of names) {
    const mode = modes.get(name);
    if (mode === '120000' || mode === '160000') continue;
    kept.push(name);
  }
  return kept;
}

export function committedModeMap(projectRoot) {
  let stdout;
  try {
    stdout = execFileSync('git', ['ls-tree', '-r', '-z', 'HEAD'], {
      cwd: projectRoot,
      encoding: 'buffer',
      maxBuffer: 256 * 1024 * 1024,
      timeout: 5000,
      windowsHide: true,
    });
  } catch (error) {
    const stderr = Buffer.isBuffer(error.stderr)
      ? error.stderr.toString('utf8')
      : typeof error.stderr === 'string'
        ? error.stderr
        : '';
    throw new Error(`git ls-tree failed: ${stderr.trim() || error.message}`);
  }

  const modes = new Map();
  const buf = Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout);
  let start = 0;
  for (let i = 0; i < buf.length; i += 1) {
    if (buf[i] !== 0) continue;
    if (i > start) recordMode(modes, buf.toString('utf8', start, i));
    start = i + 1;
  }
  if (start < buf.length) recordMode(modes, buf.toString('utf8', start));
  return modes;
}

function recordMode(modes, record) {
  const tab = record.indexOf('\t');
  if (tab === -1) return;
  const mode = record.slice(0, tab).split(' ')[0];
  const filePath = record.slice(tab + 1);
  if (filePath) modes.set(filePath, mode);
}
