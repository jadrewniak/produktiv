/**
 * Optional Node-backed capability probe.
 *
 * Not the Capability Registry. Skills follow workflow/references/capabilities.md
 * and read host-native facts from the session. Call this only when Node is
 * already present. It is not how /pk-setup discovers that Node is absent.
 * It does not install Node or Git, and it does not read project policy
 * or local preference.
 */

import { execFile } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const GRAPH_NODE_MAJOR = 22;
export const DIAGRAM_NODE_MAJOR = 18;

export const GRAPH_DIST_MARKER = 'workflow/vendor/understand-anything/dist';
export const GRAPH_BUNDLE_OK_MARKER = 'workflow/vendor/understand-anything/BUNDLE_OK';
export const DIAGRAM_BUNDLE_MARKER =
  'workflow/vendor/archify/renderers/architecture/render-architecture.mjs';

const GIT_VERSION_TIMEOUT_MS = 5000;

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export function defaultRepoRoot() {
  return path.resolve(moduleDir, '../../..');
}

function parseNodeMajor(version) {
  const match = /^v?(\d+)/.exec(String(version).trim());
  if (!match) return null;
  return Number(match[1]);
}

function markerPresent(root, rel, kind) {
  const full = path.join(root, rel);
  if (!existsSync(full)) return false;
  const stat = statSync(full);
  return kind === 'dir' ? stat.isDirectory() : stat.isFile();
}

function graphBundlePresent(root) {
  return (
    markerPresent(root, GRAPH_DIST_MARKER, 'dir') ||
    markerPresent(root, GRAPH_BUNDLE_OK_MARKER, 'file')
  );
}

function diagramBundlePresent(root) {
  return markerPresent(root, DIAGRAM_BUNDLE_MARKER, 'file');
}

async function probeGit() {
  try {
    await execFileAsync('git', ['--version'], {
      timeout: GIT_VERSION_TIMEOUT_MS,
      windowsHide: true,
    });
    return { available: true, reason: null };
  } catch {
    return { available: false, reason: 'git-unavailable' };
  }
}

function derive({ major, version, git, graphBundle, diagramBundle }) {
  let graph;
  if (major < GRAPH_NODE_MAJOR) graph = { available: false, reason: 'node-floor' };
  else if (!git.available) graph = { available: false, reason: 'git-unavailable' };
  else if (!graphBundle) graph = { available: false, reason: 'missing-runtime' };
  else graph = { available: true, reason: null };

  let diagram;
  if (major < DIAGRAM_NODE_MAJOR) diagram = { available: false, reason: 'node-floor' };
  else if (!diagramBundle) diagram = { available: false, reason: 'missing-runtime' };
  else diagram = { available: true, reason: null };

  return {
    node: { available: true, version, major, reason: null },
    git,
    graph,
    diagram,
  };
}

/**
 * @param {object} [options]
 * @param {string} [options.nodeVersion] Replaces process.version. Use this to simulate a major.
 * @param {number} [options.nodeMajor] Replaces the parsed major. Same simulation, as an integer.
 * @param {boolean} [options.gitAvailable] Skips `git --version` when set.
 * @param {string} [options.root] Directory that contains `workflow/`. Defaults to this repo.
 * @param {boolean} [options.graphBundle] Skips the graph marker check when set.
 * @param {boolean} [options.diagramBundle] Skips the diagram marker check when set.
 * Unknown fields, including project policy and local preference, are ignored.
 */
export async function probe(options = {}) {
  let major;
  let version;
  if (options.nodeMajor != null) {
    if (!Number.isInteger(options.nodeMajor) || options.nodeMajor < 0) {
      throw new Error('nodeMajor must be a non-negative integer');
    }
    major = options.nodeMajor;
    version = options.nodeVersion ?? `v${major}.0.0`;
  } else {
    version = options.nodeVersion ?? process.version;
    major = parseNodeMajor(version);
    if (major == null) throw new Error(`Unrecognized Node version: ${version}`);
  }

  const git =
    typeof options.gitAvailable === 'boolean'
      ? {
          available: options.gitAvailable,
          reason: options.gitAvailable ? null : 'git-unavailable',
        }
      : await probeGit();

  const root = options.root ?? defaultRepoRoot();
  const graphBundle =
    typeof options.graphBundle === 'boolean' ? options.graphBundle : graphBundlePresent(root);
  const diagramBundle =
    typeof options.diagramBundle === 'boolean' ? options.diagramBundle : diagramBundlePresent(root);

  return derive({ major, version, git, graphBundle, diagramBundle });
}
