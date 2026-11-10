/**
 * small-fixture graph evals.
 *
 * The integration table for one committed multi-language repository.
 * init-small.mjs creates the git history during the run. Each case is its
 * own test. The structural path has no network and no model client.
 */

import { createSmallRepo } from "./init-small.mjs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const workflowDir = path.join(repoRoot, "workflow");
const vendorRoot = path.join(workflowDir, "vendor/understand-anything");
const tsc = path.join(vendorRoot, "node_modules/typescript/bin/tsc");

execFileSync(process.execPath, [tsc, "-p", path.join(workflowDir, "tsconfig.json"), "--noEmit"], {
  cwd: workflowDir,
  stdio: "inherit",
});

const require = createRequire(import.meta.url);
const ts = require("../../vendor/understand-anything/node_modules/typescript/lib/typescript.js");

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

const HANDLER = `export function handleRequest(): number {\n  const value = 1;\n  const doubled = value + value;\n  const tripled = doubled + value;\n  return tripled;\n}\n`;
const KNOWN_STRUCTURAL = `export function knownSymbol(): number {\n  const value = 1;\n  const doubled = value + value;\n  const tripled = doubled + value;\n  return tripled;\n}\n\nexport function addedSymbol(): number {\n  const value = 4;\n  const doubled = value + value;\n  const tripled = doubled + value;\n  return tripled;\n}\n\nexport function newName(): number {\n  const value = 3;\n  const doubled = value + value;\n  const tripled = doubled + value;\n  return tripled;\n}\n`;
const SWITCH_STRUCTURAL = `import { sideSymbol } from "../other/side";\n\nexport function switched(): number {\n  const value = sideSymbol();\n  const doubled = value + value;\n  const tripled = doubled + value;\n  return tripled;\n}\n`;
const DIRTY = `export function dirtySymbol(): number {\n  return 9;\n}\n`;
const UNTRACKED = `export function untrackedSymbol(): number {\n  return 0;\n}\n`;
const STAGED = `export function stagedSymbol(): number {\n  return 4;\n}\n`;
const OTHER_ONLY = `export function otherOnlySymbol(): number {\n  const value = 8;\n  const doubled = value + value;\n  const tripled = doubled + value;\n  return tripled;\n}\n`;

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

let repo;

describe("small-fixture graph evals", { concurrency: false, timeout: 180_000 }, () => {
  before(() => {
    repo = createSmallRepo();
  });

  after(() => {
    repo?.cleanup();
  });

  test("vendored structural core stays isolated", () => {
    const found = { files: [], dirs: [] };
    walkVendor(vendorRoot, found);
    assert.deepEqual(found.files, [], `vendored tree still has ${found.files.join(", ")}`);
    assert.deepEqual(found.dirs, [], `vendored tree still has ${found.dirs.join(", ")}`);
    for (const rel of ["adapters/graph/index.ts", "graph/assemble.ts", "graph/reconcile.ts", "graph/queries.ts", "graph/impact.ts"]) {
      for (const line of importLines(readFileSync(path.join(workflowDir, rel), "utf8"))) {
        assert.doesNotMatch(line, FORBIDDEN_IMPORT, `${rel}: ${line}`);
      }
    }
    for (const name of FROZEN) {
      assert.equal(typeof adapter[name], "function", name);
    }
    assert.equal(Object.hasOwn(adapter, "domain_slice"), false);
    assert.equal(Object.hasOwn(adapter, "hotspots"), false);
  });

  test("initial build reads HEAD blobs and ignores untracked and staged adds", async () => {
    const cwd = repo.cwd;
    const head = git(cwd, ["rev-parse", "HEAD"]);
    const committed = execFileSync("git", ["show", "HEAD:lib/known.ts"], { cwd });
    write(cwd, "lib/known.ts", DIRTY);
    write(cwd, "untracked.ts", UNTRACKED);
    write(cwd, "staged-only.ts", STAGED);
    git(cwd, ["add", "--", "staged-only.ts"]);
    try {
      const worktree = readFileSync(path.join(cwd, "lib/known.ts"));
      assert.notDeepEqual(worktree, committed);
      const built = await adapter.ensure_fresh(cwd, undefined, "eval");
      assertFresh(built, head);
      assert.equal(built.rebuilt, true);

      const graph = readGraph(cwd);
      const meta = readMeta(cwd);
      assert.equal(meta.analyzed_sha, head);
      assert.equal(graph.project.gitCommitHash, head);
      assert.equal(graphFile(cwd).startsWith(path.join(cwd, ".workflow", "graph")), true);
      assert.equal(existsSync(path.join(vendorRoot, ".workflow")), false);

      assert.equal(names(graph).has("knownSymbol"), true);
      assert.equal(names(graph).has("dirtySymbol"), false);
      assert.equal(names(graph).has("untrackedSymbol"), false);
      assert.equal(names(graph).has("stagedSymbol"), false);
      assert.equal(hasEdge(graph, "imports", "file:app/main.ts", "file:lib/known.ts"), true);
      assert.equal(ids(graph).has("function:py/worker.py:worker_task"), true);
      assert.equal(ids(graph).has("table:db/schema.sql:accounts"), true);
      assert.equal(ids(graph).has("document:docs/notes.md"), true);
      assert.equal(graph.nodes.some((node) => node.name === "Fixture notes"), false);
      assert.equal(graph.nodes.filter((node) => node.filePath === "docs/notes.md").length, 1);
      assertUnique(graph);
      assert.ok(graph.project.languages.includes("typescript"));
      assert.ok(graph.project.languages.includes("python"));

      const fingerprint = readFingerprints(cwd).files["lib/known.ts"].contentHash;
      assert.equal(fingerprint, sha256(committed));
      assert.notEqual(fingerprint, sha256(worktree));

      const hit = await adapter.find_symbol(cwd, "knownSymbol");
      assertFreshQuery(hit, head);
      assert.equal(hit.hits.some((item) => item.name === "knownSymbol" && item.filePath === "lib/known.ts"), true);
    } finally {
      git(cwd, ["checkout", "--", "lib/known.ts"]);
      git(cwd, ["reset", "-q", "--", "staged-only.ts"]);
      rmSync(path.join(cwd, "staged-only.ts"), { force: true });
      rmSync(path.join(cwd, "untracked.ts"), { force: true });
    }
  });

  test("each query primitive returns on the fresh fixture", async () => {
    const cwd = repo.cwd;
    const head = git(cwd, ["rev-parse", "HEAD"]);
    const symbol = await adapter.find_symbol(cwd, "knownSymbol");
    assertFreshQuery(symbol, head);
    assert.equal(symbol.hits.some((item) => item.id === "function:lib/known.ts:knownSymbol"), true);

    const neighborhood = await adapter.related(cwd, "knownSymbol");
    assertFreshQuery(neighborhood, head);
    assert.ok(Array.isArray(neighborhood.nodes));

    const callers = await adapter.callers(cwd, "knownSymbol");
    assertFreshQuery(callers, head);
    assert.equal(callers.nodes.some((node) => node.name === "runApp"), true, namesOf(callers.nodes));

    const callees = await adapter.callees(cwd, "runApp");
    assertFreshQuery(callees, head);
    assert.equal(callees.nodes.some((node) => node.name === "knownSymbol"), true, namesOf(callees.nodes));

    const dependencies = await adapter.dependencies(cwd, "app/main.ts");
    assertFreshQuery(dependencies, head);
    assert.equal(dependencies.nodes.some((node) => node.filePath === "lib/known.ts"), true, namesOf(dependencies.nodes));

    const dependents = await adapter.dependents(cwd, "lib/known.ts");
    assertFreshQuery(dependents, head);
    assert.equal(dependents.nodes.some((node) => node.filePath === "app/main.ts"), true, namesOf(dependents.nodes));

    const route = await adapter.paths(cwd, "runApp", "knownSymbol");
    assertFreshQuery(route, head);
    assert.ok(route.paths.length > 0, route.note ?? "no path");

    const slice = await adapter.component(cwd, "knownSymbol");
    assertFreshQuery(slice, head);
    assert.equal(slice.file?.filePath, "lib/known.ts");

    const overview = await adapter.architecture_overview(cwd);
    assertFreshQuery(overview, head);
    assert.ok(overview.languages.includes("typescript"));
    assert.ok(overview.languages.includes("python"));
    assert.equal(overview.tables.some((node) => node.name === "accounts"), true);

    const impact = await adapter.impact_of_diff(cwd, { form: "paths", paths: ["lib/known.ts"] });
    assertFreshQuery(impact, head);
    assert.equal(impact.hits.some((item) => item.evidence === "directly changed" && item.filePath === "lib/known.ts"), true);
  });

  test("a scope prefix does not answer from the other subdirectory", async () => {
    const cwd = repo.cwd;
    const head = git(cwd, ["rev-parse", "HEAD"]);
    const outside = await adapter.find_symbol(cwd, "sideSymbol", "app");
    assertFreshQuery(outside, head);
    assert.equal(outside.scope, "app");
    assert.deepEqual(outside.hits, []);

    const inside = await adapter.find_symbol(cwd, "sideSymbol", "other");
    assertFreshQuery(inside, head);
    assert.equal(inside.hits.some((item) => item.filePath === "other/side.ts"), true);

    const appOnly = await adapter.find_symbol(cwd, "runApp", "other");
    assert.deepEqual(appOnly.hits, []);

    const overview = await adapter.architecture_overview(cwd, "app");
    assert.equal(overview.analyzed_sha, head);
    const paths = JSON.stringify(overview.layers);
    assert.equal(paths.includes("other/"), false);
    assert.equal(overview.tables.some((node) => node.filePath?.startsWith("other/")), false);
  });

  test("a cosmetic comment commit is SKIP with no topology change and no model call", async () => {
    const cwd = repo.cwd;
    const beforeGraph = readGraph(cwd);
    const beforeTopology = topology(beforeGraph);
    const knownRange = lineRange(beforeGraph, "function:lib/known.ts:knownSymbol");
    const workerRange = lineRange(beforeGraph, "function:py/worker.py:worker_task");
    insertAfter(cwd, "lib/known.ts", "export function knownSymbol(): number {\n", "  // cosmetic note\n");
    insertAfter(cwd, "py/worker.py", "def worker_task():\n", "    # cosmetic note\n");
    commit(cwd, ["lib/known.ts", "py/worker.py"], "cosmetic comments");
    const head = git(cwd, ["rev-parse", "HEAD"]);

    const report = await adapter.ensure_fresh(cwd, "app");
    assertFresh(report, head);
    const plan = readPlan(cwd);
    assert.equal(plan.action, "SKIP", JSON.stringify(plan));
    assert.deepEqual(plan.filesToReanalyze, []);
    assert.equal(plan.rerunArchitecture, false);

    const graph = readGraph(cwd);
    assert.equal(topology(graph), beforeTopology);
    assert.equal(lineRange(graph, "function:lib/known.ts:knownSymbol"), knownRange);
    assert.equal(lineRange(graph, "function:py/worker.py:worker_task"), workerRange);
    assert.equal(graph.project.gitCommitHash, head);
    assertNoModelOrHttp();
  });

  test("add, remove, and rename a function and change an import, including importers", async () => {
    const cwd = repo.cwd;
    write(cwd, "lib/known.ts", KNOWN_STRUCTURAL);
    write(cwd, "app/switch.ts", SWITCH_STRUCTURAL);
    commit(cwd, ["lib/known.ts", "app/switch.ts"], "structural edit");
    const changed = commitFiles(cwd);
    assert.deepEqual(changed, ["app/switch.ts", "lib/known.ts"]);
    const head = git(cwd, ["rev-parse", "HEAD"]);

    const report = await adapter.ensure_fresh(cwd);
    assertFresh(report, head);
    const plan = readPlan(cwd);
    assert.equal(plan.action, "PARTIAL_UPDATE", JSON.stringify(plan));
    for (const filePath of ["lib/known.ts", "app/switch.ts", "app/caller.ts", "app/main.ts"]) {
      assert.equal(plan.filesToReanalyze.includes(filePath), true, plan.filesToReanalyze.join(","));
    }
    assert.equal(changed.includes("app/caller.ts"), false);
    assert.equal(changed.includes("app/main.ts"), false);

    const graph = readGraph(cwd);
    const present = ids(graph);
    assert.equal(present.has("function:lib/known.ts:removeMe"), false);
    assert.equal(present.has("function:lib/known.ts:oldName"), false);
    assert.equal(present.has("function:lib/known.ts:addedSymbol"), true);
    assert.equal(present.has("function:lib/known.ts:newName"), true);
    assert.equal(present.has("function:lib/known.ts:knownSymbol"), true);
    assert.equal([...present].filter((id) => id === "function:lib/known.ts:knownSymbol").length, 1);
    assertUnique(graph);
    assert.equal(hasEdge(graph, "imports", "file:app/switch.ts", "file:lib/known.ts"), false);
    assert.equal(hasEdge(graph, "imports", "file:app/switch.ts", "file:other/side.ts"), true);
    assertNoModelOrHttp();
  });

  test("a new top-level directory refreshes importers and reruns detectLayers", async () => {
    const cwd = repo.cwd;
    const before = layerNames(readGraph(cwd));
    assert.equal(before.includes("API Layer"), false);
    write(cwd, "api/handler.ts", HANDLER);
    commit(cwd, ["api/handler.ts"], "add api module");
    const changed = commitFiles(cwd);
    assert.deepEqual(changed, ["api/handler.ts"]);
    const head = git(cwd, ["rev-parse", "HEAD"]);

    const report = await adapter.ensure_fresh(cwd, "app");
    assertFresh(report, head);
    const plan = readPlan(cwd);
    assert.equal(plan.action, "ARCHITECTURE_UPDATE", JSON.stringify(plan));
    assert.equal(plan.rerunArchitecture, true);
    assert.equal(plan.filesToReanalyze.includes("api/handler.ts"), true, plan.filesToReanalyze.join(","));
    assert.equal(plan.filesToReanalyze.includes("app/main.ts"), true, plan.filesToReanalyze.join(","));
    assert.equal(changed.includes("app/main.ts"), false);

    const graph = readGraph(cwd);
    assert.equal(layerNames(graph).includes("API Layer"), true, JSON.stringify(graph.layers));
    const api = graph.layers.find((layer) => layer.name === "API Layer");
    assert.equal(api.nodeIds.includes("file:api/handler.ts"), true, api.nodeIds.join(","));
    assert.equal(hasEdge(graph, "imports", "file:app/main.ts", "file:api/handler.ts"), true);
    assert.equal(ids(graph).has("function:api/handler.ts:handleRequest"), true);
    assertNoModelOrHttp();
  });

  test("a deleted file's nodes and edges are gone", async () => {
    const cwd = repo.cwd;
    const before = readGraph(cwd);
    const doomedIds = new Set(before.nodes.filter((node) => node.filePath === "lib/doomed.ts").map((node) => node.id));
    assert.ok(doomedIds.size > 0, "doomed file produced no nodes");
    git(cwd, ["rm", "lib/doomed.ts"]);
    git(cwd, ["commit", "-m", "delete doomed"]);
    const head = git(cwd, ["rev-parse", "HEAD"]);

    const report = await adapter.ensure_fresh(cwd);
    assertFresh(report, head);
    const graph = readGraph(cwd);
    assert.equal(graph.nodes.some((node) => node.filePath === "lib/doomed.ts"), false);
    assert.equal(graph.nodes.some((node) => doomedIds.has(node.id)), false);
    assert.equal(graph.edges.some((edge) => doomedIds.has(edge.source) || doomedIds.has(edge.target)), false);
    assert.equal(names(graph).has("doomedSymbol"), false);
    assertUnique(graph);
  });

  test("a git rename leaves one node on the new path", async () => {
    const cwd = repo.cwd;
    git(cwd, ["mv", "app/main.ts", "app/entry.ts"]);
    const useMain = readFileSync(path.join(cwd, "app/use-main.ts"), "utf8").replace('from "./main"', 'from "./entry"');
    write(cwd, "app/use-main.ts", useMain);
    git(cwd, ["add", "--", "app/use-main.ts"]);
    git(cwd, ["commit", "-m", "rename main to entry"]);
    const head = git(cwd, ["rev-parse", "HEAD"]);
    const renamed = git(cwd, ["diff-tree", "--no-commit-id", "--name-status", "-r", "-M", "HEAD"]);
    assert.match(renamed, /^R\d+\s+app\/main\.ts\s+app\/entry\.ts$/m);

    const report = await adapter.ensure_fresh(cwd);
    assertFresh(report, head);
    const graph = readGraph(cwd);
    assert.equal(graph.nodes.some((node) => node.filePath === "app/main.ts"), false);
    assert.equal(graph.nodes.some((node) => node.filePath === "app/entry.ts"), true);
    const runApp = graph.nodes.filter((node) => node.name === "runApp");
    assert.equal(runApp.length, 1);
    assert.equal(runApp[0].filePath, "app/entry.ts");
    assert.equal(runApp[0].id, "function:app/entry.ts:runApp");
    assert.equal(graph.edges.some((edge) => edge.source.includes("app/main.ts") || edge.target.includes("app/main.ts")), false);
    assert.equal(hasEdge(graph, "imports", "file:app/use-main.ts", "file:app/entry.ts"), true);
    const partial = report.status === "PARTIAL" || readMeta(cwd).partial === true;
    const retargeted = hasEdge(graph, "calls", "function:app/use-main.ts:start", "function:app/entry.ts:runApp");
    assert.equal(retargeted || partial, true, "rename did not retarget the call or surface PARTIAL");
    assertUnique(graph);
  });

  test("ensure_fresh on a graph one commit behind does not answer until HEAD", async () => {
    const cwd = repo.cwd;
    const previous = readMeta(cwd).analyzed_sha;
    const side = readFileSync(path.join(cwd, "other/side.ts"), "utf8");
    write(cwd, "other/side.ts", `${side}\n${OTHER_ONLY}`);
    commit(cwd, ["other/side.ts"], "add other-only symbol");
    const head = git(cwd, ["rev-parse", "HEAD"]);
    assert.notEqual(head, previous);
    assert.equal(readMeta(cwd).analyzed_sha, previous);

    const report = await adapter.ensure_fresh(cwd, "app");
    assertFresh(report, head);
    assert.notEqual(report.analyzed_sha, previous);
    assert.equal(report.scope, "app");
    assert.equal(readGraph(cwd).project.gitCommitHash, head);
    assert.equal(names(readGraph(cwd)).has("otherOnlySymbol"), true);

    const hidden = await adapter.find_symbol(cwd, "otherOnlySymbol", "app");
    assertFreshQuery(hidden, head);
    assert.deepEqual(hidden.hits, []);
    const shown = await adapter.find_symbol(cwd, "otherOnlySymbol", "other");
    assertFreshQuery(shown, head);
    assert.equal(shown.hits.some((item) => item.filePath === "other/side.ts" && item.name === "otherOnlySymbol"), true);
  });

  test("uncommitted edits and untracked files are impact-only", async () => {
    const cwd = repo.cwd;
    const head = git(cwd, ["rev-parse", "HEAD"]);
    const before = hashFile(graphFile(cwd));
    write(cwd, "lib/known.ts", DIRTY);
    write(cwd, "scratch-untracked.ts", UNTRACKED);
    try {
      const impact = await adapter.impact_of_diff(cwd, { form: "worktree", projectRoot: cwd });
      assertFreshQuery(impact, head);
      assert.ok(impact.changedPaths.includes("lib/known.ts"), impact.changedPaths.join(","));
      assert.ok(impact.untrackedPaths.includes("scratch-untracked.ts"), impact.untrackedPaths.join(","));
      assert.equal(impact.hits.some((item) => item.evidence === "unmapped" && item.path === "scratch-untracked.ts"), true);
      assert.equal(impact.hits.some((item) => item.name === "dirtySymbol" || item.name === "untrackedSymbol"), false);
      assert.equal(hashFile(graphFile(cwd)), before);
      const graph = readGraph(cwd);
      assert.equal(graph.project.gitCommitHash, head);
      assert.equal(names(graph).has("knownSymbol"), true);
      assert.equal(names(graph).has("dirtySymbol"), false);
      assert.equal(names(graph).has("untrackedSymbol"), false);
    } finally {
      git(cwd, ["checkout", "--", "lib/known.ts"]);
      rmSync(path.join(cwd, "scratch-untracked.ts"), { force: true });
    }
  });

  test("truncated JSON is STALE_RECOVERABLE and rebuilds", async () => {
    const cwd = repo.cwd;
    const head = git(cwd, ["rev-parse", "HEAD"]);
    writeFileSync(graphFile(cwd), "{");
    const report = await adapter.ensure_fresh(cwd);
    assert.equal(report.status, "STALE_RECOVERABLE");
    assert.equal(report.reason, "corrupt-json");
    assert.equal(report.rebuilt, true);
    assert.equal(report.analyzed_sha, head);
    assert.equal(report.head, head);
    const graph = readGraph(cwd);
    assert.equal(graph.project.gitCommitHash, head);
    assert.equal(names(graph).has("knownSymbol"), true);
    assert.equal(names(graph).has("runApp"), true);
  });

  test("a bumped assembler_version full-rebuilds", async () => {
    const cwd = repo.cwd;
    const head = git(cwd, ["rev-parse", "HEAD"]);
    const graph = readGraph(cwd);
    const symbol = graph.nodes.find((node) => node.id === "function:lib/known.ts:knownSymbol");
    assert.ok(symbol, "knownSymbol missing before the version bump");
    symbol.summary = "SENTINEL";
    writeFileSync(graphFile(cwd), `${JSON.stringify(graph, null, 2)}\n`);
    const meta = readMeta(cwd);
    meta.assembler_version = "999";
    writeFileSync(metaFile(cwd), `${JSON.stringify(meta, null, 2)}\n`);

    const report = await adapter.ensure_fresh(cwd);
    assertFresh(report, head);
    assert.equal(report.rebuilt, true);
    assert.equal(readMeta(cwd).assembler_version, "1");
    assert.equal(existsSync(path.join(cwd, ".workflow/cache/graph/incremental-plan.json")), false);
    assert.equal(existsSync(path.join(cwd, ".workflow/cache/graph/full-scan.json")), true);
    const rebuilt = readGraph(cwd).nodes.find((node) => node.id === "function:lib/known.ts:knownSymbol");
    assert.ok(rebuilt, "full rebuild dropped knownSymbol");
    assert.notEqual(rebuilt.summary, "SENTINEL");
    assert.equal(rebuilt.summary, "knownSymbol");
  });

  test("the structural path loads no HTTP client and no model client", () => {
    assertNoModelOrHttp();
    for (const root of [
      path.join(workflowDir, "graph"),
      path.join(workflowDir, "adapters/graph"),
      path.join(vendorRoot, "core/src"),
      path.join(vendorRoot, "scripts"),
      path.join(vendorRoot, "dist"),
    ]) {
      assertNoNetworkImports(root);
    }
  });
});

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function write(cwd, rel, text) {
  const abs = path.join(cwd, rel);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, text);
}

function commit(cwd, paths, message) {
  git(cwd, ["add", "--", ...paths]);
  git(cwd, ["commit", "-m", message]);
}

function commitFiles(cwd) {
  return git(cwd, ["diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"]).split("\n").filter(Boolean).sort();
}

function insertAfter(cwd, rel, needle, insertion) {
  const abs = path.join(cwd, rel);
  const text = readFileSync(abs, "utf8");
  const at = text.indexOf(needle);
  if (at === -1) throw new Error(`missing insertion point in ${rel}`);
  writeFileSync(abs, `${text.slice(0, at + needle.length)}${insertion}${text.slice(at + needle.length)}`);
}

function graphFile(cwd) {
  return path.join(cwd, ".workflow/graph/knowledge-graph.json");
}

function metaFile(cwd) {
  return path.join(cwd, ".workflow/graph/meta.json");
}

function readGraph(cwd) {
  return JSON.parse(readFileSync(graphFile(cwd), "utf8"));
}

function readMeta(cwd) {
  return JSON.parse(readFileSync(metaFile(cwd), "utf8"));
}

function readFingerprints(cwd) {
  return JSON.parse(readFileSync(path.join(cwd, ".workflow/graph/fingerprints.json"), "utf8"));
}

function readPlan(cwd) {
  return JSON.parse(readFileSync(path.join(cwd, ".workflow/cache/graph/incremental-plan.json"), "utf8"));
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function hashFile(filePath) {
  return sha256(readFileSync(filePath));
}

function names(graph) {
  return new Set(graph.nodes.map((node) => node.name));
}

function ids(graph) {
  return new Set(graph.nodes.map((node) => node.id));
}

function namesOf(nodes) {
  return nodes.map((node) => node.name).join(",");
}

function lineRange(graph, id) {
  const node = graph.nodes.find((item) => item.id === id);
  return node?.lineRange?.join(":") ?? "";
}

function layerNames(graph) {
  return (graph.layers ?? []).map((layer) => layer.name);
}

function hasEdge(graph, type, source, target) {
  return graph.edges.some((edge) => edge.type === type && edge.source === source && edge.target === target);
}

function topology(graph) {
  return JSON.stringify({
    nodes: graph.nodes.map((node) => node.id).sort(),
    edges: graph.edges.map((edge) => `${edge.type}\0${edge.source}\0${edge.target}`).sort(),
  });
}

function assertUnique(graph) {
  const list = graph.nodes.map((node) => node.id);
  assert.equal(new Set(list).size, list.length, "duplicate node ids");
}

function assertFresh(report, head) {
  assert.ok(report.status === "AVAILABLE" || report.status === "PARTIAL", `${report.status} ${report.reason ?? ""}`);
  assert.equal(report.analyzed_sha, head);
  assert.equal(report.head, head);
}

function assertFreshQuery(result, head) {
  assert.ok(result.status === "AVAILABLE" || result.status === "PARTIAL", `${result.status} ${result.reason ?? ""}`);
  assert.equal(result.analyzed_sha, head);
}

function isHttpClient(entry) {
  const normalized = entry.replaceAll("\\", "/");
  if (/(?:^|[\s/])node:https?(?:$|[\s.])/i.test(normalized)) return true;
  if (/(?:^|[\s/])node:http2(?:$|[\s.])/i.test(normalized)) return true;
  if (/(?:^|[\s/])https?(?:\.js)?$/i.test(normalized)) return true;
  if (/(?:^|[\s/])http2(?:\.js)?$/i.test(normalized)) return true;
  return /undici|axios|node-fetch|superagent/i.test(normalized);
}

function assertNoModelOrHttp() {
  const hits = process.moduleLoadList.filter((entry) => isHttpClient(entry) || /llm-analyzer|openai|anthropic|api\.figma\.com/i.test(entry));
  assert.deepEqual(hits, []);
}

function assertNoNetworkImports(dir) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules") continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      assertNoNetworkImports(full);
      continue;
    }
    if (!/\.(mjs|cjs|js|ts)$/.test(name)) continue;
    const text = readFileSync(full, "utf8");
    assert.equal(text.includes("api.figma.com"), false, full);
    assert.doesNotMatch(text, /require\(\s*["'](?:node:)?https?["']\s*\)/, full);
    assert.doesNotMatch(text, /require\(\s*["'](?:node:)?http2["']\s*\)/, full);
    for (const line of importLines(text)) {
      assert.doesNotMatch(line, /["'](?:node:)?https?["']/, `${full}: ${line}`);
      assert.doesNotMatch(line, /["'](?:node:)?http2["']/, `${full}: ${line}`);
      assert.doesNotMatch(line, /undici|axios|node-fetch|llm-analyzer|openai|@anthropic/, `${full}: ${line}`);
    }
  }
}

function importLines(text) {
  return text.split("\n").filter((line) => /^\s*import\s/.test(line) || /^\s*export\s.+from\s/.test(line));
}

function walkVendor(dir, out) {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist") continue;
    const full = path.join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (FORBIDDEN_DIRS.has(name)) out.dirs.push(full);
      walkVendor(full, out);
      continue;
    }
    if (FORBIDDEN_FILES.has(name)) out.files.push(full);
  }
}
