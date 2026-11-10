/**
 * Thin bootstrap for the delivery the generic Skills installer does not do.
 *
 * On Cursor, `skills add` copies each skill directory and stops. This script places immutable verified releases in a user-level
 * store outside the project and one project-specific `produktiv` link inside
 * each installed skill. Skill registration stays with that installer. The
 * project pin is shareable; project artifacts remain outside installer ownership.
 *
 *   node workflow/scripts/bootstrap.mjs install --host cursor --scope project --project <dir>
 *   node workflow/scripts/bootstrap.mjs update  --host cursor --scope project --project <dir>
 *   node workflow/scripts/bootstrap.mjs uninstall --host cursor --scope project --project <dir>
 */

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { createHash, randomUUID } from 'node:crypto';
import {
  existsSync,
  cpSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  renameSync,
  rmdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  GRAPH_RESOLVE_SPECS,
  PACKAGE_MARKER_NAME,
  RELEASE_RECEIPT_NAME,
  STAGING_TOKEN_NAME,
  activeAgentResources,
  buildPackageImage,
  finalizeRelease,
  historicalAgentInventory,
  measureSurfaces,
  readMarker,
  releaseInventory,
  verifyRelease,
} from './package-image.mjs';

export const SKILL_LINK_NAME = 'produktiv';
export const MANIFEST_KIND = 'produktiv-ownership';
export const PIN_KIND = 'produktiv-project-pin';
export const PIN_NAME = 'produktiv-lock.json';
export const PIN_SCHEMA_VERSION = 1;

const IGNORE_BLOCK_START = '# Produktiv installer registrations (managed)';
const IGNORE_BLOCK_END = '# End Produktiv installer registrations';

const PROTECTED_MARKERS = ['/.workflow', '/docs/issues', '/docs/plans', '/docs/specs', '/docs/adr'];

const DIAGRAM_FILES = [
  'vendor/archify/assets/template.html',
  'vendor/archify/assets/JetBrainsMono-OFL.txt',
  'vendor/archify/LICENSE',
  'vendor/archify/renderers/architecture/render-architecture.mjs',
  'vendor/archify/renderers/workflow/render-workflow.mjs',
  'vendor/archify/renderers/sequence/render-sequence.mjs',
  'vendor/archify/renderers/dataflow/render-dataflow.mjs',
  'vendor/archify/renderers/lifecycle/render-lifecycle.mjs',
  'vendor/archify/renderers/shared/validator.mjs',
  'vendor/archify/renderers/shared/generated-validators.mjs',
  'vendor/archify/schemas/architecture.schema.json',
  'vendor/archify/delta/architecture-delta.mjs',
  'vendor/archify/scripts/check-render-output.mjs',
  'adapters/diagram/index.mjs',
];

export class BootstrapError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'BootstrapError';
    this.code = code;
  }
}

export function defaultWorkflowSource() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

/**
 * Host descriptors own only registration/discovery paths. Release identity,
 * the external store, project pin, smoke and ownership rules stay shared.
 * Cursor and Codex use the open `.agents/skills` project location; Claude Code
 * uses `.claude/skills`. Cursor's compatibility alias is observed when the
 * generic installer creates it, but is never required.
 */
export const HOST_LAYOUTS = {
  cursor: {
    project(base, storeRoot) {
      return layout('cursor', 'cursor', 'project', base, path.join(base, '.agents'), storeRoot, [
        path.join(base, '.cursor', 'skills'),
      ]);
    },
    global(home, storeRoot) {
      return layout('cursor', 'cursor', 'global', home, path.join(home, '.agents'), storeRoot, [
        path.join(home, '.cursor', 'skills'),
      ]);
    },
  },
  codex: {
    project(base, storeRoot) {
      return layout('codex', 'codex', 'project', base, path.join(base, '.agents'), storeRoot);
    },
    global(home, storeRoot) {
      return layout('codex', 'codex', 'global', home, path.join(home, '.agents'), storeRoot);
    },
  },
  'claude-code': {
    project(base, storeRoot) {
      return layout('claude-code', 'claude-code', 'project', base, path.join(base, '.claude'), storeRoot);
    },
    global(home, storeRoot) {
      return layout('claude-code', 'claude-code', 'global', home, path.join(home, '.claude'), storeRoot);
    },
  },
};

function layout(host, cliAgent, scope, scopeBase, hostRoot, storeRoot, aliasSkillsDirs = []) {
  const localPackagesDir = path.join(hostRoot, 'packages');
  return {
    host,
    cliAgent,
    scope,
    scopeBase,
    skillsDir: path.join(hostRoot, 'skills'),
    aliasSkillsDirs,
    hostRoot,
    storeRoot,
    legacyPackageRoot: path.join(localPackagesDir, 'produktiv'),
    manifestPath: path.join(localPackagesDir, 'produktiv.ownership.json'),
    pinPath: scope === 'project' ? path.join(scopeBase, PIN_NAME) : null,
    gitignorePath: scope === 'project' ? path.join(scopeBase, '.gitignore') : null,
    packageRoot: null,
  };
}

export function layoutFor({ host = 'cursor', scope = 'project', project, home, storeRoot } = {}) {
  const table = HOST_LAYOUTS[host];
  if (!table) {
    throw new BootstrapError(`${host} is not a supported host. Use cursor, codex, or claude-code.`, 'host');
  }
  const place = table[scope];
  if (!place) throw new BootstrapError(`${scope} is not a ${host} scope`, 'scope');
  const resolvedHome = resolveExisting(home ?? homedir());
  const resolvedStore = path.resolve(
    storeRoot ?? path.join(resolvedHome, '.agents', 'packages', 'produktiv', 'releases'),
  );
  if (scope === 'project') {
    if (!project) throw new BootstrapError('Project scope needs --project', 'usage');
    return place(resolveExisting(project), resolvedStore);
  }
  return place(resolvedHome, resolvedStore);
}

export function linkTarget(skillDir, packageRoot) {
  const relative = path.relative(path.resolve(skillDir), path.resolve(packageRoot));
  if (!relative || path.isAbsolute(relative) || !relative.startsWith('..')) {
    throw new BootstrapError(
      `Link target from ${skillDir} to ${packageRoot} is ${relative || 'empty'}`,
      'link-target',
    );
  }
  return relative.split(path.sep).join('/');
}

export function isProtectedInstallPath(candidate) {
  const joined = path.resolve(candidate).split(path.sep).join('/');
  return PROTECTED_MARKERS.some((marker) => joined.endsWith(marker) || joined.includes(`${marker}/`));
}

export function nodeMajor(version = process.versions.node) {
  const major = Number(String(version).split('.')[0]);
  return Number.isInteger(major) ? major : null;
}

export async function install(options = {}) {
  const settings = normalize(options);
  assertWorkflowSource(settings.source);
  assertOutsideProjectState(settings.layout);
  cleanStaleStaging(settings.layout.storeRoot);
  const current = readManifest(settings.layout.manifestPath);
  if (current && current.kind !== MANIFEST_KIND) throw new BootstrapError('Ownership manifest is not a produktiv manifest.', 'manifest');
  const pin = readProjectPin(settings.layout.pinPath);
  if (current?.manifestVersion >= 2 && (!pin || current.packageVersion !== pin.version ||
      current.releaseDigest !== pin.digest)) {
    throw new BootstrapError(
      'The installed release and project pin differ. Use the explicit update operation to change releases.',
      'pin-mismatch',
    );
  }
  const release = await resolveRelease(settings, pin);
  selectRelease(settings, release);
  assertSkillOwnership(settings, current);
  const registration = snapshotRegistration(settings, current);
  try {
    if (settings.register) {
      registerSkills(settings);
      registration.restoreGenericLock();
    }
    const skills = registeredPackageSkills(settings);
    if (skills.length === 0) {
      throw new BootstrapError(`No ${settings.host} skills are installed to link. Registration did not place a skill.`, 'no-skill');
    }
    const committed = await activateRelease(settings, skills, current, pin, 'install');
    return resultOf('install', settings, committed, Boolean(current?.releaseDigest === release.receipt.digest));
  } catch (error) {
    registration.restore();
    throw error;
  } finally { registration.dispose(); }
}

export async function update(options = {}) {
  const settings = normalize(options);
  assertWorkflowSource(settings.source);
  assertOutsideProjectState(settings.layout);
  const current = readManifest(settings.layout.manifestPath);
  if (current && current.kind !== MANIFEST_KIND) throw new BootstrapError('Ownership manifest is not a produktiv manifest.', 'manifest');
  if (!current) {
    throw new BootstrapError('No produktiv package is installed here to update.', 'not-installed');
  }
  cleanStaleStaging(settings.layout.storeRoot);
  const pin = readProjectPin(settings.layout.pinPath);
  const release = await resolveRelease(settings, null);
  selectRelease(settings, release);
  assertSkillOwnership(settings, current);
  const registration = snapshotRegistration(settings, current);
  try {
    if (settings.register) {
      registerSkills(settings);
      registration.restoreGenericLock();
    }
    const skills = registeredPackageSkills(settings);
    if (skills.length === 0) throw new BootstrapError('No Produktiv skills are installed.', 'no-skill');
    const committed = await activateRelease(settings, skills, current, pin, 'update');
    return resultOf('update', settings, committed, Boolean(current.releaseDigest === release.receipt.digest));
  } catch (error) {
    registration.restore();
    throw error;
  } finally { registration.dispose(); }
}

function digest(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function packageSkills(settings) {
  const skills = listSkillDirs(path.join(settings.packageRoot, 'skills'));
  if (skills.length === 0) throw new BootstrapError('Package has no skills/ inventory.', 'source');
  for (const skill of skills) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skill.name) ||
        !readFileSync(skill.skillFile, 'utf8').startsWith(`---\nname: ${skill.name}\n`)) {
      throw new BootstrapError(`Invalid package skill identity: ${skill.name}`, 'source');
    }
  }
  return skills;
}

function installedPackageSkills(settings) {
  const names = new Set(packageSkills(settings).map((skill) => skill.name));
  return listSkillDirs(settings.layout.skillsDir).filter((skill) => names.has(skill.name));
}

function registeredPackageSkills(settings) {
  const installed = installedPackageSkills(settings);
  const byName = new Map(installed.map((skill) => [skill.name, skill]));
  for (const source of packageSkills(settings)) {
    const skill = byName.get(source.name);
    if (!skill || digest(skill.skillFile) !== digest(source.skillFile)) {
      throw new BootstrapError(`Registration did not supply the current ${source.name}/SKILL.md.`, 'skill-version');
    }
  }
  return installed;
}

function assertSkillOwnership(settings, manifest) {
  const previous = new Map((manifest?.skillFiles ?? []).map((entry) => [entry.skill, entry.sha256]));
  const previousRoot = manifest?.canonicalPackageRoot ?? null;
  for (const skill of packageSkills(settings)) {
    const dir = path.join(settings.layout.skillsDir, skill.name);
    for (const hostAlias of aliasPaths(settings.layout, skill.name)) {
      try {
        const aliasStat = lstatSync(hostAlias);
        if (aliasStat.isSymbolicLink()) {
          if (!samePath(path.resolve(path.dirname(hostAlias), readlinkSync(hostAlias)), dir)) {
            throw new BootstrapError(`Refusing to replace an unrelated host skill alias: ${hostAlias}`, 'skill-collision');
          }
        } else {
          const aliasFile = path.join(hostAlias, 'SKILL.md');
          if (!aliasStat.isDirectory() || !existsSync(aliasFile) ||
              (digest(aliasFile) !== digest(skill.skillFile) && digest(aliasFile) !== previous.get(skill.name))) {
            throw new BootstrapError(`Refusing to replace an unrelated host skill: ${hostAlias}`, 'skill-collision');
          }
        }
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
    let stat;
    try { stat = lstatSync(dir); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
    const file = path.join(dir, 'SKILL.md');
    if (!stat.isDirectory() || stat.isSymbolicLink() || !existsSync(file) ||
        (digest(file) !== digest(skill.skillFile) && digest(file) !== previous.get(skill.name))) {
      throw new BootstrapError(`Refusing to replace an unowned or locally edited skill: ${dir}`, 'skill-collision');
    }
  }
  assertNoForeignLinks(installedPackageSkills(settings), settings.packageRoot, previousRoot ? [previousRoot] : []);
}

function snapshotRegistration(settings, manifest) {
  const scratch = mkdtempSync(path.join(tmpdir(), 'produktiv-registration-'));
  const names = new Set([
    ...packageSkills(settings).map((skill) => skill.name),
    ...(manifest?.skillFiles ?? [])
      .map((entry) => entry.skill)
      .filter((name) => typeof name === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)),
  ]);
  const paths = [...names].flatMap((name) => [
    path.join(settings.layout.skillsDir, name),
    ...aliasPaths(settings.layout, name),
  ]);
  const genericLockPath = path.join(settings.layout.scopeBase, 'skills-lock.json');
  paths.push(genericLockPath);
  paths.push(settings.layout.manifestPath);
  if (settings.layout.pinPath) paths.push(settings.layout.pinPath);
  if (settings.layout.gitignorePath) paths.push(settings.layout.gitignorePath);
  const entries = paths.map((file, index) => {
    let present = false;
    try { lstatSync(file); present = true; } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const saved = path.join(scratch, String(index));
    if (present) cpSync(file, saved, { recursive: true, verbatimSymlinks: true });
    return { file, saved, present };
  });
  const restoreEntry = (entry) => {
    rmSync(entry.file, { recursive: true, force: true });
    if (entry.present) {
      mkdirSync(path.dirname(entry.file), { recursive: true });
      cpSync(entry.saved, entry.file, { recursive: true, verbatimSymlinks: true });
    }
  };
  return {
    restoreGenericLock() {
      const entry = entries.find((candidate) => candidate.file === genericLockPath);
      if (entry) restoreEntry(entry);
    },
    restore() {
      for (const entry of entries) restoreEntry(entry);
    },
    dispose() { rmSync(scratch, { recursive: true, force: true }); },
  };
}

// Install may have created these project directories. Remove them only when nothing else is left in them.
function removeEmptyDirs(dirs) {
  const removed = [];
  for (const dir of dirs) {
    try {
      if (!lstatSync(dir).isDirectory() || readdirSync(dir).length > 0) continue;
      rmdirSync(dir);
      removed.push(dir);
    } catch {
      // Absent or unreadable: leave it.
    }
  }
  return removed;
}

export function uninstall(options = {}) {
  const settings = normalize(options);
  const placed = settings.layout;
  const manifest = readManifest(placed.manifestPath);
  if (!manifest) return { ok: true, command: 'uninstall', removed: [], refused: [], alreadyAbsent: true };
  if (manifest.kind !== MANIFEST_KIND) {
    throw new BootstrapError('Ownership manifest is not a produktiv manifest.', 'manifest');
  }
  const removed = [];
  const refused = [];
  settings.packageRoot = manifest.canonicalPackageRoot;
  placed.packageRoot = manifest.canonicalPackageRoot;
  const managedNames = new Set((manifest.skillFiles ?? []).map((entry) => entry.skill));
  const owned = Array.isArray(manifest.owned) ? manifest.owned : [];
  const links = owned.filter((entry) => entry.type === 'link');
  const aliases = owned.filter((entry) => entry.type === 'host-alias');
  const registrations = owned.filter((entry) => entry.type === 'skill-registration');
  const manifests = owned.filter((entry) => entry.type === 'manifest');
  const others = owned.filter((entry) => !['link', 'host-alias', 'skill-registration', 'manifest'].includes(entry.type));
  for (const entry of [...links, ...aliases, ...registrations, ...others]) {
    if (entry.type === 'link' && !managedNames.has(entry.skill)) {
      refused.push({ path: entry.path, reason: 'not-package-skill' });
      continue;
    }
    const outcome = deleteOwned(entry, placed, manifest);
    if (outcome.removed) removed.push(outcome.path);
    if (outcome.refused) refused.push(outcome);
  }
  const ignore = removeInstallIgnoreBlock(settings, manifest);
  if (ignore.removed) removed.push(ignore.path);
  if (ignore.refused) refused.push(ignore);
  if (refused.length === 0) {
    for (const entry of manifests) {
      const outcome = deleteOwned(entry, placed, manifest);
      if (outcome.removed) removed.push(outcome.path);
      if (outcome.refused) refused.push(outcome);
    }
  }
  if (refused.length === 0 && placed.scope === 'project') {
    removed.push(...removeEmptyDirs([placed.skillsDir, path.dirname(placed.manifestPath), placed.hostRoot]));
  }
  return {
    ok: refused.length === 0,
    command: 'uninstall',
    removed,
    refused,
    alreadyAbsent: false,
    canonicalPackageRoot: manifest.canonicalPackageRoot,
    retainedRelease: manifest.canonicalPackageRoot,
    pinPreserved: placed.pinPath ? existsSync(placed.pinPath) : null,
  };
}

export function listSkillDirs(skillsDir) {
  if (!existsSync(skillsDir)) return [];
  const found = [];
  for (const name of readdirSync(skillsDir)) {
    if (name.startsWith('.')) continue;
    const dir = path.join(skillsDir, name);
    let stat;
    try {
      stat = lstatSync(dir);
    } catch {
      continue;
    }
    if (!stat.isDirectory() || stat.isSymbolicLink()) continue;
    const skillFile = path.join(dir, 'SKILL.md');
    if (!existsSync(skillFile)) continue;
    found.push({ name, dir, skillFile });
  }
  return found.sort((left, right) => left.name.localeCompare(right.name));
}

export async function assessSkill(skillDir, facts = {}) {
  const nodeAvailable = facts.nodeAvailable !== false;
  const major = facts.nodeMajor ?? null;
  const base = path.join(skillDir, SKILL_LINK_NAME);
  const result = {
    core: { available: false, reason: 'missing-package' },
    graph: { available: false, reason: 'missing-package' },
    diagram: { available: false, reason: 'missing-package' },
  };
  if (!entryExists(base)) return result;
  try {
    result.core = readCore(base);
  } catch (error) {
    result.core = { available: false, reason: 'unavailable', detail: error.message };
    return result;
  }
  if (!result.core.available) {
    result.graph = { available: false, reason: result.core.reason };
    result.diagram = { available: false, reason: result.core.reason };
    return result;
  }
  if (!nodeAvailable) {
    result.graph = { available: false, reason: 'node-absent' };
    result.diagram = { available: false, reason: 'node-absent' };
    return result;
  }
  try {
    result.diagram = await assessDiagram(base, major);
  } catch (error) {
    result.diagram = { available: false, reason: 'unavailable', detail: error.message };
  }
  try {
    result.graph = assessGraph(base, major);
  } catch (error) {
    result.graph = { available: false, reason: 'unavailable', detail: error.message };
  }
  return result;
}

export function resolveInstalledGraph(pluginPath) {
  const packageRoot = packageRootFromPlugin(pluginPath);
  const require = createRequire(pluginPath);
  const resolved = {};
  for (const spec of GRAPH_RESOLVE_SPECS) {
    const hit = require.resolve(spec);
    assertInsidePackage(packageRoot, hit, spec);
    resolved[spec] = hit;
  }
  return { packageRoot, resolved };
}

export async function loadInstalledGraph(pluginPath) {
  const { packageRoot, resolved } = resolveInstalledGraph(pluginPath);
  const runtime = await import(pathToFileURL(resolved['web-tree-sitter']).href);
  await runtime.Parser.init();
  for (const spec of GRAPH_RESOLVE_SPECS) {
    if (!spec.endsWith('.wasm') || spec.startsWith('web-tree-sitter/')) continue;
    await runtime.Language.load(resolved[spec]);
  }
  return { ok: true, packageRoot, specs: Object.keys(resolved) };
}

export async function exerciseInstalledLibraries(pluginPath) {
  const require = createRequire(pluginPath);
  const uaRoot = path.resolve(path.dirname(pluginPath), '..', '..');
  await import(pathToFileURL(path.join(uaRoot, 'dist', 'index.js')).href);
  await import(pathToFileURL(path.join(uaRoot, 'scripts', 'head-source.mjs')).href);
  const yaml = require('yaml');
  if (yaml.parse('a: 1').a !== 1) throw new Error('yaml parse failed');
  const ignoreMod = await import(pathToFileURL(require.resolve('ignore')).href);
  const ignore = ignoreMod.default().add('node_modules');
  if (!ignore.ignores('node_modules/pkg')) throw new Error('ignore failed');
  const zod = await import(pathToFileURL(path.join(uaRoot, 'node_modules', 'zod', 'index.js')).href);
  zod.z.string().parse('ok');
  return { ok: true };
}

function normalize(options) {
  const source = path.resolve(options.source ?? defaultWorkflowSource());
  const layoutSpec = layoutFor(options);
  const isolatedHome = resolveExisting(options.home ?? homedir());
  return {
    host: layoutSpec.host,
    scope: layoutSpec.scope,
    source,
    layout: layoutSpec,
    packageRoot: null,
    release: null,
    register: options.register !== false,
    // Keep the generic installer inside the same explicit clean home for both
    // project and global scopes. Otherwise project registration can silently
    // inherit user-level installer configuration even though its release store
    // is isolated.
    home: isolatedHome,
    skillsVersion: options.skillsVersion ?? null,
    smoke: options.smoke ?? null,
  };
}

function assertWorkflowSource(source) {
  if (existsSync(path.join(source, '.upstream'))) {
    throw new BootstrapError(
      'Package source must be workflow/. The git root lists skills from .upstream/.',
      'source',
    );
  }
  if (!existsSync(path.join(source, RELEASE_RECEIPT_NAME)) &&
      !existsSync(path.join(source, 'references', 'capabilities.md'))) {
    throw new BootstrapError('Package source is missing references/capabilities.md', 'source');
  }
}

function assertOutsideProjectState(placed) {
  for (const candidate of [placed.storeRoot, placed.manifestPath, placed.skillsDir]) {
    if (isProtectedInstallPath(candidate)) {
      throw new BootstrapError(`Refusing to use project-owned path ${candidate}`, 'protected-path');
    }
  }
  if (placed.scope === 'project' && pathsOverlap(placed.scopeBase, placed.storeRoot)) {
    throw new BootstrapError('External release store overlaps the target project.', 'store-overlap');
  }
}

async function resolveRelease(settings, expectedPin) {
  if (expectedPin) {
    const pinnedRoot = releaseRoot(settings.layout.storeRoot, expectedPin.version, expectedPin.digest);
    if (existsSync(pinnedRoot)) {
      try {
        const receipt = verifyRelease(pinnedRoot, expectedPin);
        return { root: pinnedRoot, receipt, reused: true };
      } catch (error) {
        throw new BootstrapError(`Pinned release failed verification. ${error.message}`, 'pin-resolution');
      }
    }
  }
  mkdirSync(settings.layout.storeRoot, { recursive: true });
  const staging = path.join(settings.layout.storeRoot, `.produktiv-next-${randomUUID()}`);
  try {
    mkdirSync(staging, { recursive: true });
    writeFileSync(path.join(staging, STAGING_TOKEN_NAME), 'produktiv\n');
    if (existsSync(path.join(settings.source, RELEASE_RECEIPT_NAME))) {
      copyDirectoryContents(settings.source, staging);
    } else {
      const image = buildPackageImage({ source: settings.source, dest: staging });
      for (const skill of listSkillDirs(path.join(settings.source, 'skills'))) {
        cpSync(skill.dir, path.join(staging, 'skills', skill.name), { recursive: true });
      }
      finalizeRelease(staging, {
        version: image.packageVersion,
        skills: listSkillDirs(path.join(staging, 'skills')).map((skill) => skill.name),
        activeAgentResources: activeAgentResources(settings.source),
        legacyAgentInventory: historicalAgentInventory(settings.source),
        surfaces: Object.entries(image.surfaces).filter(([, value]) => value.ok).map(([name]) => name),
      });
    }
    rmSync(path.join(staging, STAGING_TOKEN_NAME), { force: true });
    const receipt = verifyRelease(staging, expectedPin ?? {});
    const root = releaseRoot(settings.layout.storeRoot, receipt.version, receipt.digest);
    mkdirSync(path.dirname(root), { recursive: true });
    if (existsSync(root)) {
      const existing = verifyRelease(root, { version: receipt.version, digest: receipt.digest });
      rmSync(staging, { recursive: true, force: true });
      return { root, receipt: existing, reused: true };
    }
    try {
      renameSync(staging, root);
    } catch (error) {
      if (!['EEXIST', 'ENOTEMPTY'].includes(error.code) || !existsSync(root)) throw error;
      const existing = verifyRelease(root, { version: receipt.version, digest: receipt.digest });
      rmSync(staging, { recursive: true, force: true });
      return { root, receipt: existing, reused: true };
    }
    return { root, receipt, reused: false };
  } catch (error) {
    rmSync(staging, { recursive: true, force: true });
    if (error instanceof BootstrapError) throw error;
    throw new BootstrapError(error.message, expectedPin ? 'pin-resolution' : 'release');
  }
}

function selectRelease(settings, release) {
  settings.packageRoot = release.root;
  settings.release = release.receipt;
  settings.layout.packageRoot = release.root;
}

async function activateRelease(settings, skills, previousManifest, previousPin, command) {
  const built = {
    packageVersion: settings.release.version,
    releaseDigest: settings.release.digest,
    surfaces: surfaceStatus(settings.packageRoot),
  };
  let smoke;
  try {
    smoke = await smokePackage(settings.packageRoot, settings);
  } catch (error) {
    throw new BootstrapError(`Release smoke failed. ${error.message}`, 'smoke-failed');
  }
  if (!smoke.core.ok) {
    throw new BootstrapError(
      smoke.core.detail || 'Core package smoke failed',
      command === 'update' ? 'smoke-failed' : 'core-failed',
    );
  }
  const optionalFailed = ['graph', 'diagram'].filter((name) =>
    built.surfaces[name].ok && !smoke[name].ok && !['node-floor', 'node-absent'].includes(smoke[name].reason));
  if (optionalFailed.length > 0) {
    throw new BootstrapError(
      `Release smoke failed. ${optionalFailed.map((name) => smoke[name].detail || smoke[name].reason).join('; ')}`,
      'smoke-failed',
    );
  }
  const allowedRoots = previousManifest?.canonicalPackageRoot ? [previousManifest.canonicalPackageRoot] : [];
  const links = ensureLinks(skills, settings.packageRoot, allowedRoots);
  const skillSmoke = await smokeThroughSkill(skills[0].dir, built.surfaces);
  if (!skillSmoke.core.ok) {
    throw new BootstrapError(skillSmoke.core.detail || 'Skill link cannot read the core package', 'core-failed');
  }
  const discovery = discover(settings, links);
  if (!discovery.ok) throw new BootstrapError('Registered skills were not discovered.', 'no-skill');
  removeObsoleteRegistrations(settings, previousManifest, skills);
  const ignore = ensureInstallIgnoreBlock(settings, skills, previousManifest);
  const manifest = manifestFor(settings, built, links, skillSmoke, skills, ignore);
  writeManifest(settings.layout.manifestPath, manifest);
  if (settings.layout.pinPath) writeProjectPin(settings.layout.pinPath, {
    kind: PIN_KIND,
    schemaVersion: PIN_SCHEMA_VERSION,
    package: 'produktiv-workflow',
    version: settings.release.version,
    digest: settings.release.digest,
  });
  const migration = migrateLegacyLayout(settings, previousManifest);
  return { built, links, smoke: skillSmoke, manifest, discovery, migration, previousPin, command };
}

function surfaceStatus(packageRoot) {
  const bytes = measureSurfaces(packageRoot);
  const graphThere = existsSync(path.join(packageRoot, 'vendor', 'understand-anything', 'dist', 'plugins', 'tree-sitter-plugin.js'));
  const diagramThere = existsSync(path.join(packageRoot, 'vendor', 'archify', 'assets', 'template.html'));
  return {
    core: { ok: true, bytes: bytes.core, reason: null, detail: null },
    graph: { ok: graphThere, bytes: graphThere ? bytes.graph : 0, reason: graphThere ? null : 'not-in-source', detail: null },
    diagram: { ok: diagramThere, bytes: diagramThere ? bytes.diagram : 0, reason: diagramThere ? null : 'not-in-source', detail: null },
  };
}

function resultOf(command, settings, committed, idempotent) {
  const discovery = committed.discovery ?? discover(settings, committed.links);
  const coreOk = committed.smoke.core.ok && discovery.ok;
  return {
    ok: coreOk,
    command,
    idempotent,
    host: settings.host,
    scope: settings.scope,
    packageVersion: committed.built.packageVersion,
    releaseDigest: committed.built.releaseDigest,
    canonicalPackageRoot: path.resolve(settings.packageRoot),
    manifestPath: settings.layout.manifestPath,
    skillsVersion: settings.skillsVersion,
    source: settings.source,
    links: committed.links,
    surfaces: committed.built.surfaces,
    smokes: { ...committed.smoke, discovery },
    pinPath: settings.layout.pinPath,
    migration: committed.migration ?? null,
  };
}

function manifestFor(settings, built, links, smoke, skills, ignore) {
  const packageRoot = path.resolve(settings.packageRoot);
  const manifestPath = path.resolve(settings.layout.manifestPath);
  const aliases = packageAliases(settings, skills);
  const registrations = skills.map((skill) => ({
    type: 'skill-registration',
    path: path.resolve(skill.dir),
    skill: skill.name,
    sha256: digest(skill.skillFile),
  }));
  const owned = [
    { type: 'manifest', path: manifestPath },
    ...links.map((link) => ({
      type: 'link',
      path: path.resolve(link.path),
      skill: link.skill,
      host: settings.host,
      scope: settings.scope,
      target: link.target,
    })),
    ...aliases,
    ...registrations,
  ];
  const manifest = {
    kind: MANIFEST_KIND,
    manifestVersion: 2,
    packageVersion: built.packageVersion,
    releaseDigest: built.releaseDigest,
    host: settings.host,
    scope: settings.scope,
    canonicalPackageRoot: packageRoot,
    owned,
    links: owned.filter((entry) => entry.type === 'link'),
    ignoreBlockSha256: ignore?.sha256 ?? null,
    ignoreFileCreated: ignore?.fileCreated ?? false,
    skillFiles: links.map((link) => ({ skill: link.skill, sha256: digest(path.join(path.dirname(link.path), 'SKILL.md')) })),
    surfaces: {
      core: statusBrief(built.surfaces.core, smoke.core),
      graph: statusBrief(built.surfaces.graph, smoke.graph),
      diagram: statusBrief(built.surfaces.diagram, smoke.diagram),
    },
  };
  for (const entry of manifest.owned) {
    if (isProtectedInstallPath(entry.path)) {
      throw new BootstrapError(`Refusing to record protected path ${entry.path}`, 'protected-path');
    }
  }
  return manifest;
}

function statusBrief(surface, smoke) {
  return {
    ok: Boolean(surface.ok && smoke.ok),
    bytes: surface.bytes,
    reason: surface.ok ? smoke.reason : surface.reason,
  };
}

function releaseRoot(storeRoot, version, digestValue) {
  if (typeof version !== 'string' || version === '.' || version === '..' ||
      !/^[A-Za-z0-9][A-Za-z0-9._+-]*$/.test(version) || !/^[a-f0-9]{64}$/.test(digestValue)) {
    throw new BootstrapError('Project pin contains an unsafe version or digest.', 'pin');
  }
  return path.join(storeRoot, version, digestValue);
}

function readProjectPin(pinPath) {
  if (!pinPath || !existsSync(pinPath)) return null;
  let pin;
  try { pin = JSON.parse(readFileSync(pinPath, 'utf8')); } catch {
    throw new BootstrapError(`Cannot read ${pinPath}.`, 'pin');
  }
  if (pin.kind !== PIN_KIND || pin.schemaVersion !== PIN_SCHEMA_VERSION ||
      pin.package !== 'produktiv-workflow') {
    throw new BootstrapError(`Unsupported project pin at ${pinPath}.`, 'pin');
  }
  releaseRoot(path.dirname(pinPath), pin.version, pin.digest);
  return pin;
}

function writeProjectPin(pinPath, pin) {
  writeJsonAtomic(pinPath, pin);
}

function copyDirectoryContents(source, dest) {
  for (const name of readdirSync(source)) {
    if (name === STAGING_TOKEN_NAME || name === '.DS_Store') continue;
    cpSync(path.join(source, name), path.join(dest, name), {
      recursive: true,
      verbatimSymlinks: true,
    });
  }
}

function pathsOverlap(left, right) {
  const a = canonicalPath(left);
  const b = canonicalPath(right);
  const ab = path.relative(a, b);
  const ba = path.relative(b, a);
  return ab === '' || (!ab.startsWith('..') && !path.isAbsolute(ab)) ||
    (!ba.startsWith('..') && !path.isAbsolute(ba));
}

function canonicalPath(candidate) {
  const resolved = path.resolve(candidate);
  const suffix = [];
  let existing = resolved;
  while (!existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) return resolved;
    suffix.unshift(path.basename(existing));
    existing = parent;
  }
  try { return path.join(realpathSync(existing), ...suffix); } catch { return resolved; }
}

function aliasPaths(placed, skillName) {
  return (placed.aliasSkillsDirs ?? []).map((root) => path.join(root, skillName));
}

function packageAliases(settings, skills) {
  const aliases = [];
  for (const skill of skills) {
    for (const alias of aliasPaths(settings.layout, skill.name)) {
      let stat;
      try { stat = lstatSync(alias); } catch { continue; }
      if (stat.isSymbolicLink()) {
        const resolved = path.resolve(path.dirname(alias), readlinkSync(alias));
        if (!samePath(resolved, skill.dir)) continue;
        aliases.push({ type: 'host-alias', path: path.resolve(alias), skill: skill.name, aliasKind: 'link' });
        continue;
      }
      const file = path.join(alias, 'SKILL.md');
      if (stat.isDirectory() && existsSync(file) && digest(file) === digest(skill.skillFile)) {
        aliases.push({
          type: 'host-alias',
          path: path.resolve(alias),
          skill: skill.name,
          aliasKind: 'directory',
          sha256: digest(file),
        });
      }
    }
  }
  return aliases;
}

function removeObsoleteRegistrations(settings, previousManifest, skills) {
  if (!previousManifest) return;
  const current = new Set(skills.map((skill) => skill.name));
  const obsolete = (previousManifest.owned ?? [])
    .filter((entry) => ['link', 'host-alias', 'skill-registration'].includes(entry.type) &&
      typeof entry.skill === 'string' && !current.has(entry.skill))
    .sort((left, right) => {
      const order = { link: 0, 'host-alias': 1, 'skill-registration': 2 };
      return order[left.type] - order[right.type];
    });
  for (const entry of obsolete) {
    const outcome = deleteOwned(entry, settings.layout, previousManifest);
    if (outcome.refused) {
      throw new BootstrapError(
        `Obsolete registration was edited or replaced: ${outcome.path} (${outcome.reason})`,
        'obsolete-registration',
      );
    }
  }
}

function installIgnoreBlock(settings, skills, userRules = new Set()) {
  const paths = [path.relative(settings.layout.scopeBase, settings.layout.manifestPath)];
  for (const skill of skills) {
    paths.push(path.relative(settings.layout.scopeBase, skill.dir));
    for (const alias of aliasPaths(settings.layout, skill.name)) {
      if (existsSync(alias) || linkStat(alias)) paths.push(path.relative(settings.layout.scopeBase, alias));
    }
  }
  const rules = [...new Set(paths)]
    .map((rel) => `/${rel.split(path.sep).join('/')}${rel.includes('/skills/') && !rel.endsWith('/') ? '/' : ''}`)
    .filter((rule) => !userRules.has(rule))
    .sort();
  return [IGNORE_BLOCK_START, ...rules, IGNORE_BLOCK_END].join('\n');
}

function ensureInstallIgnoreBlock(settings, skills, previousManifest) {
  if (!settings.layout.gitignorePath) return null;
  const file = settings.layout.gitignorePath;
  const fileExisted = existsSync(file);
  const current = fileExisted ? readFileSync(file, 'utf8') : '';
  const existing = managedIgnoreBlock(current);
  const withoutManaged = existing
    ? `${current.slice(0, existing.start)}${current.slice(existing.end)}`
    : current;
  const userRules = new Set(withoutManaged.split('\n').map((line) => line.trim()).filter(Boolean));
  const desired = installIgnoreBlock(settings, skills, userRules);
  if (existing && existing.text !== desired) {
    if (!previousManifest?.ignoreBlockSha256 ||
        hashText(existing.text) !== previousManifest.ignoreBlockSha256) {
      throw new BootstrapError('The managed Produktiv .gitignore block was edited; refusing to replace it.', 'ignore-collision');
    }
    writeTextAtomic(file, `${current.slice(0, existing.start)}${desired}${current.slice(existing.end)}`);
  }
  if (!existing) {
    const separator = current.length === 0 ? '' : current.endsWith('\n\n') ? '' : current.endsWith('\n') ? '\n' : '\n\n';
    writeTextAtomic(file, `${current}${separator}${desired}\n`);
  }
  return {
    path: file,
    sha256: hashText(desired),
    fileCreated: previousManifest?.ignoreFileCreated ?? !fileExisted,
  };
}

function removeInstallIgnoreBlock(settings, manifest) {
  const file = settings.layout.gitignorePath;
  if (!file || !existsSync(file)) return { removed: false, path: file };
  const current = readFileSync(file, 'utf8');
  const block = managedIgnoreBlock(current);
  if (!block) return { removed: false, path: file };
  if (!manifest.ignoreBlockSha256 || hashText(block.text) !== manifest.ignoreBlockSha256) {
    return { refused: true, path: file, reason: 'edited-ignore-block' };
  }
  const before = current.slice(0, block.start).replace(/\n+$/, '');
  const after = current.slice(block.end).replace(/^\n+/, '');
  const next = [before, after].filter(Boolean).join('\n\n');
  if (!next && manifest.ignoreFileCreated) rmSync(file, { force: true });
  else writeTextAtomic(file, next ? `${next}\n` : '');
  return { removed: true, path: file };
}

function managedIgnoreBlock(text) {
  const start = text.indexOf(IGNORE_BLOCK_START);
  if (start === -1) return null;
  if (text.indexOf(IGNORE_BLOCK_START, start + 1) !== -1) {
    throw new BootstrapError('Multiple managed Produktiv .gitignore blocks found.', 'ignore-collision');
  }
  const endMarker = text.indexOf(IGNORE_BLOCK_END, start);
  if (endMarker === -1) throw new BootstrapError('Incomplete managed Produktiv .gitignore block.', 'ignore-collision');
  const end = endMarker + IGNORE_BLOCK_END.length;
  return { start, end, text: text.slice(start, end) };
}

function hashText(text) {
  return createHash('sha256').update(text).digest('hex');
}

function migrateLegacyLayout(settings, previousManifest) {
  const legacyRoot = settings.layout.legacyPackageRoot;
  if (settings.scope !== 'project' || !previousManifest ||
      !samePath(previousManifest.canonicalPackageRoot, legacyRoot) || !existsSync(legacyRoot)) {
    return { state: 'not-needed' };
  }
  const ownedRoot = (previousManifest.owned ?? []).find((entry) => entry.type === 'package-root');
  const marker = readMarker(legacyRoot);
  if (!ownedRoot || !marker || (ownedRoot.installId && marker.installId !== ownedRoot.installId)) {
    return { state: 'retained', reason: 'ownership-unverified', path: legacyRoot };
  }
  const tracked = trackedUnder(settings.layout.scopeBase, legacyRoot);
  if (tracked === null) {
    return { state: 'retained', reason: 'tracking-unverified', path: legacyRoot };
  }
  if (tracked.length > 0) return { state: 'retained', reason: 'tracked', path: legacyRoot, tracked };
  const expected = new Map(settings.release.inventory.map((entry) => [entry.path, entry]));
  for (const entry of settings.release.legacyAgentInventory ?? []) {
    expected.set(entry.path, { ...entry, type: 'file' });
  }
  const differences = [];
  for (const actual of releaseInventory(legacyRoot)) {
    if (actual.path === PACKAGE_MARKER_NAME) continue;
    const wanted = expected.get(actual.path);
    if (!wanted || wanted.type !== actual.type ||
        (actual.type === 'file' && wanted.sha256 !== actual.sha256) ||
        (actual.type === 'symlink' && wanted.target !== actual.target)) {
      differences.push(actual.path);
    }
  }
  if (differences.length > 0) {
    return { state: 'retained', reason: 'edited-or-unknown', path: legacyRoot, differences };
  }
  rmSync(legacyRoot, { recursive: true, force: true });
  return { state: 'removed', path: legacyRoot };
}

function trackedUnder(project, candidate) {
  const rel = path.relative(project, candidate);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return [];
  const result = spawnSync('git', ['ls-files', '--', rel], { cwd: project, encoding: 'utf8' });
  if (result.error || result.status !== 0) return null;
  return result.stdout.split('\n').filter(Boolean);
}

function writeJsonAtomic(file, value) {
  writeTextAtomic(file, `${JSON.stringify(value, null, 2)}\n`);
}

function writeTextAtomic(file, textValue) {
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(tmp, textValue);
  renameSync(tmp, file);
}

function ensureLinks(skills, packageRoot, allowedPreviousRoots = []) {
  const links = [];
  for (const skill of skills) {
    const linkPath = path.join(skill.dir, SKILL_LINK_NAME);
    const target = linkTarget(skill.dir, packageRoot);
    const state = describeLink(linkPath, packageRoot, allowedPreviousRoots);
    if (state === 'foreign') {
      throw new BootstrapError(
        `Refusing to overwrite ${linkPath}; it is not a produktiv link.`,
        'not-package-owned',
      );
    }
    let created = false;
    if (state === 'previous') rmSync(linkPath, { force: true });
    if (state === 'absent' || state === 'previous') {
      symlinkSync(target, linkPath);
      created = true;
    }
    links.push({ skill: skill.name, path: linkPath, target, created, scope: null, host: null });
  }
  return links;
}

function assertNoForeignLinks(skills, packageRoot, allowedPreviousRoots = []) {
  for (const skill of skills) {
    const linkPath = path.join(skill.dir, SKILL_LINK_NAME);
    if (describeLink(linkPath, packageRoot, allowedPreviousRoots) === 'foreign') {
      throw new BootstrapError(
        `Refusing to overwrite ${linkPath}; it is not a produktiv link.`,
        'not-package-owned',
      );
    }
  }
}

function describeLink(linkPath, packageRoot, allowedPreviousRoots = []) {
  let stat;
  try {
    stat = lstatSync(linkPath);
  } catch (error) {
    if (error.code === 'ENOENT') return 'absent';
    throw error;
  }
  if (!stat.isSymbolicLink()) return 'foreign';
  if (linkPointsAt(linkPath, packageRoot)) return 'ours';
  if (allowedPreviousRoots.some((root) => linkPointsAt(linkPath, root))) return 'previous';
  return 'foreign';
}

function linkPointsAt(linkPath, packageRoot) {
  const raw = readlinkSync(linkPath);
  const resolved = path.resolve(path.dirname(linkPath), raw);
  return samePath(resolved, packageRoot);
}

function deleteOwned(entry, placed, manifest) {
  const target = path.resolve(entry.path);
  if (isProtectedInstallPath(target)) {
    return { refused: true, path: target, reason: 'protected' };
  }
  if (entry.type === 'package-root') {
    if (!samePath(target, placed.legacyPackageRoot) ||
        !samePath(target, placed.packageRoot) || !samePath(target, manifest.canonicalPackageRoot)) {
      return { refused: true, path: target, reason: 'not-package-root' };
    }
    if (!existsSync(target)) return { removed: false, path: target };
    const marker = readMarker(target);
    if (!marker || marker.installId !== entry.installId) {
      return { refused: true, path: target, reason: 'replaced' };
    }
    rmSync(target, { recursive: true, force: true });
    return { removed: true, path: target };
  }
  if (entry.type === 'manifest') {
    if (!samePath(target, placed.manifestPath)) return { refused: true, path: target, reason: 'not-manifest' };
    if (!existsSync(target)) return { removed: false, path: target };
    rmSync(target, { force: true });
    return { removed: true, path: target };
  }
  if (entry.type === 'link') {
    if (typeof entry.skill !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.skill) ||
        target !== path.resolve(placed.skillsDir, entry.skill, SKILL_LINK_NAME)) {
      return { refused: true, path: target, reason: 'not-owned-skill-path' };
    }
    const skillDir = path.dirname(target);
    try {
      const stat = lstatSync(skillDir);
      if (!stat.isDirectory() || stat.isSymbolicLink()) return { refused: true, path: target, reason: 'replaced' };
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (path.basename(target) !== SKILL_LINK_NAME) return { refused: true, path: target, reason: 'not-skill-link' };
    if (!existsSync(target) && !linkStat(target)) return { removed: false, path: target };
    if (!linkPointsAt(target, manifest.canonicalPackageRoot)) {
      return { refused: true, path: target, reason: 'replaced' };
    }
    rmSync(target, { force: true });
    return { removed: true, path: target };
  }
  if (entry.type === 'host-alias') {
    const expected = aliasPaths(placed, entry.skill).map((candidate) => path.resolve(candidate));
    if (!expected.includes(target)) return { refused: true, path: target, reason: 'not-owned-alias-path' };
    if (!existsSync(target) && !linkStat(target)) return { removed: false, path: target };
    if (entry.aliasKind === 'link') {
      if (!linkStat(target)) return { refused: true, path: target, reason: 'replaced' };
      const registration = path.resolve(placed.skillsDir, entry.skill);
      if (!samePath(path.resolve(path.dirname(target), readlinkSync(target)), registration)) {
        return { refused: true, path: target, reason: 'replaced' };
      }
      rmSync(target, { force: true });
      return { removed: true, path: target };
    }
    const file = path.join(target, 'SKILL.md');
    const names = readdirSync(target).sort();
    if (!existsSync(file) || digest(file) !== entry.sha256 || names.some((name) => name !== 'SKILL.md')) {
      return { refused: true, path: target, reason: 'edited-alias' };
    }
    rmSync(target, { recursive: true, force: true });
    return { removed: true, path: target };
  }
  if (entry.type === 'skill-registration') {
    const expected = path.resolve(placed.skillsDir, entry.skill);
    if (target !== expected) return { refused: true, path: target, reason: 'not-owned-registration-path' };
    if (!existsSync(target)) return { removed: false, path: target };
    const skillFile = path.join(target, 'SKILL.md');
    const names = readdirSync(target).sort();
    if (!existsSync(skillFile) || digest(skillFile) !== entry.sha256 ||
        names.some((name) => !['SKILL.md', SKILL_LINK_NAME].includes(name))) {
      return { refused: true, path: target, reason: 'edited-registration' };
    }
    rmSync(target, { recursive: true, force: true });
    return { removed: true, path: target };
  }
  return { refused: true, path: target, reason: 'unknown-type' };
}

function linkStat(target) {
  try {
    return lstatSync(target).isSymbolicLink();
  } catch {
    return false;
  }
}

async function smokePackage(root, settings) {
  const core = smokeCoreFiles(root);
  const graph = await smokeGraphFiles(root, settings);
  const diagram = await smokeDiagramFiles(root);
  if (settings.smoke) await settings.smoke(root);
  return { core, graph, diagram };
}

async function smokeThroughSkill(skillDir, surfaces) {
  const root = path.join(skillDir, SKILL_LINK_NAME);
  const core = smokeCoreFiles(root);
  const graph = surfaces.graph.ok ? await smokeGraphFiles(root, {}) : { ok: false, reason: surfaces.graph.reason, detail: surfaces.graph.detail };
  const diagram = surfaces.diagram.ok ? await smokeDiagramFiles(root) : { ok: false, reason: surfaces.diagram.reason, detail: surfaces.diagram.detail };
  return { core, graph, diagram };
}

function smokeCoreFiles(root) {
  const capabilities = path.join(root, 'references', 'capabilities.md');
  const template = path.join(root, 'templates', 'gitignore-workflow.txt');
  try {
    const text = readFileSync(capabilities, 'utf8');
    if (!text.trim()) {
      return { ok: false, reason: 'missing-runtime', detail: 'capabilities.md is empty' };
    }
    if (existsSync(template) && readFileSync(template, 'utf8').length === 0) {
      return { ok: false, reason: 'missing-runtime', detail: 'template is empty' };
    }
    return { ok: true, reason: null, detail: null };
  } catch (error) {
    return { ok: false, reason: 'missing-package', detail: error.message };
  }
}

async function smokeGraphFiles(root, settings) {
  const plugin = path.join(root, 'vendor', 'understand-anything', 'dist', 'plugins', 'tree-sitter-plugin.js');
  if (!existsSync(plugin)) return { ok: false, reason: 'not-in-source', detail: null };
  try {
    const adapter = path.join(root, 'adapters', 'graph', 'index.js');
    if (!existsSync(adapter)) throw new Error('Prebuilt graph adapter index.js is missing.');
    await import(pathToFileURL(adapter).href);
    const resolved = resolveInstalledGraph(plugin);
    await exerciseInstalledLibraries(plugin);
    let wasmLoad = { ok: null, reason: 'node-floor' };
    if (nodeMajor() >= 22 && settings.skipWasmLoad !== true) {
      await loadInstalledGraph(plugin);
      wasmLoad = { ok: true, reason: null };
    }
    return { ok: true, reason: null, detail: null, resolved: Object.keys(resolved.resolved), wasmLoad };
  } catch (error) {
    return { ok: false, reason: 'missing-runtime', detail: error.message };
  }
}

async function smokeDiagramFiles(root) {
  const missing = DIAGRAM_FILES.filter((rel) => !existsSync(path.join(root, rel)));
  if (missing.length > 0) {
    return { ok: false, reason: missing.some((rel) => rel.startsWith('vendor/archify')) ? 'missing-runtime' : 'missing-runtime', detail: missing[0] };
  }
  try {
    const template = readFileSync(path.join(root, 'vendor', 'archify', 'assets', 'template.html'), 'utf8');
    if (!template.includes('data:font/woff2') || !template.includes('applyTemplate')) {
      return { ok: false, reason: 'missing-runtime', detail: 'template is not the patched Archify shell' };
    }
    const adapterUrl = pathToFileURL(path.join(root, 'adapters', 'diagram', 'index.mjs')).href;
    const adapter = await import(adapterUrl);
    if (adapter.supports('architecture') !== true || adapter.supports('other') !== false) {
      return { ok: false, reason: 'missing-runtime', detail: 'diagram adapter supports() mismatch' };
    }
    return { ok: true, reason: null, detail: null };
  } catch (error) {
    return { ok: false, reason: 'missing-runtime', detail: error.message };
  }
}

function readCore(base) {
  try {
    const text = readFileSync(path.join(base, 'references', 'capabilities.md'), 'utf8');
    if (!text.trim()) return { available: false, reason: 'missing-runtime' };
    return { available: true, reason: null };
  } catch (error) {
    if (error.code === 'ENOENT') return { available: false, reason: 'missing-package' };
    return { available: false, reason: 'unavailable', detail: error.message };
  }
}

async function assessDiagram(base, major) {
  if (major != null && major < 18) return { available: false, reason: 'node-floor' };
  const template = path.join(base, 'vendor', 'archify', 'assets', 'template.html');
  const renderer = path.join(base, 'vendor', 'archify', 'renderers', 'architecture', 'render-architecture.mjs');
  const adapter = path.join(base, 'adapters', 'diagram', 'index.mjs');
  if (!existsSync(template) || !existsSync(renderer) || !existsSync(adapter)) {
    return { available: false, reason: 'missing-runtime' };
  }
  const loaded = await import(pathToFileURL(adapter).href);
  if (loaded.supports('architecture') !== true) return { available: false, reason: 'missing-runtime' };
  return { available: true, reason: null };
}

function assessGraph(base, major) {
  if (major != null && major < 22) return { available: false, reason: 'node-floor' };
  const plugin = path.join(base, 'vendor', 'understand-anything', 'dist', 'plugins', 'tree-sitter-plugin.js');
  if (!existsSync(plugin)) return { available: false, reason: 'missing-runtime' };
  try {
    resolveInstalledGraph(plugin);
    return { available: true, reason: null };
  } catch {
    return { available: false, reason: 'missing-runtime' };
  }
}

function entryExists(base) {
  try {
    const stat = lstatSync(base);
    return stat.isSymbolicLink() || stat.isDirectory();
  } catch {
    return false;
  }
}

function discover(settings, links) {
  if (links.length === 0) return { ok: false, via: 'filesystem', skills: [] };
  if (!settings.register) {
    return {
      ok: true,
      via: 'filesystem',
      skills: links.map((link) => ({ name: link.skill, path: path.dirname(link.path) })),
    };
  }
  const listed = listHostSkills(settings);
  const names = new Set(links.map((link) => link.skill));
  const found = listed.filter((skill) => names.has(skill.name));
  return { ok: found.length === links.length && found.length > 0, via: 'skills-cli', skills: found };
}

function registerSkills(settings) {
  const args = ['add', path.join(settings.packageRoot, 'skills'), '-a', settings.layout.cliAgent, '-y', '--skill', '*'];
  if (settings.scope === 'global') args.push('-g');
  runSkills(args, settings);
  settings.skillsVersion = settings.skillsVersion ?? skillsVersion(settings);
}

function listHostSkills(settings) {
  const args = ['list', '-a', settings.layout.cliAgent, '--json'];
  if (settings.scope === 'global') args.push('-g');
  const output = runSkills(args, settings);
  return parseSkillsJson(output.stdout).filter((skill) => listedForHost(skill, settings));
}

function listedForHost(skill, settings) {
  const normalizeAgent = (agent) => String(agent).trim().toLowerCase().replace(/[\s_]+/g, '-');
  const agents = Array.isArray(skill.agents) ? skill.agents.map(normalizeAgent) : [];
  if (agents.length > 0 && !agents.includes(settings.layout.cliAgent)) return false;
  if (typeof skill.path !== 'string' || skill.path.length === 0) return false;
  let skillReal;
  let rootReal;
  try {
    skillReal = realpathSync(skill.path);
    rootReal = realpathSync(settings.layout.skillsDir);
  } catch {
    return false;
  }
  const rel = path.relative(rootReal, skillReal);
  return rel.length > 0 && !rel.startsWith('..') && !path.isAbsolute(rel);
}

function skillsVersion(settings) {
  try {
    const output = runSkills(['--version'], settings);
    const match = /(\d+\.\d+\.\d+)/.exec(`${output.stdout}\n${output.stderr}`);
    return match ? match[1] : output.stdout.trim();
  } catch {
    return null;
  }
}

// Exact upstream skills CLI release the installer was verified against. Bump it deliberately.
// --package stays explicit: an outer `npm exec --package` leaks npm_config_package into this npx.
export const SKILLS_CLI = 'skills@1.7.6';

function runSkills(args, settings) {
  const env = {
    ...process.env,
    DISABLE_TELEMETRY: '1',
    DO_NOT_TRACK: '1',
  };
  if (settings.home) env.HOME = settings.home;
  const result = spawnSync('npx', ['--yes', `--package=${SKILLS_CLI}`, '--', 'skills', ...args], {
    cwd: settings.layout.scopeBase,
    env,
    encoding: 'utf8',
    timeout: 120000,
    windowsHide: true,
  });
  if (result.error) throw new BootstrapError(result.error.message, 'skills-installer');
  if (result.status !== 0) {
    throw new BootstrapError(
      `skills ${args[0]} exited ${result.status}\n${result.stderr || result.stdout || ''}`.trim(),
      'skills-installer',
    );
  }
  return { stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function parseSkillsJson(stdout) {
  const start = stdout.indexOf('[');
  const end = stdout.lastIndexOf(']');
  if (start === -1 || end === -1) return [];
  const parsed = JSON.parse(stdout.slice(start, end + 1));
  return Array.isArray(parsed) ? parsed : [];
}

function packageRootFromPlugin(pluginPath) {
  return path.resolve(path.dirname(pluginPath), '..', '..', '..', '..');
}

function assertInsidePackage(packageRoot, resolved, spec) {
  const root = realpathSync(packageRoot);
  const hit = realpathSync(resolved);
  const rel = path.relative(root, hit);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new Error(`${spec} resolved outside the package image: ${hit}`);
  }
}

function readManifest(manifestPath) {
  if (!existsSync(manifestPath)) return null;
  try {
    return JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch {
    return null;
  }
}

function writeManifest(manifestPath, manifest) {
  mkdirSync(path.dirname(manifestPath), { recursive: true });
  const tmp = `${manifestPath}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(manifest, null, 2)}\n`);
  renameSync(tmp, manifestPath);
}

function cleanStaleStaging(packagesDir) {
  if (!existsSync(packagesDir)) return;
  for (const name of readdirSync(packagesDir)) {
    if (!name.startsWith('.produktiv-next-') && name !== '.produktiv-previous') continue;
    const full = path.join(packagesDir, name);
    let stat;
    try {
      stat = lstatSync(full);
    } catch {
      continue;
    }
    if (!stat.isDirectory()) continue;
    const token = path.join(full, STAGING_TOKEN_NAME);
    const marker = path.join(full, PACKAGE_MARKER_NAME);
    if (existsSync(token) || existsSync(marker)) rmSync(full, { recursive: true, force: true });
  }
}

function samePath(left, right) {
  const a = path.resolve(left);
  const b = path.resolve(right);
  if (a === b) return true;
  try {
    return realpathSync(a) === realpathSync(b);
  } catch {
    return false;
  }
}

function resolveExisting(dir) {
  const resolved = path.resolve(dir);
  if (!existsSync(resolved)) mkdirSync(resolved, { recursive: true });
  return realpathSync(resolved);
}

function printResult(value) {
  if (value.command === 'uninstall') {
    console.log(`removed ${value.removed.length}`);
    for (const item of value.refused) console.log(`refused ${item.path} ${item.reason}`);
    return;
  }
  console.log(`${value.command} ${value.ok ? 'ok' : 'failed'} ${value.host} ${value.scope}`);
  console.log(`canonical ${value.canonicalPackageRoot}`);
  console.log(`release ${value.packageVersion} ${value.releaseDigest}`);
  for (const name of ['core', 'graph', 'diagram']) {
    const surface = value.surfaces[name];
    console.log(`${name} ${surface.ok ? 'ok' : surface.reason} ${surface.bytes} bytes`);
  }
  for (const link of value.links) console.log(`link ${link.skill} ${link.target}`);
}

function printHelp() {
  console.log(`Usage: node workflow/scripts/bootstrap.mjs <install|update|uninstall|smoke> [options]

Options:
  --host cursor|codex|claude-code
  --scope project|global
  --project <dir>     Project scope base. Default: current directory
  --home <dir>        User home for the external store (and global scope)
  --store-root <dir>  Advanced override for the external immutable store
  --source <path>     Prepared release, or a development workflow/ source
  --no-register       Do not run the generic skills installer
`);
}

async function main(argv) {
  const opts = { host: 'cursor', scope: 'project', register: true };
  const command = argv[0];
  if (!command || command === '--help' || command === '-h') {
    printHelp();
    return command ? 0 : 2;
  }
  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) throw new BootstrapError(`Missing value for ${arg}`, 'usage');
      i += 1;
      return value;
    };
    if (arg === '--host') opts.host = next();
    else if (arg === '--scope') opts.scope = next();
    else if (arg === '--project') opts.project = next();
    else if (arg === '--home') opts.home = next();
    else if (arg === '--store-root') opts.storeRoot = next();
    else if (arg === '--source') opts.source = next();
    else if (arg === '--no-register') opts.register = false;
    else if (arg === '--help' || arg === '-h') {
      printHelp();
      return 0;
    } else throw new BootstrapError(`Unknown argument ${arg}`, 'usage');
  }
  if (opts.scope === 'project' && !opts.project) opts.project = process.cwd();
  if (command === 'install') {
    const value = await install(opts);
    printResult(value);
    return value.ok ? 0 : 1;
  }
  if (command === 'update') {
    const value = await update(opts);
    printResult(value);
    return value.ok ? 0 : 1;
  }
  if (command === 'uninstall') {
    const value = uninstall(opts);
    printResult(value);
    return value.ok ? 0 : 1;
  }
  if (command === 'smoke') {
    const settings = normalize(opts);
    const manifest = readManifest(settings.layout.manifestPath);
    if (!manifest?.canonicalPackageRoot) throw new BootstrapError('No installed package manifest', 'not-installed');
    settings.packageRoot = manifest.canonicalPackageRoot;
    settings.layout.packageRoot = manifest.canonicalPackageRoot;
    const skills = installedPackageSkills(settings);
    if (skills.length === 0) throw new BootstrapError('No installed skills', 'no-skill');
    const assessed = await assessSkill(skills[0].dir, { nodeAvailable: true, nodeMajor: nodeMajor() });
    console.log(JSON.stringify(assessed, null, 2));
    return assessed.core.available ? 0 : 1;
  }
  throw new BootstrapError(`Unknown command ${command}`, 'usage');
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  main(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      console.error(error.message);
      process.exitCode = error.code === 'usage' || error.code === 'host' || error.code === 'scope' ? 2 : 1;
    });
}
