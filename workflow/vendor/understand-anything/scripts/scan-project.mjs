#!/usr/bin/env node
/**
 * ADAPT of Understand Anything 6df3065f1d8ddc2ce3615314d1d493f36d6b1c80.
 * Frozen reason: persistent inventory is `git ls-tree HEAD`, blob bytes come
 * from `git show`, and there is no `git ls-files -o` or directory walk.
 * v1 also ignores `.workflow/`, `.ua/`, `.understand-anything/`, `.env`
 * (except `.env.example`), and secret-shaped filenames.
 */
/**
 * scan-project.mjs
 *
 * Deterministic file enumeration + language/category detection for the
 * project-scanner agent. Replaces the LLM-written prose scanner that used to
 * (a) author a per-run Node.js script (`tmp/ua-project-scan.js`), (b) walk the
 * file tree, and (c) classify each file via lookup tables in LLM context — a
 * pure rule-lookup pass that was being billed at LLM rates and adding many
 * minutes of per-run latency on mid-sized monorepos.
 *
 * What the LLM still owns (Step A of project-scanner.md Phase 1):
 *   - Reading README + top-level manifests to synthesize `name`,
 *     `rawDescription`, `readmeHead`, `frameworks`, and the high-level
 *     `languages` narrative.
 *
 * What this script owns:
 *   - File enumeration (`git ls-tree HEAD` only; Git failure is a hard stop)
 *   - `.understandignore` and CLI exclusion filtering (delegated to core's
 *     createIgnoreFilter, which reads the resolved data dir — `.ua/`, or
 *     legacy `.understand-anything/` when that directory already exists)
 *   - Per-file language detection (extension + filename table)
 *   - Per-file category assignment (priority-ordered rules from
 *     project-scanner.md Step 4)
 *   - Line counting
 *   - Complexity estimation (project-scanner.md Step 7 thresholds)
 *
 * Usage:
 *   node scan-project.mjs <projectRoot> <outputPath>
 *     [--exclude <patterns>] [--exclude-analysis-data]
 *
 *   --exclude <patterns>  Comma-separated gitignore-style patterns to
 *                         additionally exclude from the scan.
 *   --exclude-analysis-data  Always exclude persistent `.ua/` and legacy
 *                            `.understand-anything/` analysis data.
 *
 * Output JSON (subset of what project-scanner.md Phase 1 expects — the LLM
 * agent merges this with Step A's narrative fields and Step C's importMap to
 * produce the final scan-result.json):
 *   {
 *     "scriptCompleted": true,
 *     "contentDigest": "<sha256 lowercase hex>",
 *     "files": [{ "path": "...", "language": "...", "sizeLines": N, "fileCategory": "..." }, ...],
 *     "totalFiles": N,
 *     "filteredByIgnore": M,
 *     "estimatedComplexity": "small" | "moderate" | "large" | "very-large",
 *     "stats": { "filesScanned": N, "byCategory": {...}, "byLanguage": {...} }
 *   }
 *
 * Logging: stderr only (stdout reserved for piped tooling).
 * Per-file resilience: read/stat failures emit
 *   `Warning: scan-project: <path> — <reason> — file skipped from output`
 * to stderr and the file is dropped; the rest of the scan completes.
 *
 * Determinism: files are sorted by a locale-independent UTF-16 code-unit
 * comparison before emission. The content digest uses that same order and
 * length-frames each UTF-8 relative path plus its raw file bytes.
 */

import { createHash } from 'node:crypto';
import { join, basename, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  existsSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';

import {
  V1_IGNORE_PATTERNS,
  committedInventory,
  loadCore,
  readHeadBlob,
} from './head-source.mjs';

const { createIgnoreFilter } = await loadCore();

// ---------------------------------------------------------------------------
// Language detection
//
// Mirrors the canonical extension list from
// understand-anything-plugin/packages/core/src/languages/configs/* and the
// project-scanner.md Step 3 table. Extensions are matched lowercase;
// filenames (Dockerfile, Makefile, etc.) are matched case-sensitively because
// the projects-in-the-wild use canonical capitalizations.
//
// Where the core configs and project-scanner.md diverge (rare), project-
// scanner.md wins because it is the user-facing contract.
// ---------------------------------------------------------------------------

/**
 * Extension -> language id. Lowercase keys; lookup is `.ext.toLowerCase()`.
 * Includes the legacy Step-3 mapping (.cfg/.ini/.env -> `config`) — note
 * that `config` is a language id here, not a category. Category routing
 * for these extensions is handled separately in CATEGORY_BY_EXT.
 */
const LANGUAGE_BY_EXT = Object.freeze({
  // TypeScript / JavaScript
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  // Python
  '.py': 'python',
  '.pyi': 'python',
  // Go / Rust / Java / Kotlin / Scala / C# / Swift / Lua
  '.go': 'go',
  '.rs': 'rust',
  '.java': 'java',
  '.kt': 'kotlin',
  '.kts': 'kotlin',
  '.scala': 'scala',
  '.sc': 'scala',
  '.sbt': 'scala',
  '.cs': 'csharp',
  '.swift': 'swift',
  '.lua': 'lua',
  // Ruby / PHP
  '.rb': 'ruby',
  '.rake': 'ruby',
  '.php': 'php',
  // C / C++
  '.c': 'c',
  '.h': 'c',
  '.cpp': 'cpp',
  '.cc': 'cpp',
  '.cxx': 'cpp',
  '.hpp': 'cpp',
  '.hxx': 'cpp',
  // Vue / Svelte (no tree-sitter extractor, but project-scanner contract
  // lists them as code languages — downstream import map will return [])
  '.vue': 'vue',
  '.svelte': 'svelte',
  // Shell / Batch / PowerShell
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.ps1': 'powershell',
  '.psm1': 'powershell',
  '.psd1': 'powershell',
  '.bat': 'batch',
  '.cmd': 'batch',
  // Markup / docs
  '.html': 'html',
  '.htm': 'html',
  '.css': 'css',
  '.scss': 'css',
  '.sass': 'css',
  '.less': 'css',
  '.md': 'markdown',
  '.mdx': 'markdown',
  '.rst': 'markdown',
  // Config / data
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.json': 'json',
  '.jsonc': 'jsonc',
  '.toml': 'toml',
  '.xml': 'xml',
  '.xsl': 'xml',
  '.xsd': 'xml',
  '.plist': 'xml',
  '.cfg': 'config',
  '.ini': 'config',
  '.env': 'config',
  // Data / schema
  '.sql': 'sql',
  '.graphql': 'graphql',
  '.gql': 'graphql',
  '.proto': 'protobuf',
  '.prisma': 'prisma',
  '.csv': 'csv',
  '.tsv': 'csv',
  // Infra
  '.tf': 'terraform',
  '.tfvars': 'terraform',
  // JVM build files (categorized via filename-or-extension)
  '.gradle': 'gradle',
  // .NET project files (mapped to extension-derived ids; downstream
  // treats them as config — see CATEGORY_BY_EXT)
  '.csproj': 'csproj',
  '.sln': 'sln',
  '.properties': 'properties',
  '.mod': 'mod',
  '.sum': 'sum',
});

/**
 * Filename (no extension) -> language id. Compared case-sensitively against
 * basename(path). Includes the most common no-extension conventions; anything
 * NOT in this table with no extension falls back to `unknown`.
 *
 * Dockerfile.* variants (Dockerfile.dev, Dockerfile.prod) are handled by a
 * startsWith check in `detectLanguage()` so we don't have to enumerate every
 * possible suffix.
 */
const LANGUAGE_BY_FILENAME = Object.freeze({
  Dockerfile: 'dockerfile',
  Makefile: 'makefile',
  GNUmakefile: 'makefile',
  makefile: 'makefile',
  Jenkinsfile: 'jenkinsfile',
  Procfile: 'procfile',
  Vagrantfile: 'vagrantfile',
});

/**
 * Detect the language of a file by its path. Lowercase extension lookup,
 * then no-extension filename lookup. Never returns null — falls back to
 * the lowercased extension (without dot) or 'unknown' if there is no
 * extension. Downstream consumers rely on this field always being a string
 * (see project-scanner.md Step 3 "Fallback" note).
 */
export function detectLanguage(filePath) {
  const base = basename(filePath);
  const ext = extname(filePath).toLowerCase();

  // Dockerfile.dev, Dockerfile.prod, etc. — common variant form.
  if (base === 'Dockerfile' || base.startsWith('Dockerfile.')) return 'dockerfile';

  // Dotfile names like .env, .env.local — path.extname returns '' for
  // single-segment dotfiles (e.g. '.env') and the SECOND segment for
  // compound dotfiles (e.g. '.local' for '.env.local'). Neither hits the
  // intended LANGUAGE_BY_EXT['.env'] mapping. Try the leading dotfile
  // portion first so `.env`, `.env.local`, `.env.production` all map.
  const dotKey = dotfileKey(base);
  if (dotKey && LANGUAGE_BY_EXT[dotKey]) return LANGUAGE_BY_EXT[dotKey];

  if (ext) {
    const byExt = LANGUAGE_BY_EXT[ext];
    if (byExt) return byExt;
    // Unknown extension → drop the leading dot, lowercase. Never null.
    return ext.slice(1);
  }

  // No-extension file — try filename table.
  const byFilename = LANGUAGE_BY_FILENAME[base];
  if (byFilename) return byFilename;

  return 'unknown';
}

/**
 * Extract the canonical dotfile "extension" from a basename, or null.
 *
 * `.env`          -> `.env`
 * `.env.local`    -> `.env`
 * `.bashrc`       -> `.bashrc`
 * `package.json`  -> null (not a dotfile)
 *
 * Used by both detectLanguage and detectCategory so dotfile-style configs
 * (e.g., `.env`, `.env.local`, `.env.production`) get their leading
 * segment treated as the implicit extension instead of falling through
 * to `unknown` / `code`.
 */
function dotfileKey(base) {
  if (!base.startsWith('.')) return null;
  const m = base.match(/^(\.[a-z0-9]+)/i);
  return m ? m[1].toLowerCase() : null;
}

// ---------------------------------------------------------------------------
// Category detection
//
// Implements the priority-ordered rules from project-scanner.md Step 4.
// Order matters: more specific rules must run before more general ones
// (e.g. `docker-compose.yml` is infra, not config).
//
// Categories: code | config | docs | infra | data | script | markup
// ---------------------------------------------------------------------------

/**
 * Extension -> category. Used only after the higher-priority path-based
 * checks (infra/docs exclusions) in `detectCategory()`. Plain extension
 * lookup is intentionally last-resort — many configs need their full path
 * inspected first.
 */
const CATEGORY_BY_EXT = Object.freeze({
  // docs
  '.md': 'docs',
  '.mdx': 'docs',
  '.rst': 'docs',
  '.txt': 'docs',
  '.text': 'docs',
  // config
  '.yaml': 'config',
  '.yml': 'config',
  '.json': 'config',
  '.jsonc': 'config',
  '.toml': 'config',
  '.xml': 'config',
  '.xsl': 'config',
  '.xsd': 'config',
  '.plist': 'config',
  '.cfg': 'config',
  '.ini': 'config',
  '.env': 'config',
  '.properties': 'config',
  '.csproj': 'config',
  '.sln': 'config',
  '.mod': 'config',
  '.sum': 'config',
  '.gradle': 'config',
  '.sbt': 'config',
  // infra
  '.tf': 'infra',
  '.tfvars': 'infra',
  // data
  '.sql': 'data',
  '.graphql': 'data',
  '.gql': 'data',
  '.proto': 'data',
  '.prisma': 'data',
  '.csv': 'data',
  '.tsv': 'data',
  // script
  '.sh': 'script',
  '.bash': 'script',
  '.zsh': 'script',
  '.ps1': 'script',
  '.psm1': 'script',
  '.psd1': 'script',
  '.bat': 'script',
  '.cmd': 'script',
  // markup
  '.html': 'markup',
  '.htm': 'markup',
  '.css': 'markup',
  '.scss': 'markup',
  '.sass': 'markup',
  '.less': 'markup',
});

/**
 * Filenames (no extension or full filename with extension) that always
 * map to `infra` regardless of their extension. Compared case-sensitively
 * against basename(path).
 */
const INFRA_FILENAMES = new Set([
  'Dockerfile',
  '.dockerignore',
  'Makefile',
  'GNUmakefile',
  'makefile',
  'Jenkinsfile',
  'Procfile',
  'Vagrantfile',
  '.gitlab-ci.yml',
]);

/**
 * Detect the project-scanner category for a file. Priority order matches
 * project-scanner.md Step 4 "Priority rule" — most specific wins.
 *
 * 1. LICENSE -> code (per the spec note "except LICENSE"). The Step-2
 *    exclusion table normally removes LICENSE, but if a project chooses to
 *    re-include it via `.understandignore` negation, it should NOT land in
 *    docs. We classify as `code` rather than inventing a new bucket.
 * 2. Filename-based infra (Dockerfile, Makefile, Jenkinsfile,
 *    docker-compose.*, Vagrantfile, Procfile, .gitlab-ci.yml,
 *    .dockerignore).
 * 3. Path-based infra (.github/workflows/, .circleci/, k8s/, kubernetes/,
 *    *.k8s.yml, *.k8s.yaml).
 * 4. Extension-based mapping (CATEGORY_BY_EXT).
 * 5. Fallback: `code` (matches the spec — "All other extensions").
 */
export function detectCategory(filePath) {
  const base = basename(filePath);
  const ext = extname(filePath).toLowerCase();
  const posix = filePath.split(sep).join('/');

  // Rule 1: LICENSE exception (project-scanner.md Step 4 table comment).
  if (base === 'LICENSE') return 'code';

  // Rule 2: infra by filename — Dockerfile + variants, Makefile,
  // Jenkinsfile, docker-compose.*, Procfile, Vagrantfile, .gitlab-ci.yml,
  // .dockerignore.
  if (INFRA_FILENAMES.has(base)) return 'infra';
  if (base === 'Dockerfile' || base.startsWith('Dockerfile.')) return 'infra';
  if (base.startsWith('docker-compose.')) return 'infra';
  if (base === 'compose.yml' || base === 'compose.yaml') return 'infra';

  // Rule 3: infra by path.
  if (posix.startsWith('.github/workflows/')) return 'infra';
  if (posix.startsWith('.circleci/')) return 'infra';
  // Match a `k8s/` or `kubernetes/` segment anywhere in the path.
  if (/(^|\/)(k8s|kubernetes)\//.test(posix)) return 'infra';
  // `*.k8s.yml` and `*.k8s.yaml` — Kubernetes-flavored YAML.
  if (/\.k8s\.(ya?ml)$/i.test(base)) return 'infra';

  // Rule 4: extension-based lookup.
  if (ext) {
    const byExt = CATEGORY_BY_EXT[ext];
    if (byExt) return byExt;
  }

  // Rule 4.5: dotfile-style configs (.env, .env.local, .env.production).
  // path.extname misses these — see dotfileKey docstring.
  const dotKey = dotfileKey(base);
  if (dotKey) {
    const byDot = CATEGORY_BY_EXT[dotKey];
    if (byDot) return byDot;
  }

  // Rule 5: filename-based config catch-all for no-extension config files
  // commonly seen in JVM/Go/.NET projects (covered above for infra but not
  // config). We don't enumerate every possible config filename here — that
  // gets handled by the language map's no-extension entries upstream.
  // Anything not matched falls through to `code`.
  return 'code';
}

// ---------------------------------------------------------------------------
// Complexity estimation (project-scanner.md Step 7)
// ---------------------------------------------------------------------------

/**
 * Map a total file count to a complexity tier. Thresholds are inclusive on
 * the lower bound:
 *   - small:      1-30
 *   - moderate:   31-150
 *   - large:      151-500
 *   - very-large: >500
 *
 * Edge case: 0 files maps to `small` (the lowest tier) so the field is
 * always set even on empty repos. Downstream consumers treat 0 files as
 * a sentinel for "nothing to analyze" via `totalFiles`, not complexity.
 */
export function estimateComplexity(totalFiles) {
  if (totalFiles <= 30) return 'small';
  if (totalFiles <= 150) return 'moderate';
  if (totalFiles <= 500) return 'large';
  return 'very-large';
}

// ---------------------------------------------------------------------------
// File enumeration
// ---------------------------------------------------------------------------

/**
 * Normalize a path to forward-slash POSIX. The project-scanner contract
 * emits POSIX paths; we re-normalize so the output is stable across
 * Windows/macOS/Linux.
 */
function toPosix(p) {
  return p.split(sep).join('/');
}

/**
 * Locale-independent string order. ECMAScript relational string comparison
 * is lexicographic over UTF-16 code units, so the result cannot vary with ICU,
 * process locale, or operating system settings.
 */
function compareStableStrings(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Enumerate the persistent inventory: committed paths at HEAD.
 * Git failure throws. Untracked files, the index, and a directory walk
 * are not a fallback.
 */
async function enumerateFiles(projectRoot) {
  const names = await committedInventory(projectRoot);
  return names.map(toPosix);
}

// ---------------------------------------------------------------------------
// Filter accounting
//
// The project-scanner.md contract requires `filteredByIgnore` to count files
// dropped specifically by user `.understandignore` or CLI `--exclude`
// patterns (the delta beyond what the hardcoded defaults would have removed).
// We accomplish this by building TWO filters:
//   - `defaultOnly`: defaults only, no user patterns
//   - `combined`: defaults + user patterns (createIgnoreFilter)
// and counting paths that the combined filter excludes but the defaults-only
// filter would have kept.
//
// Negation (`!pattern`) is correctly handled by the combined filter — a file
// re-included via `!` won't be in the combined-excluded set, so it WON'T be
// counted in filteredByIgnore (it's "kept", not "additionally filtered").
// ---------------------------------------------------------------------------

/**
 * Build a defaults-only IgnoreFilter — same patterns as createIgnoreFilter
 * would apply, minus any user .understandignore content. We synthesize this
 * via a temp directory with no .understandignore files so the core function
 * still drives the matcher. (Re-implementing the ignore-package wiring here
 * would risk subtle behavior drift from core's matcher.)
 */
function buildDefaultsOnlyFilter() {
  // Use the createIgnoreFilter with a path that we KNOW has no .understandignore.
  // `os.tmpdir()`-based fresh dir guarantees no user patterns leak in.
  // The directory doesn't need to exist on disk because createIgnoreFilter
  // only checks existsSync() before reading.
  // v1 extras are part of the default set, so they are not counted as user drops.
  const fakeProjectRoot = join(
    tmpdir(),
    `ua-scan-defaults-${process.pid}-${Date.now()}`,
  );
  return createIgnoreFilter(fakeProjectRoot, [...V1_IGNORE_PATTERNS]);
}

function graphIgnorePatterns(projectRoot) {
  const ignorePath = join(projectRoot, '.workflow', 'graph', 'ignore');
  if (!existsSync(ignorePath)) return [];
  return [readFileSync(ignorePath, 'utf8')];
}

/**
 * Determine whether `projectRoot` has any user .understandignore files.
 * When neither file exists, the combined and defaults-only filters are
 * identical, so we can skip the dual-filter accounting entirely.
 *
 * Mirrors core's createIgnoreFilter, which reads the resolved data dir —
 * `.ua/`, or legacy `.understand-anything/` when that directory already
 * exists (see resolveUaDir).
 */
function hasUserIgnoreFile(projectRoot) {
  const legacy = join(projectRoot, '.understand-anything');
  const uaDir = existsSync(legacy) ? legacy : join(projectRoot, '.ua');
  return (
    existsSync(join(projectRoot, '.understandignore'))
    || existsSync(join(uaDir, '.understandignore'))
  );
}

// ---------------------------------------------------------------------------
// Line counting
// ---------------------------------------------------------------------------

/**
 * Read a file once and count its newline-delimited lines. Returns both the raw
 * bytes and the number of `\n` characters; the caller feeds those same bytes
 * directly into the content digest without a second read or a whole-repo
 * content concatenation. The count matches `wc -l` semantics.
 *
 * Per-file failure: emits a Warning: and returns null. Caller decides
 * whether to drop the file or keep it with sizeLines=0.
 */
async function readAndCountLines(projectRoot, posixPath, failures) {
  try {
    const buf = await readHeadBlob(projectRoot, posixPath);
    // Manual newline count beats split('\n').length on large files — no
    // intermediate array allocation. We count the `\n` byte (0x0a) directly.
    let count = 0;
    for (let i = 0; i < buf.length; i++) {
      if (buf[i] === 0x0a) count++;
    }
    return { bytes: buf, sizeLines: count };
  } catch (err) {
    failures.push({ path: posixPath, stage: 'file-read', message: err.message });
    process.stderr.write(
      `Warning: scan-project: ${posixPath} — line count failed ` +
      `(${err.message}) — file skipped from output\n`,
    );
    return null;
  }
}

const CONTENT_DIGEST_DOMAIN = Buffer.from('understand-anything:scan-content:v1\0', 'utf-8');

/**
 * Add one scanned regular file to the aggregate fingerprint. Entries arrive
 * in compareStableStrings path order. Each frame is:
 *   uint32be(path UTF-8 byte length) || uint64be(content byte length) ||
 *   UTF-8 path bytes || raw content bytes
 * Length prefixes make path/content and adjacent-entry boundaries unambiguous.
 */
function updateContentDigest(hash, posixPath, contentBytes) {
  const pathBytes = Buffer.from(posixPath, 'utf-8');
  const lengths = Buffer.allocUnsafe(12);
  lengths.writeUInt32BE(pathBytes.length, 0);
  lengths.writeBigUInt64BE(BigInt(contentBytes.length), 4);
  hash.update(lengths);
  hash.update(pathBytes);
  hash.update(contentBytes);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  let projectRoot;
  let outputPath;
  let excludeAnalysisData = false;
  const excludePatterns = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--exclude-analysis-data') {
      excludeAnalysisData = true;
      continue;
    }
    if (arg === '--exclude') {
      const value = args[i + 1];
      if (!value || value.startsWith('--')) {
        process.stderr.write('scan-project.mjs failed: --exclude requires patterns\n');
        process.exit(1);
      }
      excludePatterns.push(
        ...value
          .split(',')
          .map(pattern => pattern.trim())
          .filter(Boolean),
      );
      i++;
      continue;
    }
    if (arg.startsWith('--')) {
      process.stderr.write(`scan-project.mjs failed: unknown option: ${arg}\n`);
      process.exit(1);
    }
    if (!projectRoot) {
      projectRoot = arg;
      continue;
    }
    if (!outputPath) {
      outputPath = arg;
      continue;
    }
    process.stderr.write(`scan-project.mjs failed: unexpected argument: ${arg}\n`);
    process.exit(1);
  }

  if (!projectRoot || !outputPath) {
    process.stderr.write(
      'Usage: node scan-project.mjs <projectRoot> <outputPath> ' +
      '[--exclude <patterns>] [--exclude-analysis-data]\n',
    );
    process.exit(1);
  }

  if (!existsSync(projectRoot)) {
    process.stderr.write(
      `scan-project.mjs failed: projectRoot does not exist: ${projectRoot}\n`,
    );
    process.exit(1);
  }
  const projectRootStat = statSync(projectRoot);
  if (!projectRootStat.isDirectory()) {
    process.stderr.write(
      `scan-project.mjs failed: projectRoot is not a directory: ${projectRoot}\n`,
    );
    process.exit(1);
  }

  const failures = [];

  // 1. Enumerate committed paths. Git failure stops the scan.
  let candidates;
  try {
    candidates = (await enumerateFiles(projectRoot)).filter(
      rel =>
        !excludeAnalysisData ||
        (!rel.startsWith('.ua/') && !rel.startsWith('.understand-anything/')),
    );
  } catch (err) {
    process.stderr.write(`scan-project.mjs failed: ${err.message}\n`);
    process.exit(1);
  }

  // 2. Filter via createIgnoreFilter (defaults + .understandignore + v1 extras
  //    + optional .workflow/graph/ignore + CLI excludes).
  //    Build a defaults-only filter in parallel to count user-driven drops.
  const projectIgnore = graphIgnorePatterns(projectRoot);
  const combined = createIgnoreFilter(projectRoot, [
    ...V1_IGNORE_PATTERNS,
    ...projectIgnore,
    ...excludePatterns,
  ]);
  const userIgnoresPresent = hasUserIgnoreFile(projectRoot)
    || projectIgnore.length > 0
    || excludePatterns.length > 0;
  const defaultsOnly = userIgnoresPresent ? buildDefaultsOnlyFilter() : combined;

  let filteredByIgnore = 0;
  const kept = [];
  for (const rel of candidates) {
    const isIgnoredCombined = combined.isIgnored(rel);
    if (!isIgnoredCombined) {
      kept.push(rel);
      continue;
    }
    // Dropped by combined filter. If defaults-only would have ALSO dropped
    // it, this is a baseline default drop — not counted. If defaults-only
    // would have KEPT it, this drop is attributable to the user's
    // .understandignore content or CLI --exclude patterns.
    if (userIgnoresPresent && !defaultsOnly.isIgnored(rel)) {
      filteredByIgnore++;
    }
  }

  // The per-file pass, output, stats key insertion, and content fingerprint
  // all consume this one locale-independent path order.
  kept.sort(compareStableStrings);

  // 3. Per-file: language + category + line count.
  //    Drop files that fail line counting (per-file resilience).
  const fileEntries = [];
  const contentHash = createHash('sha256');
  contentHash.update(CONTENT_DIGEST_DOMAIN);
  for (const rel of kept) {
    // Bytes come from HEAD even when the worktree is clean, dirty, or missing
    // the path. Symlinks were already dropped from the inventory.
    const scanned = await readAndCountLines(projectRoot, rel, failures);
    if (scanned === null) {
      // readAndCountLines already emitted the Warning: line.
      continue;
    }
    updateContentDigest(contentHash, rel, scanned.bytes);
    fileEntries.push({
      path: rel,
      language: detectLanguage(rel),
      sizeLines: scanned.sizeLines,
      fileCategory: detectCategory(rel),
    });
  }

  // 4. Determinism: preserve the documented locale-independent path order.
  fileEntries.sort((a, b) => compareStableStrings(a.path, b.path));
  const contentDigest = contentHash.digest('hex');

  // 5. Stats.
  const byCategory = {};
  const byLanguage = {};
  for (const f of fileEntries) {
    byCategory[f.fileCategory] = (byCategory[f.fileCategory] || 0) + 1;
    byLanguage[f.language] = (byLanguage[f.language] || 0) + 1;
  }

  const estimatedComplexity = estimateComplexity(fileEntries.length);

  const output = {
    scriptCompleted: true,
    contentDigest,
    files: fileEntries,
    totalFiles: fileEntries.length,
    filteredByIgnore,
    estimatedComplexity,
    failures,
    stats: {
      filesScanned: fileEntries.length,
      byCategory,
      byLanguage,
    },
  };

  writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf-8');

  if (!existsSync(outputPath)) {
    throw new Error(`output file missing after write: ${outputPath}`);
  }

  process.stderr.write(
    `scan-project: filesScanned=${fileEntries.length} ` +
    `filteredByIgnore=${filteredByIgnore} ` +
    `complexity=${estimatedComplexity}\n`,
  );
}

// ---------------------------------------------------------------------------
// Run only when executed directly as a CLI; importing the module (e.g. from
// tests) must not trigger main().
//
// Canonicalize both sides through realpathSync. Node ESM resolves
// import.meta.url through symlinks but pathToFileURL(process.argv[1]) preserves
// them, so a raw equality check silently no-ops when the script is invoked via
// a symlinked plugin install path (the default in Claude Code / Copilot CLI
// caches). See GitHub issue #162.
// ---------------------------------------------------------------------------
function isCliEntry() {
  if (!process.argv[1]) return false;
  try {
    const modulePath = realpathSync(fileURLToPath(import.meta.url));
    const argvPath = realpathSync(process.argv[1]);
    return modulePath === argvPath;
  } catch {
    return false;
  }
}

if (isCliEntry()) {
  try {
    await main();
  } catch (err) {
    process.stderr.write(`scan-project.mjs failed: ${err.message}\n${err.stack}\n`);
    process.exit(1);
  }
}

// Default export of helpers for testability.
export default {
  detectLanguage,
  detectCategory,
  estimateComplexity,
};
