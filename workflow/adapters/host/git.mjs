/**
 * Argv-safe Git boundary.
 *
 * Callers read HEAD, the committed tree, a blob, diff names, and
 * untracked names. Untracked names are for impact overlays. They are
 * not part of the committed tree.
 * execFile('git', argv) only — no shell. Timeout is 5 seconds.
 * A non-zero exit throws and includes stderr. An empty name list is
 * returned only when Git succeeded and printed no names.
 * Blob bytes come from HEAD, not from the working tree.
 * commitTrailers reads Produktiv commit trailers for a range or a feature.
 *
 * openWorkingTree hashes the working tree (tracked edits plus untracked,
 * non-ignored files) into a temporary index and object directory outside
 * the repository. The real index and .git/objects are never written.
 * With objectDir, tree objects persist there, so a later snapshot can
 * compare against an earlier hash.
 */

import { execFile } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, statSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

export const GIT_TIMEOUT_MS = 5000;
export const GIT_SNAPSHOT_TIMEOUT_MS = 60000;

const MAX_BUFFER = 64 * 1024 * 1024;

const DIFF_RANGE =
  /^[A-Za-z0-9_][A-Za-z0-9_./^{}~-]*\.\.[A-Za-z0-9_][A-Za-z0-9_./^{}~-]*$/;

function assertCwd(cwd) {
  if (typeof cwd !== 'string' || cwd.length === 0) {
    throw new Error('cwd is required');
  }
}

function assertRepoPath(filePath) {
  if (typeof filePath !== 'string' || filePath.length === 0) {
    throw new Error('path must be a non-empty relative path');
  }
  if (filePath.includes('\0')) {
    throw new Error('refusing path that contains NUL');
  }
  if (path.posix.isAbsolute(filePath) || path.win32.isAbsolute(filePath)) {
    throw new Error(`refusing absolute path: ${filePath}`);
  }
  if (filePath.split(/[/\\]/).includes('..')) {
    throw new Error(`refusing path that contains '..': ${filePath}`);
  }
}

function normalizeDiffArgs(args) {
  if (args == null) return [];
  if (!Array.isArray(args)) throw new Error('diff args must be an array');
  for (const arg of args) {
    if (arg === '--cached') continue;
    if (typeof arg === 'string' && DIFF_RANGE.test(arg)) continue;
    throw new Error(`refusing diff argument: ${String(arg)}`);
  }
  return args;
}

function gitFailure(argv, error, stderr) {
  const stderrText = Buffer.isBuffer(stderr)
    ? stderr.toString('utf8')
    : typeof stderr === 'string'
      ? stderr
      : '';
  const detail = stderrText.trim() || error.message;
  const wrapped = new Error(`git ${argv.join(' ')} failed: ${detail}`);
  wrapped.stderr = stderrText;
  wrapped.status = Number.isInteger(error.status)
    ? error.status
    : Number.isInteger(error.code)
      ? error.code
      : null;
  wrapped.code = error.code ?? null;
  return wrapped;
}

function runGit(cwd, argv, { env, input, slow = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = execFile(
      'git',
      argv,
      {
        cwd,
        timeout: slow ? GIT_SNAPSHOT_TIMEOUT_MS : GIT_TIMEOUT_MS,
        maxBuffer: MAX_BUFFER,
        encoding: 'buffer',
        windowsHide: true,
        env: env ? { ...process.env, ...env } : process.env,
      },
      (error, stdout, stderr) => {
        if (error) {
          // A non-zero exit leaves the text on this callback argument.
          reject(gitFailure(argv, error, stderr));
          return;
        }
        resolve(stdout);
      },
    );
    if (input !== undefined) child.stdin.end(input);
  });
}

function splitNul(stdout) {
  const buf = Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout);
  if (buf.length === 0) return [];
  const names = [];
  let start = 0;
  for (let i = 0; i < buf.length; i += 1) {
    if (buf[i] !== 0) continue;
    if (i > start) names.push(buf.toString('utf8', start, i));
    start = i + 1;
  }
  if (start < buf.length) names.push(buf.toString('utf8', start));
  return names;
}

export async function head(cwd) {
  assertCwd(cwd);
  const stdout = await runGit(cwd, ['rev-parse', 'HEAD']);
  return stdout.toString('utf8').trim();
}

export async function listTree(cwd) {
  assertCwd(cwd);
  const stdout = await runGit(cwd, ['ls-tree', '-r', '-z', '--name-only', 'HEAD']);
  return splitNul(stdout);
}

export async function show(cwd, filePath) {
  assertCwd(cwd);
  assertRepoPath(filePath);
  return runGit(cwd, ['show', `HEAD:${filePath}`]);
}

export async function diffNames(cwd, args = []) {
  assertCwd(cwd);
  const extra = normalizeDiffArgs(args);
  const stdout = await runGit(cwd, ['diff', '--name-only', '-z', ...extra]);
  return splitNul(stdout);
}

export async function untrackedNames(cwd) {
  assertCwd(cwd);
  const stdout = await runGit(cwd, ['ls-files', '--others', '--exclude-standard', '-z']);
  return splitNul(stdout);
}

// ------------------------------------------------------------ commit trailers

/** A feature or slice name that is safe as one path segment. */
export const SAFE_NAME = /^(?!.*\.\.)[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;

/** True for an `A..B` range that commitTrailers and diffNames accept. */
export const isRange = (value) => typeof value === 'string' && DIFF_RANGE.test(value);

export const TRAILER_KEYS = ['Produktiv-Feature', 'Produktiv-Unit', 'Produktiv-Ticket'];
export const MAX_TRAILER_COMMITS = 2000;

const TRAILER_KEY_SET = new Set(TRAILER_KEYS.map((key) => key.toLowerCase()));
const BODY_TRAILER = /^[ \t]*(produktiv-(?:feature|unit|ticket))[ \t]*:[ \t]*(.*?)[ \t]*$/gim;
const REVERT_LINE = /^This reverts commit ([0-9a-f]{40}(?:[0-9a-f]{24})?)\b/m;
const FIELD = '\x1f';
// Repository config must not change what is printed or parsed.
const PINNED_LOG_CONFIG = ['-c', 'log.showSignature=false', '-c', 'trailer.separators=:'];

function parseTrailerLines(block) {
  const found = [];
  for (const line of block.split('\n')) {
    const at = line.indexOf(':');
    if (at <= 0) continue;
    const key = line.slice(0, at).trim();
    if (!TRAILER_KEY_SET.has(key.toLowerCase())) continue;
    found.push({ key: TRAILER_KEYS.find((name) => name.toLowerCase() === key.toLowerCase()), value: line.slice(at + 1).trim() });
  }
  return found;
}

// Lines that look like Produktiv trailers but are not in Git's trailer block:
// prose above them, the middle of the message, or an indented squash body.
function unparsedLines(body, trailers) {
  const left = [...trailers];
  const missed = [];
  // From the end: Git's trailer block is the last paragraph.
  for (const match of [...body.matchAll(BODY_TRAILER)].reverse()) {
    const key = TRAILER_KEYS.find((name) => name.toLowerCase() === match[1].toLowerCase());
    const value = match[2];
    const hit = left.findIndex((t) => t.key === key && t.value.startsWith(value));
    if (hit === -1) missed.unshift({ key, value });
    else left.splice(hit, 1);
  }
  return missed;
}

/**
 * Produktiv trailers of the commits in a range (`A..B`), or of HEAD's history
 * filtered to one feature. Values are raw commit-message text: callers must
 * validate them before using one as a path or an identity.
 *
 * Each commit: sha, parents, subject, trailers [{key, value}] from Git's
 * trailer block, unparsed [{key, value}] for trailer-like lines Git did not
 * read, and revertOf when the message says it reverts a commit.
 */
export async function commitTrailers(cwd, { range = null, feature = null, maxCount = MAX_TRAILER_COMMITS } = {}) {
  assertCwd(cwd);
  if ((range == null) === (feature == null)) throw new Error('pass exactly one of range or feature');
  if (range != null && !(typeof range === 'string' && DIFF_RANGE.test(range))) throw new Error(`refusing range: ${String(range)}`);
  if (feature != null && !(typeof feature === 'string' && SAFE_NAME.test(feature))) throw new Error(`refusing feature: ${String(feature)}`);
  const argv = [
    ...PINNED_LOG_CONFIG,
    'log',
    '--no-color',
    '--encoding=UTF-8',
    '-z',
    `--max-count=${maxCount + 1}`,
    `--format=%H${FIELD}%P${FIELD}%s${FIELD}%(trailers:only,unfold)${FIELD}%B`,
  ];
  if (feature != null) {
    try {
      await runGit(cwd, ['rev-parse', '--verify', '--quiet', 'HEAD']);
    } catch (error) {
      if (error.code === 'ENOENT') throw error;
      // No commit yet, or not a repository: let the caller tell them apart.
      await runGit(cwd, ['rev-parse', '--git-dir']);
      return { commits: [], truncated: false };
    }
    // A cheap prefilter. The exact value is compared after parsing. A key with
    // nothing after it may be folded onto the next line, so it passes too.
    const literal = feature.replace(/\./g, '\\.');
    const key = '^[[:space:]]*produktiv-feature[[:space:]]*:[[:space:]]*';
    argv.push('-i', '-E', `--grep=${key}${literal}[[:space:]]*$`, `--grep=${key}$`, '--grep=^This reverts commit ', 'HEAD');
  } else argv.push(range);
  argv.push('--');
  const records = splitNul(await runGit(cwd, argv, { slow: true }));
  const commits = [];
  for (const record of records) {
    const [sha, parents, subject, block, ...rest] = record.replace(/^\n/, '').split(FIELD);
    if (block.includes('%(trailers')) {
      const error = new Error('this Git does not support %(trailers:only,unfold)');
      error.code = 'git-floor';
      throw error;
    }
    const body = rest.join(FIELD);
    const trailers = parseTrailerLines(block);
    commits.push({
      sha,
      parents: parents ? parents.split(' ') : [],
      subject,
      trailers,
      unparsed: unparsedLines(body, trailers),
      revertOf: body.match(REVERT_LINE)?.[1] ?? null,
    });
  }
  const truncated = commits.length > maxCount;
  return { commits: truncated ? commits.slice(0, maxCount) : commits, truncated };
}

const TREE_SHA = /^[0-9a-f]{40}([0-9a-f]{24})?$/;
const BASE_REV = /^[A-Za-z0-9_][A-Za-z0-9_./^{}~-]*$/;

function assertTree(sha) {
  if (typeof sha !== 'string' || !TREE_SHA.test(sha)) throw new Error(`refusing tree id: ${String(sha)}`);
}


/**
 * Open a working-tree snapshot. hash() can be called more than once, for
 * example before and after a command; diffNames and patch compare trees
 * written by this snapshot or present in the repository. close() removes
 * the temporary directory.
 */
export async function openWorkingTree(cwd, { exclude = [], objectDir = null } = {}) {
  assertCwd(cwd);
  for (const rel of exclude) assertRepoPath(rel);
  const gitPath = async (name) =>
    path.resolve(cwd, (await runGit(cwd, ['rev-parse', '--git-path', name])).toString('utf8').trim());
  // Hash the whole worktree even when cwd is a subdirectory; exclusions stay relative to cwd.
  const top = (await runGit(cwd, ['rev-parse', '--show-toplevel'])).toString('utf8').trim();
  const excluded = exclude.map((rel) =>
    path.relative(realpathSync(top), path.resolve(realpathSync(cwd), rel)).split(path.sep).join('/'),
  );
  for (const rel of excluded) assertRepoPath(rel);
  const realIndex = await gitPath('index');
  const realObjects = await gitPath('objects');
  const dir = mkdtempSync(path.join(tmpdir(), 'produktiv-tree-'));
  const objects = objectDir ? path.resolve(objectDir) : path.join(dir, 'objects');
  // Git refuses a repository whose object directory does not exist.
  mkdirSync(path.join(objects, 'pack'), { recursive: true });
  const env = {
    GIT_INDEX_FILE: path.join(dir, 'index'),
    GIT_OBJECT_DIRECTORY: objects,
    GIT_ALTERNATE_OBJECT_DIRECTORIES: realObjects,
  };
  let closed = false;
  const live = () => {
    if (closed) throw new Error('working-tree snapshot is closed');
  };
  return {
    async hash() {
      live();
      // A fresh copy each time keeps an earlier hash from leaking into a later one.
      if (existsSync(realIndex)) {
        copyFileSync(realIndex, env.GIT_INDEX_FILE);
        // Keep Git's racy-file check: a copy with a new mtime would trust stale
        // stat data for a same-size edit made in the same second. One ms earlier
        // only makes Git rehash more.
        const { atimeMs, mtimeMs } = statSync(realIndex);
        utimesSync(env.GIT_INDEX_FILE, atimeMs / 1000, (mtimeMs - 1) / 1000);
      } else rmSync(env.GIT_INDEX_FILE, { force: true });
      await runGit(top, ['add', '-A', '--', '.'], { env, slow: true });
      // Removing afterwards, not an exclude pathspec: `add` fails when a pathspec names an ignored path.
      if (excluded.length) {
        await runGit(top, ['rm', '-r', '-q', '--cached', '--ignore-unmatch', '--', ...excluded], { env, slow: true });
      }
      return (await runGit(cwd, ['write-tree'], { env, slow: true })).toString('utf8').trim();
    },
    async base(rev = 'HEAD') {
      live();
      if (typeof rev !== 'string' || !BASE_REV.test(rev)) throw new Error(`refusing base revision: ${String(rev)}`);
      try {
        return (await runGit(cwd, ['rev-parse', '--verify', '--quiet', `${rev}^{tree}`], { env }))
          .toString('utf8')
          .trim();
      } catch (error) {
        if (rev !== 'HEAD') throw error;
        // No first commit yet: compare against the empty tree of this repository's hash format.
        return (await runGit(cwd, ['hash-object', '-t', 'tree', '--stdin'], { env, input: '' }))
          .toString('utf8')
          .trim();
      }
    },
    async hasTree(sha) {
      live();
      assertTree(sha);
      try {
        await runGit(cwd, ['cat-file', '-e', `${sha}^{tree}`], { env });
        return true;
      } catch {
        return false;
      }
    },
    /** Per-path status and line counts. Binary files have null counts. */
    async stats(from, to) {
      live();
      assertTree(from);
      assertTree(to);
      const args = ['diff-tree', '-r', '-z', '--no-renames', from, to];
      const names = splitNul(await runGit(cwd, [...args.slice(0, 4), '--name-status', ...args.slice(4)], { env, slow: true }));
      const counts = splitNul(await runGit(cwd, [...args.slice(0, 4), '--numstat', ...args.slice(4)], { env, slow: true }));
      const byPath = new Map();
      for (let i = 0; i + 1 < names.length; i += 2) byPath.set(names[i + 1], { path: names[i + 1], status: names[i], added: 0, deleted: 0, binary: false });
      for (const entry of counts) {
        const [added, deleted, ...rest] = entry.split('\t');
        const row = byPath.get(rest.join('\t'));
        if (!row) continue;
        row.binary = added === '-';
        row.added = row.binary ? null : Number(added);
        row.deleted = row.binary ? null : Number(deleted);
      }
      return [...byPath.values()];
    },
    async diffNames(from, to) {
      live();
      assertTree(from);
      assertTree(to);
      return splitNul(await runGit(cwd, ['diff-tree', '-r', '-z', '--name-only', '--no-renames', from, to], { env, slow: true }));
    },
    async patch(from, to) {
      live();
      assertTree(from);
      assertTree(to);
      return (
        await runGit(cwd, ['diff-tree', '-r', '-p', '--no-color', '--no-ext-diff', '--no-renames', '-U0', from, to], {
          env,
          slow: true,
        })
      ).toString('utf8');
    },
    /**
     * Submodules whose working files differ from their recorded commit. The
     * tree hash records only the submodule commit, so it cannot see these.
     * Read-only: --no-optional-locks keeps status from rewriting the index.
     */
    async dirtySubmodules() {
      live();
      if (!existsSync(path.join(top, '.gitmodules'))) return [];
      const records = splitNul(
        await runGit(top, ['--no-optional-locks', 'status', '--porcelain=v2', '-z', '--ignore-submodules=none'], { slow: true }),
      );
      const dirty = [];
      for (let i = 0; i < records.length; i += 1) {
        const record = records[i];
        const kind = record[0];
        if (kind !== '1' && kind !== '2' && kind !== 'u') continue;
        const fieldCount = kind === '1' ? 8 : kind === '2' ? 9 : 10;
        const fields = record.split(' ');
        const sub = fields[2];
        const file = fields.slice(fieldCount).join(' ');
        if (kind === '2') i += 1; // the original path follows a rename record
        if (sub?.[0] === 'S' && (sub[2] === 'M' || sub[3] === 'U')) dirty.push(file);
      }
      return dirty;
    },
    close() {
      if (closed) return;
      closed = true;
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
