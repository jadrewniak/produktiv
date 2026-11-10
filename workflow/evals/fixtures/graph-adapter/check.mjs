/**
 * graph adapter facade.
 *
 * The harness imports only workflow/adapters/graph. A tiny committed repo
 * stands in for the small graph fixture: a known symbol is reached through
 * that import, a scoped query does not answer from the other directory, and
 * a query does not return facts from an older SHA.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test } from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const workflowDir = path.join(repoRoot, "workflow");
const vendorRoot = path.join(workflowDir, "vendor/understand-anything");
const adapterTs = path.join(workflowDir, "adapters/graph/index.ts");
const tsc = path.join(workflowDir, "vendor/understand-anything/node_modules/typescript/bin/tsc");

execFileSync(process.execPath, [tsc, "-p", path.join(workflowDir, "tsconfig.json"), "--noEmit"], {
  cwd: workflowDir,
  stdio: "inherit",
});

const require = createRequire(import.meta.url);
const ts = require("../../../vendor/understand-anything/node_modules/typescript/lib/typescript.js");

const emit = [
  "graph/assemble.ts",
  "graph/store.ts",
  "graph/reconcile.ts",
  "graph/neighborhood.ts",
  "graph/queries.ts",
  "graph/impact.ts",
  "adapters/graph/index.ts",
];

for (const rel of emit) {
  const sourcePath = path.join(workflowDir, rel);
  const transpiled = ts.transpileModule(readFileSync(sourcePath, "utf8"), {
    fileName: sourcePath,
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  });
  writeFileSync(path.join(workflowDir, rel.replace(/\.ts$/, ".js")), transpiled.outputText);
}

const adapter = await import(pathToFileURL(path.join(workflowDir, "adapters/graph/index.js")).href);

const FROZEN = [
  "ensure_fresh",
  "find_symbol",
  "related",
  "callers",
  "callees",
  "dependencies",
  "dependents",
  "paths",
  "component",
  "architecture_overview",
  "impact_of_diff",
];

const LIB = "export function knownSymbol(): number {\n  return 1;\n}\n";
const APP = "import { knownSymbol } from \"./lib\";\n\nexport function main(): number {\n  return knownSymbol();\n}\n";
const SIDE = "export function sideSymbol(): number {\n  return 3;\n}\n";
const LUA = "-- no parser for this language\nlocal value = 1\n";
const ADDED = "export function addedSymbol(): number {\n  return 2;\n}\n";

const FORBIDDEN_IMPORT = /(?:from|import|require)\s*\(?\s*["'][^"']*(?:figma|llm-analyzer)/;
const FORBIDDEN_FILES = new Set([
  "llm-analyzer.ts",
  "llm-analyzer.js",
  "search.ts",
  "search.js",
  "tour-generator.ts",
  "tour-generator.js",
  "language-lesson.ts",
  "language-lesson.js",
  "embedding-search.ts",
  "embedding-search.js",
  "discovery.ts",
  "discovery.js",
  "SKILL.md",
]);
const FORBIDDEN_DIRS = new Set(["figma", "dashboard", "viewer", "hooks"]);

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function initRepo() {
  const cwd = mkdtempSync(path.join(tmpdir(), "produktiv-graph-adapter-"));
  git(cwd, ["init", "-b", "main"]);
  git(cwd, ["config", "user.email", "eval@produktiv.invalid"]);
  git(cwd, ["config", "user.name", "Produktiv Eval"]);
  git(cwd, ["config", "commit.gpgsign", "false"]);
  return cwd;
}

function write(cwd, rel, text) {
  const abs = path.join(cwd, rel);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, text);
}

function graphFile(cwd) {
  return path.join(cwd, ".workflow/graph/knowledge-graph.json");
}

function metaFile(cwd) {
  return path.join(cwd, ".workflow/graph/meta.json");
}

function hashFile(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function walkFiles(dir, out) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules") continue;
    const full = path.join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (FORBIDDEN_DIRS.has(name)) out.dirs.push(full);
      walkFiles(full, out);
      continue;
    }
    if (FORBIDDEN_FILES.has(name)) out.files.push(full);
  }
}

function importLines(text) {
  return text.split("\n").filter((line) => /^\s*import\s/.test(line) || /^\s*export\s.+from\s/.test(line));
}

describe("graph adapter facade", { concurrency: false }, () => {
  test("skills are the only importers, and rejected packages stay out", () => {
    const source = readFileSync(adapterTs, "utf8");
    assert.match(source, /Skills are the only allowed importers/);
    assert.doesNotMatch(source, /export\s+(async\s+)?function\s+(domain_slice|hotspots)\b/);
    assert.doesNotMatch(source, /export\s*\{[^}]*\b(domain_slice|hotspots)\b/);
    for (const line of importLines(source)) {
      assert.doesNotMatch(line, FORBIDDEN_IMPORT, line);
      assert.doesNotMatch(line, /vendor\/understand-anything/, line);
    }

    const skillsDir = path.join(workflowDir, "skills");
    if (existsSync(skillsDir)) {
      const stack = [skillsDir];
      while (stack.length > 0) {
        const dir = stack.pop();
        for (const name of readdirSync(dir)) {
          const full = path.join(dir, name);
          if (statSync(full).isDirectory()) stack.push(full);
          else if (/\.(mjs|js|ts|md)$/.test(name)) {
            for (const line of importLines(readFileSync(full, "utf8"))) {
              assert.doesNotMatch(line, FORBIDDEN_IMPORT, `${full}: ${line}`);
            }
          }
        }
      }
    }

    const found = { files: [], dirs: [] };
    walkFiles(vendorRoot, found);
    assert.deepEqual(found.files, [], `vendored tree still has ${found.files.join(", ")}`);
    assert.deepEqual(found.dirs, [], `vendored tree still has ${found.dirs.join(", ")}`);

    for (const name of FROZEN) {
      assert.equal(typeof adapter[name], "function", name);
    }
    assert.equal(Object.hasOwn(adapter, "domain_slice"), false);
    assert.equal(Object.hasOwn(adapter, "hotspots"), false);
  });

  test("a missing graph returns UNAVAILABLE and no symbol", async () => {
    const cwd = initRepo();
    try {
      write(cwd, "src/lib.ts", LIB);
      git(cwd, ["add", "src"]);
      git(cwd, ["commit", "-m", "initial"]);
      const withheld = await adapter.find_symbol(cwd, "knownSymbol", "src");
      assert.equal(withheld.status, "UNAVAILABLE");
      assert.equal(withheld.reason, "missing-graph");
      assert.equal(withheld.scope, "src");
      assert.deepEqual(withheld.hits, []);
      assert.equal(withheld.analyzed_sha, undefined);
      assert.equal(existsSync(graphFile(cwd)), false);
      assert.equal(JSON.stringify(withheld).includes("knownSymbol"), false);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test("the adapter import reaches a known symbol on a fresh graph", { timeout: 180_000 }, async () => {
    const cwd = initRepo();
    try {
      write(cwd, "src/lib.ts", LIB);
      write(cwd, "src/app.ts", APP);
      write(cwd, "other/side.ts", SIDE);
      write(cwd, "notes.lua", LUA);
      git(cwd, ["add", "src", "other", "notes.lua"]);
      git(cwd, ["commit", "-m", "initial"]);
      const head = git(cwd, ["rev-parse", "HEAD"]);

      const built = await adapter.ensure_fresh(cwd, "src", "eval");
      assert.equal(built.status, "PARTIAL");
      assert.equal(built.analyzed_sha, head);
      assert.equal(built.scope, "src");
      const reasons = JSON.parse(readFileSync(metaFile(cwd), "utf8")).partial_reasons;
      assert.ok(reasons.includes("unparsed:notes.lua"), reasons.join(","));

      const hit = await adapter.find_symbol(cwd, "knownSymbol");
      assert.equal(hit.status, "PARTIAL");
      assert.equal(hit.analyzed_sha, head);
      assert.equal(hit.hits.some((item) => item.name === "knownSymbol" && item.filePath === "src/lib.ts"), true);

      const outside = await adapter.find_symbol(cwd, "sideSymbol", "src");
      assert.equal(outside.status, "PARTIAL");
      assert.deepEqual(outside.hits, []);
      const inside = await adapter.find_symbol(cwd, "sideSymbol", "other");
      assert.equal(inside.hits.some((item) => item.name === "sideSymbol"), true);

      const caller = await adapter.callers(cwd, "knownSymbol");
      assert.equal(caller.analyzed_sha, head);
      assert.equal(caller.status, "PARTIAL");
      assert.equal(caller.nodes.some((node) => node.name === "main"), true, caller.nodes.map((node) => node.name).join(","));

      const callee = await adapter.callees(cwd, "main");
      assert.equal(callee.nodes.some((node) => node.name === "knownSymbol"), true, callee.nodes.map((node) => node.name).join(","));

      const deps = await adapter.dependencies(cwd, "src/app.ts");
      assert.equal(deps.nodes.some((node) => node.filePath === "src/lib.ts"), true, deps.nodes.map((node) => node.filePath).join(","));

      const dependents = await adapter.dependents(cwd, "src/lib.ts");
      assert.equal(dependents.nodes.some((node) => node.filePath === "src/app.ts"), true);

      const route = await adapter.paths(cwd, "main", "knownSymbol");
      assert.equal(route.analyzed_sha, head);
      assert.ok(route.paths.length > 0, route.note ?? "no path");

      const slice = await adapter.component(cwd, "knownSymbol");
      assert.equal(slice.file?.filePath, "src/lib.ts");
      assert.equal(slice.children.some((node) => node.name === "knownSymbol"), true);

      const scoped = await adapter.related(cwd, "knownSymbol", undefined, "src");
      assert.equal(scoped.nodes.some((node) => node.name === "sideSymbol" || node.filePath === "other/side.ts"), false);

      const overview = await adapter.architecture_overview(cwd, "src");
      assert.equal(overview.analyzed_sha, head);
      assert.equal(overview.fileCount, 2);
      assert.ok(overview.languages.includes("typescript"));
      assert.equal(overview.status, "PARTIAL");

      const explicit = await adapter.impact_of_diff(cwd, { form: "paths", paths: ["src/lib.ts"] });
      assert.equal(explicit.analyzed_sha, head);
      assert.equal(explicit.hits.some((item) => item.evidence === "directly changed" && item.filePath === "src/lib.ts"), true);

      const before = hashFile(graphFile(cwd));
      write(cwd, "src/lib.ts", "export function dirtySymbol(): number {\n  return 9;\n}\n");
      write(cwd, "src/untracked.ts", "export function untrackedSymbol(): number {\n  return 0;\n}\n");
      const impact = await adapter.impact_of_diff(cwd, { form: "worktree", projectRoot: cwd });
      assert.equal(impact.analyzed_sha, head);
      assert.equal(impact.status, "PARTIAL");
      assert.ok(impact.changedPaths.includes("src/lib.ts"));
      assert.ok(impact.untrackedPaths.includes("src/untracked.ts"));
      assert.ok(impact.hits.some((item) => item.evidence === "unmapped" && item.path === "src/untracked.ts"));
      assert.equal(impact.hits.some((item) => item.name === "dirtySymbol"), false);
      assert.equal(hashFile(graphFile(cwd)), before);
      const persisted = JSON.parse(readFileSync(graphFile(cwd), "utf8"));
      const names = new Set(persisted.nodes.map((node) => node.name));
      assert.equal(names.has("knownSymbol"), true);
      assert.equal(names.has("dirtySymbol"), false);
      assert.equal(names.has("untrackedSymbol"), false);
      assert.equal(persisted.project.gitCommitHash, head);

      write(cwd, "src/lib.ts", ADDED);
      git(cwd, ["add", "src/lib.ts"]);
      git(cwd, ["commit", "-m", "rename symbol"]);
      const next = git(cwd, ["rev-parse", "HEAD"]);
      assert.notEqual(next, head);
      const moved = await adapter.impact_of_diff(cwd, { form: "worktree", projectRoot: cwd });
      assert.equal(moved.analyzed_sha, next);
      assert.ok(moved.untrackedPaths.includes("src/untracked.ts"));
      const afterMove = JSON.parse(readFileSync(graphFile(cwd), "utf8"));
      const movedNames = new Set(afterMove.nodes.map((node) => node.name));
      assert.equal(afterMove.project.gitCommitHash, next);
      assert.equal(movedNames.has("addedSymbol"), true);
      assert.equal(movedNames.has("knownSymbol"), false);

      const found = await adapter.find_symbol(cwd, "addedSymbol");
      assert.equal(found.analyzed_sha, next);
      assert.equal(found.hits.some((item) => item.name === "addedSymbol"), true);
      const stale = await adapter.find_symbol(cwd, "knownSymbol");
      assert.equal(stale.analyzed_sha, next);
      assert.equal(stale.hits.some((item) => item.name === "knownSymbol"), false);

      writeFileSync(graphFile(cwd), "{");
      const recovered = await adapter.find_symbol(cwd, "addedSymbol");
      assert.equal(recovered.analyzed_sha, next);
      assert.notEqual(recovered.status, "UNAVAILABLE");
      assert.notEqual(recovered.status, "STALE_RECOVERABLE");
      assert.equal(recovered.hits.some((item) => item.name === "addedSymbol"), true);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test("a failed reconcile does not return the previous symbol", { timeout: 180_000 }, async () => {
    const cwd = initRepo();
    try {
      write(cwd, "src/lib.ts", LIB);
      git(cwd, ["add", "src"]);
      git(cwd, ["commit", "-m", "initial"]);
      const built = await adapter.ensure_fresh(cwd, undefined, "eval");
      const previous = built.analyzed_sha;
      assert.equal(previous, git(cwd, ["rev-parse", "HEAD"]));

      git(cwd, ["rm", "-r", "src"]);
      git(cwd, ["commit", "-m", "remove sources"]);
      const head = git(cwd, ["rev-parse", "HEAD"]);
      assert.notEqual(head, previous);

      const result = await adapter.find_symbol(cwd, "knownSymbol");
      assert.equal(result.hits.some((item) => item.name === "knownSymbol"), false);
      if (result.status === "AVAILABLE" || result.status === "PARTIAL") {
        assert.equal(result.analyzed_sha, head);
      } else {
        assert.ok(result.status === "STALE_RECOVERABLE" || result.status === "UNAVAILABLE");
        assert.equal(result.analyzed_sha, undefined);
        assert.equal(JSON.stringify(result).includes("knownSymbol"), false);
      }
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});
