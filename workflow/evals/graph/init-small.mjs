/**
 * build the small graph fixture as a real git repository.
 *
 * Source files live in workflow/evals/fixtures/graph/small/. This script
 * copies them and creates the commits, so SHAs come from the eval.
 * The structural path is offline: a blackhole proxy is installed before
 * any later import can open a socket.
 */

import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.env.http_proxy = "http://127.0.0.1:9";
process.env.https_proxy = "http://127.0.0.1:9";
process.env.HTTP_PROXY = "http://127.0.0.1:9";
process.env.HTTPS_PROXY = "http://127.0.0.1:9";
process.env.ALL_PROXY = "http://127.0.0.1:9";
process.env.NO_PROXY = "";
process.env.no_proxy = "";

const fixtureDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fixtures/graph/small");

const REQUIRED = [
  "app/main.ts",
  "app/caller.ts",
  "app/switch.ts",
  "app/use-main.ts",
  "lib/known.ts",
  "lib/doomed.ts",
  "other/side.ts",
  "py/worker.py",
  "db/schema.sql",
  "docs/notes.md",
  "extra/a.ts",
];

export function createSmallRepo() {
  for (const rel of REQUIRED) {
    if (!existsSync(path.join(fixtureDir, rel))) {
      throw new Error(`small fixture is missing ${rel}`);
    }
  }
  const cwd = mkdtempSync(path.join(tmpdir(), "produktiv-graph-small-"));
  cpSync(fixtureDir, cwd, {
    recursive: true,
    filter: (source) => path.basename(source) !== ".DS_Store",
  });
  git(cwd, ["init", "-b", "main"]);
  git(cwd, ["config", "user.email", "eval@produktiv.invalid"]);
  git(cwd, ["config", "user.name", "Produktiv Eval"]);
  git(cwd, ["config", "commit.gpgsign", "false"]);
  git(cwd, ["config", "core.autocrlf", "false"]);
  git(cwd, ["config", "diff.renames", "true"]);
  git(cwd, ["add", "-A"]);
  git(cwd, ["commit", "-m", "initial"]);
  return {
    cwd,
    head: git(cwd, ["rev-parse", "HEAD"]),
    cleanup() {
      rmSync(cwd, { recursive: true, force: true });
    },
  };
}

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function isCliEntry() {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isCliEntry()) {
  const repo = createSmallRepo();
  process.stdout.write(`${repo.cwd}\n${repo.head}\n`);
}
