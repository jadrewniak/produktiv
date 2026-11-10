/**
 * Prebuilt package image for the thin bootstrap.
 *
 * The generic Skills installer copies SKILL.md only. This module builds the
 * other delivery surface from workflow/: shared files, a minimal Understand
 * Anything runtime, and the Archify delivery files. It does not install
 * packages, clone upstream, or copy evals/ or .upstream/.
 */

import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

export const STAGING_TOKEN_NAME = '.produktiv-staging';
export const PACKAGE_MARKER_NAME = '.produktiv-package.json';
export const PACKAGE_KIND = 'produktiv-package';
export const RELEASE_RECEIPT_NAME = '.produktiv-release.json';
export const RELEASE_KIND = 'produktiv-release';
export const RELEASE_SCHEMA_VERSION = 2;

export const GRAPH_RESOLVE_SPECS = Object.freeze([
  'web-tree-sitter',
  'web-tree-sitter/web-tree-sitter.wasm',
  'tree-sitter-typescript/tree-sitter-typescript.wasm',
  'tree-sitter-typescript/tree-sitter-tsx.wasm',
  'tree-sitter-javascript/tree-sitter-javascript.wasm',
  'tree-sitter-python/tree-sitter-python.wasm',
  'tree-sitter-go/tree-sitter-go.wasm',
  'tree-sitter-rust/tree-sitter-rust.wasm',
  'tree-sitter-java/tree-sitter-java.wasm',
  'tree-sitter-ruby/tree-sitter-ruby.wasm',
  'tree-sitter-php/tree-sitter-php.wasm',
  'tree-sitter-cpp/tree-sitter-cpp.wasm',
  'tree-sitter-c-sharp/tree-sitter-c_sharp.wasm',
  'tree-sitter-scala/tree-sitter-scala.wasm',
  '@tree-sitter-grammars/tree-sitter-kotlin/tree-sitter-kotlin.wasm',
  '@understand-anything/tree-sitter-swift-wasm/tree-sitter-swift.wasm',
  '@understand-anything/tree-sitter-dart-wasm/tree-sitter-dart.wasm',
]);

const UA_SCRIPTS = Object.freeze([
  'extract-structure-result.mjs',
  'extract-structure.mjs',
  'extract-import-map.mjs',
  'scan-project.mjs',
  'prepare-incremental.mjs',
  'finalize-incremental.mjs',
  'validate-incremental-symbols.mjs',
  'head-source.mjs',
]);

const FILE_DEPENDENCIES = Object.freeze([
  ['@understand-anything/tree-sitter-swift-wasm', 'tree-sitter-swift-wasm'],
  ['@understand-anything/tree-sitter-dart-wasm', 'tree-sitter-dart-wasm'],
]);

const GRAPH_PREFIXES = ['vendor/understand-anything/', 'graph/', 'adapters/graph/'];
const DIAGRAM_PREFIXES = ['vendor/archify/', 'adapters/diagram/'];

const DIAGRAM_FILES = Object.freeze([
  'LICENSE',
  'assets/template.html',
  'assets/JetBrainsMono-OFL.txt',
  'delta/architecture-delta.mjs',
  'scripts/check-render-output.mjs',
]);

export function readPackageVersion(source) {
  const pkgPath = path.join(source, 'package.json');
  if (!existsSync(pkgPath)) return '0.0.0';
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  return typeof pkg.version === 'string' && pkg.version.length > 0 ? pkg.version : '0.0.0';
}

export function sourceHasGraph(source) {
  return existsSync(
    path.join(source, 'vendor', 'understand-anything', 'dist', 'plugins', 'tree-sitter-plugin.js'),
  );
}

export function sourceHasDiagram(source) {
  return (
    existsSync(path.join(source, 'vendor', 'archify', 'assets', 'template.html')) &&
    existsSync(path.join(source, 'adapters', 'diagram', 'index.mjs'))
  );
}

export function treeBytes(root) {
  if (!existsSync(root)) return 0;
  let bytes = 0;
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    const stat = lstatSync(current);
    if (stat.isSymbolicLink()) {
      bytes += stat.size;
      continue;
    }
    if (stat.isDirectory()) {
      for (const name of readdirSync(current)) stack.push(path.join(current, name));
      continue;
    }
    bytes += stat.size;
  }
  return bytes;
}

export function measureSurfaces(root) {
  return {
    core: bytesUnder(root, ['package.json', PACKAGE_MARKER_NAME, 'references', 'templates', 'adapters/host']),
    graph: bytesUnder(root, ['vendor/understand-anything', 'graph', 'adapters/graph']),
    diagram: bytesUnder(root, ['vendor/archify', 'adapters/diagram']),
  };
}

export function findDeliveryBaggage(root) {
  const hits = [];
  if (!existsSync(root)) return hits;
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    const stat = lstatSync(current);
    if (stat.isSymbolicLink()) continue;
    const rel = path.relative(root, current).split(path.sep).join('/');
    const name = path.basename(current);
    if (stat.isDirectory()) {
      if (isRejectedDir(rel, name)) hits.push(rel);
      for (const child of readdirSync(current)) stack.push(path.join(current, child));
      continue;
    }
    if (isRejectedFile(rel, name)) hits.push(rel);
  }
  return hits;
}

/**
 * Build a package image in dest. Optional surfaces that cannot be built are
 * omitted; a missing core reference fails the build.
 */
export function buildPackageImage({ source, dest, packageVersion }) {
  mkdirSync(dest, { recursive: true });
  writeFileSync(path.join(dest, STAGING_TOKEN_NAME), 'produktiv\n');
  copyCore(source, dest);

  const diagram = trySurface(dest, DIAGRAM_ROOTS, () => {
    if (!sourceHasDiagram(source)) {
      const error = new Error('not-in-source');
      error.code = 'not-in-source';
      throw error;
    }
    copyDiagram(source, dest);
  });
  const graph = trySurface(dest, GRAPH_ROOTS, () => {
    if (!sourceHasGraph(source)) {
      const error = new Error('not-in-source');
      error.code = 'not-in-source';
      throw error;
    }
    copyGraph(source, dest);
  });

  const version = packageVersion ?? readPackageVersion(source);
  writeJson(path.join(dest, 'package.json'), {
    name: 'produktiv-workflow',
    private: true,
    version,
    type: 'module',
    description:
      'Installed Produktiv package image. Shared workflow files plus the optional graph and diagram runtimes that built.',
  });
  writeJson(path.join(dest, PACKAGE_MARKER_NAME), {
    kind: PACKAGE_KIND,
    markerVersion: 2,
    packageVersion: version,
  });

  const baggage = findDeliveryBaggage(dest);
  const graphHits = baggage.filter((rel) => isGraphRel(rel));
  const diagramHits = baggage.filter((rel) => isDiagramRel(rel));
  const coreHits = baggage.filter((rel) => !isGraphRel(rel) && !isDiagramRel(rel));
  if (coreHits.length > 0) {
    throw new Error(`Core image contains rejected files: ${coreHits.join(', ')}`);
  }
  if (graph.ok && graphHits.length > 0) {
    removeRel(dest, GRAPH_ROOTS);
    graph.ok = false;
    graph.reason = 'rejected-files';
    graph.detail = graphHits.join(', ');
  }
  if (diagram.ok && diagramHits.length > 0) {
    removeRel(dest, DIAGRAM_ROOTS);
    diagram.ok = false;
    diagram.reason = 'rejected-files';
    diagram.detail = diagramHits.join(', ');
  }

  const bytes = measureSurfaces(dest);
  return {
    packageVersion: version,
    surfaces: {
      core: { ok: true, bytes: bytes.core, reason: null, detail: null },
      graph: { ...graph, bytes: graph.ok ? bytes.graph : 0 },
      diagram: { ...diagram, bytes: diagram.ok ? bytes.diagram : 0 },
    },
    entries: topLevelEntries(dest),
  };
}

export function sealPackage(dest) {
  rmSync(path.join(dest, STAGING_TOKEN_NAME), { force: true });
}

export function readMarker(dest) {
  const markerPath = path.join(dest, PACKAGE_MARKER_NAME);
  if (!existsSync(markerPath)) return null;
  try {
    const marker = JSON.parse(readFileSync(markerPath, 'utf8'));
    if (marker.kind !== PACKAGE_KIND || typeof marker.packageVersion !== 'string') return null;
    return marker;
  } catch {
    return null;
  }
}

export function activeAgentResources(source) {
  const found = new Set();
  const scanned = new Set();
  const queue = [];
  const roots = ['skills', 'references', 'policies'];
  for (const rel of roots) {
    const root = path.join(source, rel);
    if (!existsSync(root)) continue;
    walkFiles(root, (name) => name.endsWith('.md'), queue);
  }
  while (queue.length > 0) {
    const file = queue.shift();
    if (scanned.has(file)) continue;
    scanned.add(file);
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/agents\/[a-z0-9/-]+\/v[0-9]+\.md/g)) {
      const resource = match[0].split(path.sep).join('/');
      const absolute = path.resolve(source, resource);
      const relative = path.relative(path.resolve(source), absolute);
      if (relative.startsWith('..') || path.isAbsolute(relative) || !existsSync(absolute)) {
        throw new Error(`Active agent resource is missing or escapes the package: ${resource}`);
      }
      if (!found.has(resource)) {
        found.add(resource);
        queue.push(absolute);
      }
    }
  }
  return [...found].sort();
}

// Reviewer criteria older installs may hold beside the current package. Install
// removes such a legacy root only when every file matches the release inventory
// or this list. Frozen, because the source tree keeps only active versions.
export const LEGACY_AGENT_INVENTORY = Object.freeze([
  ['code-review/v1.md', 5823, '0fbaa73c7672bf769048210b6db51d36bbe8b03eb07f050ff4184a24e5c986af'],
  ['code-review/v2.md', 5852, '627e158a6b0e7979545b13070dea83f03a679624a37f641bfc96275087beba80'],
  ['code-review/v3.md', 6134, '8be343897bf848acfa9dae94869e356ea8388f734782ebd9266fd4c1632f3adc'],
  ['completion-review/v1.md', 3752, '7817896bd83734e6874365e76ff47ec91888664d98f5c32f08674816c7fd2b00'],
  ['completion-review/v2.md', 4063, '333b58a286992102f91fecfd2c0499e1e4ad186a2a30329b33935dd83dae32bd'],
  ['completion-review/v3.md', 4181, 'e0b04cbbc80094647030fd64e83bd9366b1c792fa570a3d3ceea178ac36db47f'],
  ['completion-review/v4.md', 4937, '00bbfd46b474dff9f05f487b0664a02283438a0c7c46bade91d9604da6842703'],
  ['plan-review/v1.md', 23052, '2912918192923ffcaccec7e1e1d45fa805a98b9697987e1dc861819d62f737b3'],
  ['plan-review/v2.md', 24028, 'd68995df20a88c54e7a18aa9ecf9b2b5ce073c24a2b0e6debe926edca04f47f3'],
  ['plan-review/v3.md', 9561, '525b066dc4c9cef15969b676ed23e7f9508d3217a8a6eab7f82554826457bbd1'],
  ['plan-review/v4.md', 10590, '7bfae6eab38f639dffdfbb771d43fe6dd612b5f272e2578658a09942567ec7e3'],
  ['plan-review/v5.md', 5982, 'fede90b5a4c02f1fc7fe1402f03999136b4741a98978fc899b9c81391b388aba'],
  ['plan-review/v6.md', 6230, '7b5a1be3ddd9ab9f2060ac2d8ecdda9bda6ea96415625aba2314308596c9c926'],
  ['plan-review/v7.md', 6862, '49ee678c20d38872c2b8c2d8b29ba37b38e3142776524db6cf059802a535e469'],
  ['researcher/v1.md', 3259, 'a7ebf9d96ff563268510310606ac162796ccf1494246d67f02b3e987c2bae2b2'],
  ['simplicity-review/v1.md', 5457, '0c739e6472c8506af7f1b8f055475bb4b1ecb0413a202c0b2f545cbd20b076e1'],
  ['simplicity-review/v2.md', 3815, '7b9807901a5ed60e88955ebfd6fbc1d301442411a2adba97641718f5058f4360'],
  ['simplicity-review/v3.md', 3784, 'ffcfae316e6d432e2c73dde28d3a4bc5204b94d876d068432596e8ce94a6df7c'],
  ['specialists/dependencies/v1.md', 4522, '46fce670db9645046a7154956ef4fb164deaf19f9d25e85b2e8c10b1cf9e9a0b'],
  ['specialists/performance/v1.md', 4157, '9bd0344ec2fdec322afe8baaf108cb5a1c430f3460dcce9124e62a46cd7564b7'],
  ['specialists/security/v1.md', 3955, 'eda1f3ddb3a14535bef9e94bbc53014360015b48b55d33bd684a1864c5ca3bdc'],
].map(([rel, bytes, sha256]) => Object.freeze({ path: `agents/${rel}`, bytes, sha256 })));

export function historicalAgentInventory() {
  return LEGACY_AGENT_INVENTORY.map((entry) => ({ ...entry }));
}

export function releaseInventory(root) {
  root = path.resolve(root);
  const inventory = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    const stat = lstatSync(current);
    const rel = path.relative(root, current).split(path.sep).join('/');
    if (rel === RELEASE_RECEIPT_NAME || rel === STAGING_TOKEN_NAME) continue;
    if (stat.isSymbolicLink()) {
      const target = readlinkSync(current);
      const resolved = path.resolve(path.dirname(current), target);
      const inside = path.relative(root, resolved);
      if (!inside || inside.startsWith('..') || path.isAbsolute(inside)) {
        throw new Error(`Release symlink escapes its root: ${rel} -> ${target}`);
      }
      inventory.push({ path: rel, type: 'symlink', target });
      continue;
    }
    if (stat.isDirectory()) {
      for (const name of readdirSync(current).sort().reverse()) stack.push(path.join(current, name));
      continue;
    }
    if (!stat.isFile()) throw new Error(`Unsupported release entry: ${rel}`);
    const bytes = readFileSync(current);
    inventory.push({
      path: rel,
      type: 'file',
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
  }
  return inventory.sort((left, right) => left.path.localeCompare(right.path));
}

export function releaseDigest(payload) {
  return createHash('sha256').update(`${JSON.stringify(payload)}\n`).digest('hex');
}

export function finalizeRelease(root, metadata = {}) {
  root = path.resolve(root);
  sealPackage(root);
  const version = metadata.version ?? readPackageVersion(root);
  assertSafeReleaseVersion(version);
  const inventory = releaseInventory(root);
  const payload = releasePayload(root, inventory, {
    kind: RELEASE_KIND,
    schemaVersion: RELEASE_SCHEMA_VERSION,
    version,
    digestAlgorithm: 'sha256',
    skills: metadata.skills ?? listNamedDirectories(path.join(root, 'skills')),
    activeAgentResources: metadata.activeAgentResources ?? activeAgentResources(root),
    legacyAgentInventory: metadata.legacyAgentInventory ?? [],
    surfaces: metadata.surfaces ?? [],
    grammarSpecs: metadata.grammarSpecs ?? 0,
  });
  const receipt = { ...payload, digest: releaseDigest(payload) };
  writeJson(path.join(root, RELEASE_RECEIPT_NAME), receipt);
  return receipt;
}

export function verifyRelease(root, expected = {}) {
  root = path.resolve(root);
  const receiptPath = path.join(root, RELEASE_RECEIPT_NAME);
  if (!existsSync(receiptPath)) throw new Error(`Release receipt is missing: ${receiptPath}`);
  const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
  if (receipt.kind !== RELEASE_KIND || receipt.schemaVersion !== RELEASE_SCHEMA_VERSION) {
    throw new Error('Unsupported Produktiv release receipt.');
  }
  if (receipt.digestAlgorithm !== 'sha256') throw new Error('Unsupported release digest algorithm.');
  assertSafeReleaseVersion(receipt.version);
  if (!/^[a-f0-9]{64}$/.test(receipt.digest)) throw new Error('Release digest is invalid.');
  const inventory = releaseInventory(root);
  const payload = releasePayload(root, inventory, receipt);
  const digest = releaseDigest(payload);
  if (digest !== receipt.digest || JSON.stringify(inventory) !== JSON.stringify(receipt.inventory)) {
    throw new Error(`Release inventory mismatch: expected ${receipt.digest}, got ${digest}`);
  }
  if (expected.version && expected.version !== receipt.version) {
    throw new Error(`Release version mismatch: expected ${expected.version}, got ${receipt.version}`);
  }
  if (expected.digest && expected.digest !== receipt.digest) {
    throw new Error(`Release digest mismatch: expected ${expected.digest}, got ${receipt.digest}`);
  }
  return receipt;
}

function releasePayload(root, inventory, metadata) {
  const skills = sortedStrings(metadata.skills, 'skills');
  const active = sortedStrings(metadata.activeAgentResources, 'activeAgentResources');
  const surfaces = sortedStrings(metadata.surfaces, 'surfaces');
  const legacy = normalizeLegacyInventory(metadata.legacyAgentInventory);
  const grammarSpecs = Number(metadata.grammarSpecs ?? 0);
  if (!Number.isSafeInteger(grammarSpecs) || grammarSpecs < 0) {
    throw new Error('Release grammarSpecs is invalid.');
  }
  const actualSkills = listNamedDirectories(path.join(root, 'skills'));
  if (JSON.stringify(skills) !== JSON.stringify(actualSkills)) {
    throw new Error('Release skills metadata does not match the shipped inventory.');
  }
  const actualActive = inventory
    .filter((entry) => entry.type === 'file' && entry.path.startsWith('agents/'))
    .map((entry) => entry.path)
    .sort();
  if (JSON.stringify(active) !== JSON.stringify(actualActive)) {
    throw new Error('Release active-agent metadata does not match the shipped inventory.');
  }
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  const marker = readMarker(root);
  if (pkg.name !== 'produktiv-workflow' || pkg.version !== metadata.version ||
      marker?.markerVersion !== 2 || marker.packageVersion !== metadata.version) {
    throw new Error('Release version metadata does not match package bytes.');
  }
  return {
    kind: RELEASE_KIND,
    schemaVersion: RELEASE_SCHEMA_VERSION,
    version: metadata.version,
    digestAlgorithm: 'sha256',
    skills,
    activeAgentResources: active,
    legacyAgentInventory: legacy,
    surfaces,
    grammarSpecs,
    inventory,
  };
}

function sortedStrings(value, field) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || entry.length === 0)) {
    throw new Error(`Release ${field} metadata is invalid.`);
  }
  const sorted = [...new Set(value)].sort();
  if (sorted.length !== value.length) throw new Error(`Release ${field} metadata contains duplicates.`);
  return sorted;
}

function normalizeLegacyInventory(value) {
  if (!Array.isArray(value)) throw new Error('Release legacyAgentInventory metadata is invalid.');
  const normalized = value.map((entry) => {
    if (!entry || typeof entry !== 'object' ||
        !/^agents\/[a-z0-9/-]+\/v[0-9]+\.md$/.test(entry.path) ||
        !Number.isSafeInteger(entry.bytes) || entry.bytes < 0 ||
        !/^[a-f0-9]{64}$/.test(entry.sha256)) {
      throw new Error('Release legacyAgentInventory entry is invalid.');
    }
    return { path: entry.path, bytes: entry.bytes, sha256: entry.sha256 };
  }).sort((left, right) => left.path.localeCompare(right.path));
  if (new Set(normalized.map((entry) => entry.path)).size !== normalized.length) {
    throw new Error('Release legacyAgentInventory contains duplicate paths.');
  }
  return normalized;
}

export function assertSafeReleaseVersion(version) {
  if (typeof version !== 'string' || version === '.' || version === '..' ||
      !/^[A-Za-z0-9][A-Za-z0-9._+-]*$/.test(version)) {
    throw new Error(`Unsafe release version: ${String(version)}`);
  }
}

const GRAPH_ROOTS = ['vendor/understand-anything', 'graph', 'adapters/graph'];
const DIAGRAM_ROOTS = ['vendor/archify', 'adapters/diagram'];

function trySurface(dest, roots, copy) {
  try {
    copy();
    return { ok: true, reason: null, detail: null };
  } catch (error) {
    removeRel(dest, roots);
    return {
      ok: false,
      reason: error.code === 'not-in-source' ? 'not-in-source' : 'missing-runtime',
      detail: error.code === 'not-in-source' ? null : error.message,
    };
  }
}

function copyCore(source, dest) {
  copyRelFile(source, dest, 'README.md');
  if (existsSync(path.join(source, 'LICENSE'))) copyRelFile(source, dest, 'LICENSE');
  const capabilities = path.join(source, 'references', 'capabilities.md');
  if (!existsSync(capabilities)) {
    throw new Error('Package source is missing references/capabilities.md');
  }
  copyTree(path.join(source, 'references'), path.join(dest, 'references'), () => true);
  const templates = path.join(source, 'templates');
  if (existsSync(templates)) copyTree(templates, path.join(dest, 'templates'), () => true);
  copyTree(path.join(source, 'adapters', 'host'), path.join(dest, 'adapters', 'host'), (name) =>
    name.endsWith('.mjs'),
  );
  copyTree(path.join(source, 'policies'), path.join(dest, 'policies'), (name) => name !== '.gitkeep');
  for (const resource of activeAgentResources(source)) copyRelFile(source, dest, resource);
}

function copyDiagram(source, dest) {
  const srcRoot = path.join(source, 'vendor', 'archify');
  const destRoot = path.join(dest, 'vendor', 'archify');
  for (const rel of DIAGRAM_FILES) copyRelFile(srcRoot, destRoot, rel);
  copyTree(path.join(srcRoot, 'schemas'), path.join(destRoot, 'schemas'), (name) => name.endsWith('.json'));
  copyTree(path.join(srcRoot, 'renderers'), path.join(destRoot, 'renderers'), (name) => name.endsWith('.mjs'));
  copyRelFile(source, dest, path.join('adapters', 'diagram', 'index.mjs'));
}

function copyGraph(source, dest) {
  const srcUa = path.join(source, 'vendor', 'understand-anything');
  const destUa = path.join(dest, 'vendor', 'understand-anything');
  copyTree(path.join(srcUa, 'dist'), path.join(destUa, 'dist'), (name, full) => {
    if (!name.endsWith('.js')) return false;
    if (name.endsWith('.test.js')) return false;
    return !full.includes(`${path.sep}__tests__${path.sep}`);
  });
  for (const script of UA_SCRIPTS) {
    copyRelFile(path.join(srcUa, 'scripts'), path.join(destUa, 'scripts'), script);
  }
  for (const license of ['LICENSE', 'THIRD-PARTY']) copyRelFile(srcUa, destUa, license);
  copyWasmPackages(srcUa, destUa);
  copyRuntimeModules(srcUa, destUa);
  writeJson(path.join(destUa, 'package.json'), {
    name: '@produktiv/understand-anything',
    private: true,
    version: readJsonVersion(path.join(srcUa, 'package.json')),
    type: 'module',
    description: 'Prebuilt structural graph runtime. Grammar resolution uses the node_modules in this directory.',
  });
  copyTree(path.join(source, 'graph'), path.join(dest, 'graph'), (name) => name.endsWith('.ts') || name.endsWith('.js'));
  copyTree(path.join(source, 'adapters', 'graph'), path.join(dest, 'adapters', 'graph'), (name) =>
    name.endsWith('.ts') || name.endsWith('.js'),
  );
}

function copyWasmPackages(srcUa, destUa) {
  const wasmRoot = path.join(srcUa, 'wasm');
  for (const entry of readdirSync(wasmRoot)) {
    const src = path.join(wasmRoot, entry);
    if (!lstatSync(src).isDirectory()) continue;
    copyTree(src, path.join(destUa, 'wasm', entry), (name) => {
      if (name === 'package.json' || name === 'LICENSE') return true;
      return name.endsWith('.wasm');
    });
  }
}

function copyRuntimeModules(srcUa, destUa) {
  const plugin = path.join(srcUa, 'dist', 'plugins', 'tree-sitter-plugin.js');
  const require = createRequire(plugin);
  const destNm = path.join(destUa, 'node_modules');
  mkdirSync(destNm, { recursive: true });

  const byPackage = new Map();
  for (const spec of GRAPH_RESOLVE_SPECS) {
    if (spec === 'web-tree-sitter' || spec.startsWith('web-tree-sitter/')) continue;
    const { name, file } = splitPackageSpec(spec);
    if (!file) continue;
    const files = byPackage.get(name) ?? [];
    files.push(file);
    byPackage.set(name, files);
  }

  for (const [name, files] of byPackage) {
    const linked = FILE_DEPENDENCIES.find((item) => item[0] === name);
    if (linked) {
      linkFileDependency(destUa, name, linked[1]);
      continue;
    }
    const sample = require.resolve(`${name}/${files[0]}`);
    const pkgRoot = packageRootOf(sample, name);
    const pkg = JSON.parse(readFileSync(path.join(pkgRoot, 'package.json'), 'utf8'));
    const destPkg = path.join(destNm, ...name.split('/'));
    mkdirSync(destPkg, { recursive: true });
    writeJson(path.join(destPkg, 'package.json'), {
      name: pkg.name,
      version: pkg.version,
    });
    for (const file of files) {
      copyFileSync(require.resolve(`${name}/${file}`), path.join(destPkg, file));
    }
  }

  copyWebTreeSitter(require, destNm);
  copyLibrary(require, destNm, 'ignore', {
    entry: 'index.js',
    packageJson(pkg) {
      return { name: pkg.name, version: pkg.version, main: 'index.js' };
    },
  });
  copyLibrary(require, destNm, 'yaml', {
    entry: 'dist/index.js',
    packageJson(pkg) {
      return {
        name: pkg.name,
        version: pkg.version,
        type: 'commonjs',
        main: './dist/index.js',
        exports: { '.': { node: './dist/index.js', default: './dist/index.js' } },
      };
    },
  });
  copyLibrary(require, destNm, 'zod', {
    entry: 'index.js',
    packageJson(pkg) {
      return {
        name: pkg.name,
        version: pkg.version,
        type: 'module',
        exports: { '.': { import: './index.js', default: './index.js' } },
      };
    },
  });
}

function linkFileDependency(destUa, packageName, wasmDirName) {
  const link = path.join(destUa, 'node_modules', ...packageName.split('/'));
  const target = path.join(destUa, 'wasm', wasmDirName);
  mkdirSync(path.dirname(link), { recursive: true });
  symlinkSync(path.relative(path.dirname(link), target), link);
}

function copyWebTreeSitter(require, destNm) {
  const entry = require.resolve('web-tree-sitter');
  const pkgRoot = packageRootOf(entry, 'web-tree-sitter');
  const pkg = JSON.parse(readFileSync(path.join(pkgRoot, 'package.json'), 'utf8'));
  const dest = path.join(destNm, 'web-tree-sitter');
  mkdirSync(dest, { recursive: true });
  copyFileSync(path.join(pkgRoot, 'web-tree-sitter.js'), path.join(dest, 'web-tree-sitter.js'));
  copyFileSync(path.join(pkgRoot, 'web-tree-sitter.wasm'), path.join(dest, 'web-tree-sitter.wasm'));
  copyLicense(pkgRoot, dest);
  writeJson(path.join(dest, 'package.json'), {
    name: pkg.name,
    version: pkg.version,
    type: 'module',
    exports: {
      '.': {
        import: './web-tree-sitter.js',
        require: './web-tree-sitter.js',
        default: './web-tree-sitter.js',
      },
      './web-tree-sitter.wasm': './web-tree-sitter.wasm',
    },
  });
}

function copyLibrary(require, destNm, name, spec) {
  const entry = require.resolve(name);
  const pkgRoot = packageRootOf(entry, name);
  const pkg = JSON.parse(readFileSync(path.join(pkgRoot, 'package.json'), 'utf8'));
  const absoluteEntry = path.join(pkgRoot, spec.entry);
  const files = collectLocalFiles(absoluteEntry);
  const dest = path.join(destNm, name);
  for (const file of files) {
    const rel = path.relative(pkgRoot, file);
    const target = path.join(dest, rel);
    mkdirSync(path.dirname(target), { recursive: true });
    copyFileSync(file, target);
  }
  copyLicense(pkgRoot, dest);
  writeJson(path.join(dest, 'package.json'), spec.packageJson(pkg));
}

export function collectLocalFiles(entry) {
  const seen = new Set();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    const text = stripComments(readFileSync(file, 'utf8'));
    for (const spec of localSpecifiers(text)) {
      queue.push(resolveLocal(file, spec));
    }
  }
  return [...seen];
}

function localSpecifiers(text) {
  const specs = new Set();
  const patterns = [
    /\bfrom\s*["'](\.[^"']+)["']/g,
    /\bimport\s*["'](\.[^"']+)["']/g,
    /\brequire\(\s*["'](\.[^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) specs.add(match[1]);
  }
  return [...specs];
}

function resolveLocal(fromFile, spec) {
  const base = path.resolve(path.dirname(fromFile), spec);
  const candidates = [
    base,
    `${base}.js`,
    `${base}.cjs`,
    `${base}.mjs`,
    path.join(base, 'index.js'),
    path.join(base, 'index.cjs'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  throw new Error(`Unresolved ${spec} from ${fromFile}`);
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function packageRootOf(resolvedFile, name) {
  let dir = path.dirname(resolvedFile);
  const needle = `${path.sep}${name.split('/').pop()}`;
  while (dir !== path.dirname(dir)) {
    const pkgPath = path.join(dir, 'package.json');
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
        if (pkg.name === name || dir.endsWith(needle)) return dir;
      } catch {
        // Keep walking. A nested file is not this package.
      }
    }
    dir = path.dirname(dir);
  }
  throw new Error(`No package root for ${name} at ${resolvedFile}`);
}

function splitPackageSpec(spec) {
  if (spec.startsWith('@')) {
    const parts = spec.split('/');
    return { name: `${parts[0]}/${parts[1]}`, file: parts.slice(2).join('/') };
  }
  const slash = spec.indexOf('/');
  if (slash === -1) return { name: spec, file: '' };
  return { name: spec.slice(0, slash), file: spec.slice(slash + 1) };
}

function copyLicense(src, dest) {
  for (const name of ['LICENSE', 'LICENSE.md', 'LICENSE-MIT']) {
    const file = path.join(src, name);
    if (existsSync(file) && statSync(file).isFile()) copyFileSync(file, path.join(dest, name));
  }
}

function copyTree(src, dest, predicate) {
  if (!existsSync(src)) return;
  const files = [];
  walkFiles(src, predicate, files);
  for (const file of files) {
    const target = path.join(dest, path.relative(src, file));
    mkdirSync(path.dirname(target), { recursive: true });
    copyFileSync(file, target);
  }
}

function walkFiles(dir, predicate, out) {
  for (const name of readdirSync(dir)) {
    if (name === '.DS_Store' || name === '.gitkeep') continue;
    const full = path.join(dir, name);
    const stat = lstatSync(full);
    if (stat.isSymbolicLink()) continue;
    if (stat.isDirectory()) {
      if (name === 'node_modules' || name === '.git') continue;
      walkFiles(full, predicate, out);
      continue;
    }
    if (predicate(name, full)) out.push(full);
  }
}

function copyRelFile(srcRoot, destRoot, rel) {
  const src = path.join(srcRoot, rel);
  if (!existsSync(src)) throw new Error(`Missing ${src}`);
  const dest = path.join(destRoot, rel);
  mkdirSync(path.dirname(dest), { recursive: true });
  copyFileSync(src, dest);
}

function removeRel(root, rels) {
  for (const rel of rels) rmSync(path.join(root, rel), { recursive: true, force: true });
}

function bytesUnder(root, rels) {
  let bytes = 0;
  for (const rel of rels) bytes += treeBytes(path.join(root, rel));
  return bytes;
}

function topLevelEntries(root) {
  return readdirSync(root).filter((name) => name !== STAGING_TOKEN_NAME).sort();
}

function listNamedDirectories(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .filter((name) => {
      try { return lstatSync(path.join(root, name)).isDirectory(); } catch { return false; }
    })
    .sort();
}

function writeJson(file, value) {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function readJsonVersion(file) {
  if (!existsSync(file)) return '0.0.0';
  const pkg = JSON.parse(readFileSync(file, 'utf8'));
  return typeof pkg.version === 'string' ? pkg.version : '0.0.0';
}

function isGraphRel(rel) {
  return GRAPH_PREFIXES.some((prefix) => rel === prefix.slice(0, -1) || rel.startsWith(prefix));
}

function isDiagramRel(rel) {
  return DIAGRAM_PREFIXES.some((prefix) => rel === prefix.slice(0, -1) || rel.startsWith(prefix));
}

function isRejectedDir(rel, name) {
  if (name === 'prebuilds' || name === '__tests__' || name === '.upstream' || name === 'evals') return true;
  if (name === 'viewer' || name === 'website' || name === 'bin') return rel.startsWith('vendor/archify/');
  if (name === 'node_modules' && rel !== 'vendor/understand-anything/node_modules') return true;
  if (rel === 'vendor/understand-anything/core') return true;
  return false;
}

function isRejectedFile(rel, name) {
  if (name.endsWith('.node') || name.endsWith('.map')) return true;
  if (name === 'generated-brand-marks.mjs' || name === 'check-update.mjs') return true;
  if (name === 'BUILD.md' || name === '.swift-grammar-pin') return true;
  if (rel === 'vendor/understand-anything/tsconfig.json') return true;
  if (rel === 'vendor/understand-anything/BUNDLE.md') return true;
  return false;
}
