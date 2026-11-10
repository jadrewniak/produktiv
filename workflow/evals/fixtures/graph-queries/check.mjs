/**
 * queries, impact, and neighborhood.
 *
 * Four-file graph: a caller is found, a path stops at the depth cap and
 * says so, an unmapped path is a coverage gap, and comment-only
 * classification is not this unit's job.
 */

import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, test } from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const workflowDir = path.join(repoRoot, "workflow");
const tsc = path.join(workflowDir, "vendor/understand-anything/node_modules/typescript/bin/tsc");

execFileSync(process.execPath, [tsc, "-p", path.join(workflowDir, "tsconfig.json"), "--noEmit"], {
  cwd: workflowDir,
  stdio: "inherit",
});

const require = createRequire(import.meta.url);
const ts = require("../../../vendor/understand-anything/node_modules/typescript/lib/typescript.js");

for (const name of ["neighborhood.ts", "queries.ts", "impact.ts"]) {
  const sourcePath = path.join(workflowDir, "graph", name);
  const transpiled = ts.transpileModule(readFileSync(sourcePath, "utf8"), {
    fileName: sourcePath,
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  });
  writeFileSync(path.join(workflowDir, "graph", name.replace(/\.ts$/, ".js")), transpiled.outputText);
}

const queries = await import(pathToFileURL(path.join(workflowDir, "graph/queries.js")).href);
const neighborhood = await import(pathToFileURL(path.join(workflowDir, "graph/neighborhood.js")).href);
const impactApi = await import(pathToFileURL(path.join(workflowDir, "graph/impact.js")).href);
const { V1_IGNORE_PATTERNS } = await import(
  pathToFileURL(path.join(workflowDir, "vendor/understand-anything/scripts/head-source.mjs")).href
);

const {
  find_symbol,
  related,
  callers,
  callees,
  dependencies,
  dependents,
  paths,
  component,
  architecture_overview,
  DEFAULT_RELATED_DEPTH,
  DEFAULT_CALLERS_DEPTH,
  DEFAULT_CALLEES_DEPTH,
  DEFAULT_DEPENDENCIES_DEPTH,
  DEFAULT_DEPENDENTS_DEPTH,
  DEFAULT_PATH_DEPTH,
  STRUCTURAL_EDGE_TYPES,
} = queries;

const { impact_of_diff, DEFAULT_IMPACT_DEPTH, WORKTREE_IGNORE_PATTERNS, EVIDENCE } = impactApi;

const fileA = "file:a.ts";
const fileB = "file:b.ts";
const fileC = "file:c.ts";
const fileD = "file:d.ts";
const fnA = "fn:a";
const fnB = "fn:b";
const fnC = "fn:c";
const fnD = "fn:d";
const classBase = "class:base";
const job = "job:nightly";

function node(id, type, name, filePath, extra = {}) {
  return {
    id,
    type,
    name,
    filePath,
    summary: extra.summary ?? name,
    tags: extra.tags ?? [],
    complexity: "moderate",
  };
}

function edge(source, target, type) {
  return { source, target, type, direction: "forward", weight: 1 };
}

function makeGraph(nodes, edges, extra = {}) {
  return {
    version: "1.0.0",
    project: {
      name: extra.name ?? "four",
      languages: extra.languages ?? ["typescript"],
      frameworks: extra.frameworks ?? [],
      description: "",
      analyzedAt: "2026-01-01T00:00:00.000Z",
      gitCommitHash: "abc",
    },
    nodes,
    edges,
    layers: extra.layers ?? [],
    tour: [],
  };
}

function fourFileGraph() {
  return makeGraph(
    [
      node(fileA, "file", "a.ts", "a.ts"),
      node(fnA, "function", "alpha", "a.ts", { summary: "adds one", tags: ["hot"] }),
      node(fileB, "file", "b.ts", "b.ts"),
      node(fnB, "function", "beta", "b.ts"),
      node(fileC, "file", "c.ts", "c.ts"),
      node(fnC, "function", "gamma", "c.ts"),
      node(fileD, "file", "d.ts", "d.ts"),
      node(fnD, "function", "delta", "d.ts"),
      node(classBase, "class", "Base", "base.ts"),
      node(job, "concept", "Nightly", "job.ts"),
    ],
    [
      edge(fileA, fnA, "contains"),
      edge(fileB, fnB, "contains"),
      edge(fileC, fnC, "contains"),
      edge(fileD, fnD, "contains"),
      edge(fnB, fnA, "calls"),
      edge(fnC, fnB, "calls"),
      edge(fnD, fnC, "calls"),
      edge(fileB, fileA, "imports"),
      edge(fileC, fileB, "imports"),
      edge(fileD, fileC, "imports"),
      edge(fnA, classBase, "inherits"),
      edge(fnA, job, "triggers"),
      edge(fileA, fileD, "documents"),
    ],
    {
      layers: [
        {
          id: "layer:llm",
          name: "LLM",
          description: "prose layer that queries must ignore",
          nodeIds: [fileB],
        },
      ],
    },
  );
}

function ids(nodes) {
  return nodes.map((item) => item.id);
}

function unique(list) {
  assert.equal(new Set(list).size, list.length);
}

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function initRepo() {
  const cwd = mkdtempSync(path.join(tmpdir(), "produktiv-graph-queries-"));
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

describe("queries, impact, and neighborhood", { concurrency: false }, () => {
  test("defaults, structural edges, and the dropped formatters", () => {
    assert.equal(DEFAULT_RELATED_DEPTH, 1);
    assert.equal(DEFAULT_CALLERS_DEPTH, 2);
    assert.equal(DEFAULT_CALLEES_DEPTH, 2);
    assert.equal(DEFAULT_DEPENDENCIES_DEPTH, 2);
    assert.equal(DEFAULT_DEPENDENTS_DEPTH, 2);
    assert.equal(DEFAULT_PATH_DEPTH, 6);
    assert.equal(DEFAULT_IMPACT_DEPTH, 2);
    assert.equal(queries.related, neighborhood.related);
    assert.deepEqual(
      [...STRUCTURAL_EDGE_TYPES].sort(),
      ["calls", "contains", "exports", "implements", "imports", "inherits"].sort(),
    );
    assert.equal(STRUCTURAL_EDGE_TYPES.has("documents"), false);
    assert.equal(STRUCTURAL_EDGE_TYPES.has("triggers"), false);
    assert.equal("formatDiffAnalysis" in impactApi, false);
    assert.equal("formatExplainPrompt" in neighborhood, false);
    assert.equal("domain_slice" in queries, false);
    assert.equal("hotspots" in queries, false);
    assert.equal("semantic_search" in queries, false);
    assert.deepEqual([...WORKTREE_IGNORE_PATTERNS], [...V1_IGNORE_PATTERNS]);

    for (const name of ["neighborhood.ts", "queries.ts", "impact.ts"]) {
      const source = readFileSync(path.join(workflowDir, "graph", name), "utf8");
      assert.match(source, /6df3065f1d8ddc2ce3615314d1d493f36d6b1c80/);
      assert.doesNotMatch(source, /classifyUpdate|change-classifier|formatDiffAnalysis|formatExplainPrompt/);
      assert.doesNotMatch(source, /buildLayerDetectionPrompt|applyLLMLayers|fuse|saveGraph|writeFileSync|llm-analyzer|figma/);
      assert.doesNotMatch(source, /no impact/);
      assert.doesNotMatch(source, /from "node:fs"/);
    }
  });

  test("find_symbol is an exact id, path, and name index", () => {
    const graph = fourFileGraph();
    const byId = find_symbol(graph, fnA);
    assert.equal(byId.length, 1);
    assert.deepEqual(byId[0].matchedBy, ["id"]);

    const byName = find_symbol(graph, "alpha");
    assert.deepEqual(ids(byName), [fnA]);
    assert.deepEqual(byName[0].matchedBy, ["name"]);

    const byPath = find_symbol(graph, "a.ts");
    assert.deepEqual(ids(byPath), [fileA, fnA]);
    assert.deepEqual(byPath[0].matchedBy, ["filePath", "name"]);
    assert.deepEqual(byPath[1].matchedBy, ["filePath"]);

    assert.deepEqual(find_symbol(graph, "adds one"), []);
    assert.deepEqual(find_symbol(graph, "hot"), []);
    assert.deepEqual(find_symbol(graph, "alph"), []);
    assert.deepEqual(find_symbol(graph, "Alpha"), []);
    assert.deepEqual(find_symbol(graph, ""), []);
  });

  test("a caller is found, and the default call depth stops at 2", () => {
    const graph = fourFileGraph();
    const found = callers(graph, fnA);
    assert.deepEqual(ids(found.nodes), [fnB, fnC]);
    assert.equal(found.depth, 2);
    assert.equal(found.originId, fnA);
    assert.equal(found.nodes.some((item) => item.id === fnB), true);
    assert.equal(found.nodes.some((item) => item.id === fnD), false);
    assert.equal(found.depthCapped, true);
    assert.match(found.note, /depth cap 2/);
    unique(found.visited);
    assert.equal(found.visited[0], fnA);
    assert.ok(found.edges.every((item) => item.type === "calls"));

    const one = callers(graph, fnA, 1);
    assert.deepEqual(ids(one.nodes), [fnB]);

    const downward = callees(graph, fnD);
    assert.deepEqual(ids(downward.nodes), [fnC, fnB]);
    assert.equal(downward.nodes.some((item) => item.id === fnA), false);
    assert.equal(downward.depthCapped, true);
  });

  test("dependencies roll up to files and use depends_on only when that edge exists", () => {
    const graph = fourFileGraph();
    const deps = dependencies(graph, fnB);
    assert.deepEqual(ids(deps.nodes), [fileA]);
    assert.ok(deps.edges.every((item) => item.type === "imports"));
    assert.equal(deps.visited.includes(fnB), true);
    assert.equal(deps.visited.includes(fileB), true);

    const users = dependents(graph, fnA);
    assert.deepEqual(ids(users.nodes), [fileB, fileC]);
    assert.equal(users.nodes.some((item) => item.id === fileD), false);
    assert.equal(users.depthCapped, true);
    unique(users.visited);

    const onlyDepends = makeGraph(
      [
        node(fileA, "file", "a.ts", "a.ts"),
        node(fnA, "function", "alpha", "a.ts"),
        node(fileB, "file", "b.ts", "b.ts"),
        node(fnB, "function", "beta", "b.ts"),
      ],
      [edge(fileA, fnA, "contains"), edge(fileB, fnB, "contains"), edge(fileB, fileA, "depends_on")],
    );
    assert.deepEqual(ids(dependencies(onlyDepends, fnB).nodes), [fileA]);
    assert.equal(dependencies(onlyDepends, fnB).edges[0].type, "depends_on");
  });

  test("a path stops at the depth cap and says so", () => {
    const graph = fourFileGraph();
    const stopped = paths(graph, fnD, fnA, 2);
    assert.equal(stopped.paths.length, 0);
    assert.equal(stopped.depthCapped, true);
    assert.equal(stopped.maxDepth, 2);
    assert.match(stopped.note, /depth cap 2/);
    assert.equal(stopped.note.includes("no structural path"), false);
    assert.equal(stopped.visited.includes(fnA), false);
    assert.equal(stopped.visited.includes(fnD), true);
    assert.equal(stopped.status, "PARTIAL");
    unique(stopped.visited);

    const found = paths(graph, fnD, fnA);
    assert.equal(found.maxDepth, DEFAULT_PATH_DEPTH);
    assert.equal(found.depthCapped, false);
    assert.equal(found.note, undefined);
    assert.equal(found.status, "AVAILABLE");
    assert.equal(found.paths.length, 1);
    assert.deepEqual(found.paths[0].nodeIds, [fnD, fnC, fnB, fnA]);
    assert.equal(found.paths[0].depth, 3);
    unique(found.visited);

    const same = paths(graph, fnA, fnA, 0);
    assert.deepEqual(same.paths[0].nodeIds, [fnA]);
    assert.equal(same.depthCapped, false);
  });

  test("related walks structural edges and keeps contains children in the seed", () => {
    const graph = fourFileGraph();
    const near = related(graph, fnB);
    assert.equal(near.depth, 1);
    assert.deepEqual(ids(near.nodes).sort(), [fileB, fnA, fnC].sort());
    assert.equal(near.nodes.some((item) => item.id === fnD), false);
    assert.equal(near.nodes.some((item) => item.id === job), false);
    assert.equal(near.nodes.some((item) => item.id === fileD), false);
    assert.equal(near.target.id, fnB);
    unique(near.visited);

    const wider = related(graph, fnB, 2);
    assert.equal(wider.nodes.some((item) => item.id === fnD), true);

    const file = related(graph, fileA, 1);
    assert.equal(file.nodes.some((item) => item.id === fnA), true);
    assert.equal(file.nodes.some((item) => item.id === fnB), true);
    assert.equal(file.nodes.some((item) => item.id === job), false);
    assert.equal(file.nodes.some((item) => item.id === fileD), false);
    assert.equal(file.layer.name, "Core");
    assert.equal(file.layer.id, "layer:core");

    const named = related(graph, "a.ts:alpha");
    assert.equal(named.target.id, fnA);
    assert.equal(named.nodes.some((item) => item.id === classBase), true);
    assert.equal(named.nodes.some((item) => item.id === job), false);
  });

  test("component is the file, its contains children, and the heuristic layer", () => {
    const graph = fourFileGraph();
    const slice = component(graph, fnB);
    assert.equal(slice.file.id, fileB);
    assert.deepEqual(ids(slice.children), [fnB]);
    assert.equal(slice.layer.name, "Core");
    assert.equal(slice.layer.id, "layer:core");
    assert.equal(graph.layers[0].name, "LLM");
    assert.equal(slice.status, "AVAILABLE");

    const missing = component(graph, "nope");
    assert.equal(missing.file, null);
    assert.equal(missing.reason, "target-not-found");
  });

  test("architecture overview reports layers, import degree, and keyword frameworks", () => {
    const flat = fourFileGraph();
    const partial = architecture_overview(flat);
    assert.equal(partial.status, "PARTIAL");
    assert.equal(partial.reason, "most-files-unlayered");
    assert.equal(partial.fileCount, 4);
    assert.ok(partial.unlayeredFiles * 2 > partial.fileCount);
    assert.equal(partial.layers.some((layer) => layer.name === "Core"), true);
    assert.deepEqual(
      partial.topImports.map((row) => row.id),
      [fileA, fileB, fileC],
    );
    assert.deepEqual(partial.languages, ["typescript"]);
    assert.deepEqual(partial.frameworks, []);

    const detected = architecture_overview(flat, undefined, {
      "package.json": '{ "dependencies": { "react": "18.3.1" } }',
    });
    assert.deepEqual(detected.frameworks, ["react"]);

    const half = makeGraph(
      [node("file:b.ts", "file", "b.ts", "b.ts"), node("file:api/handler.ts", "file", "handler.ts", "api/handler.ts")],
      [],
    );
    const halfOverview = architecture_overview(half);
    assert.equal(halfOverview.fileCount, 2);
    assert.equal(halfOverview.unlayeredFiles, 1);
    assert.equal(halfOverview.status, "AVAILABLE");

    const api = "file:api/handler.ts";
    const lib = "file:lib/util.ts";
    const endpoint = "endpoint:api/handler.ts:GET /items";
    const layered = makeGraph(
      [
        node(api, "file", "handler.ts", "api/handler.ts"),
        node(endpoint, "endpoint", "GET /items", "api/handler.ts"),
        node(lib, "file", "util.ts", "lib/util.ts"),
        node("service:api/handler.ts:api", "service", "api", "api/handler.ts"),
      ],
      [edge(api, endpoint, "contains"), edge(api, lib, "imports")],
      { languages: ["typescript"], frameworks: ["stored"] },
    );
    const overview = architecture_overview(layered);
    assert.equal(overview.status, "AVAILABLE");
    assert.equal(overview.reason, undefined);
    assert.deepEqual(
      overview.layers.map((layer) => layer.name).sort(),
      ["API Layer", "Utility Layer"],
    );
    assert.deepEqual(ids(overview.endpoints), [endpoint]);
    assert.deepEqual(ids(overview.services), ["service:api/handler.ts:api"]);
    assert.equal(overview.topImports[0].id, lib);
    assert.equal(overview.topImports[0].inDegree, 1);
    assert.deepEqual(overview.frameworks, ["stored"]);

    const scoped = architecture_overview(layered, "lib");
    assert.equal(scoped.fileCount, 1);
    assert.deepEqual(ids(scoped.endpoints), []);
    assert.equal(scoped.topImports[0].id, lib);
    assert.equal(scoped.status, "AVAILABLE");
  });

  test("an unmapped path is a coverage gap, and structural impact stops at depth 2", async () => {
    const graph = fourFileGraph();
    const before = JSON.stringify(graph);

    const unmapped = await impact_of_diff(graph, { form: "paths", paths: ["missing.ts"] });
    assert.equal(unmapped.status, "PARTIAL");
    assert.deepEqual(unmapped.unmappedPaths, ["missing.ts"]);
    assert.equal(unmapped.hits.length, 1);
    assert.equal(unmapped.hits[0].evidence, EVIDENCE.unmapped);
    assert.equal(unmapped.hits[0].path, "missing.ts");
    assert.equal(JSON.stringify(unmapped).includes("no impact"), false);
    assert.equal(Object.hasOwn(unmapped, "classification"), false);
    assert.equal(JSON.stringify(graph), before);

    const empty = await impact_of_diff(graph, { form: "paths", paths: [] });
    assert.equal(empty.status, "AVAILABLE");
    assert.equal(empty.hits.length, 0);

    const report = await impact_of_diff(graph, { form: "paths", paths: ["a.ts", "missing.ts", "a.ts"] });
    assert.equal(report.status, "PARTIAL");
    assert.deepEqual(report.changedPaths, ["a.ts", "missing.ts"]);
    assert.equal(report.depth, 2);
    assert.equal(report.depthCapped, true);
    assert.match(report.depthNote, /depth cap 2/);
    assert.match(report.depthNote, /omitted/);

    const evidence = new Map(report.hits.filter((hit) => hit.nodeId).map((hit) => [hit.nodeId, hit.evidence]));
    assert.equal(evidence.get(fileA), EVIDENCE.directlyChanged);
    assert.equal(evidence.get(fnA), EVIDENCE.directlyChanged);
    assert.equal(evidence.get(fnB), EVIDENCE.structurallyImpacted);
    assert.equal(evidence.get(classBase), EVIDENCE.structurallyImpacted);
    assert.deepEqual(
      report.hits.find((hit) => hit.nodeId === fnB).via,
      [fnA, fnB],
    );
    assert.equal(evidence.get(job), EVIDENCE.semanticImpact);
    assert.equal(evidence.has(fnD), false);
    assert.equal(evidence.has(fileD), false);
    assert.equal(
      report.hits.some((hit) => hit.evidence === EVIDENCE.unmapped && hit.path === "missing.ts"),
      true,
    );
    assert.equal(JSON.stringify(graph), before);
    assert.equal(JSON.stringify(report).includes("no impact"), false);

    const shallow = await impact_of_diff(graph, { form: "paths", paths: ["a.ts"] }, undefined, 1);
    const shallowIds = new Set(shallow.hits.map((hit) => hit.nodeId).filter(Boolean));
    assert.equal(shallowIds.has(fnB), true);
    assert.equal(shallowIds.has(fnC), false);
    assert.equal(shallow.depthCapped, true);
  });

  test("comment-only classification is not this unit's job", async () => {
    const graph = fourFileGraph();
    const report = await impact_of_diff(graph, { form: "paths", paths: ["a.ts"] });
    assert.equal(report.hits.some((hit) => hit.nodeId === fnA && hit.evidence === EVIDENCE.directlyChanged), true);
    assert.equal(Object.hasOwn(report, "classification"), false);
    assert.equal(report.hits.every((hit) => !Object.hasOwn(hit, "classification")), true);

    const cwd = initRepo();
    try {
      write(cwd, "a.ts", "export function alpha() {\n  return 1;\n}\n");
      write(cwd, "b.ts", "export function beta() {\n  return 1;\n}\n");
      git(cwd, ["add", "."]);
      git(cwd, ["commit", "-m", "initial"]);
      write(cwd, "a.ts", "export function alpha() {\n  return 1;\n}\n// comment only\n");
      const dirty = await impact_of_diff(graph, { form: "worktree", projectRoot: cwd });
      assert.equal(dirty.changedPaths.includes("a.ts"), true);
      assert.equal(dirty.hits.some((hit) => hit.nodeId === fnA && hit.evidence === EVIDENCE.directlyChanged), true);
      assert.equal(Object.hasOwn(dirty, "classification"), false);
      assert.equal(existsSync(path.join(cwd, ".workflow/graph/knowledge-graph.json")), false);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test("worktree impact reports dirty and untracked paths and does not write the graph", async () => {
    const graph = fourFileGraph();
    const before = JSON.stringify(graph);
    const cwd = initRepo();
    try {
      write(cwd, "a.ts", "export const value = 1;\n");
      write(cwd, "b.ts", "export const other = 1;\n");
      git(cwd, ["add", "."]);
      git(cwd, ["commit", "-m", "initial"]);
      write(cwd, "a.ts", "export const value = 2;\n");
      write(cwd, "src/extra.ts", "export const extra = 1;\n");
      write(cwd, ".env", "SECRET=1\n");
      write(cwd, ".env.example", "SECRET=\n");
      write(cwd, "src/app-secret.ts", "export const token = 1;\n");
      write(cwd, ".workflow/local/note.ts", "export const note = 1;\n");

      const report = await impact_of_diff(graph, { form: "worktree", projectRoot: cwd });
      assert.equal(report.form, "worktree");
      assert.deepEqual(report.changedPaths, ["a.ts", ".env.example", "src/extra.ts"]);
      assert.deepEqual(report.untrackedPaths, [".env.example", "src/extra.ts"]);
      assert.equal(report.changedPaths.includes(".env"), false);
      assert.equal(report.changedPaths.includes("src/app-secret.ts"), false);
      assert.equal(report.changedPaths.includes(".workflow/local/note.ts"), false);
      assert.equal(report.changedPaths.includes("b.ts"), false);
      assert.deepEqual(report.unmappedPaths, [".env.example", "src/extra.ts"]);
      assert.equal(report.status, "PARTIAL");
      assert.equal(report.hits.some((hit) => hit.nodeId === fnA && hit.evidence === EVIDENCE.directlyChanged), true);
      assert.equal(JSON.stringify(graph), before);
      assert.equal(existsSync(path.join(cwd, ".workflow/graph/knowledge-graph.json")), false);

      write(cwd, "b.ts", "export const other = 3;\n");
      git(cwd, ["add", "a.ts"]);
      const staged = await impact_of_diff(graph, { form: "staged", projectRoot: cwd });
      const worktree = await impact_of_diff(graph, { form: "worktree", projectRoot: cwd });
      assert.deepEqual(staged.changedPaths, ["a.ts"]);
      assert.equal(staged.untrackedPaths.length, 0);
      assert.equal(worktree.changedPaths.includes("b.ts"), true);
      assert.equal(worktree.changedPaths.includes("a.ts"), false);

      git(cwd, ["commit", "-m", "edit a"]);
      git(cwd, ["add", "b.ts"]);
      git(cwd, ["commit", "-m", "edit b"]);
      const ranged = await impact_of_diff(graph, { form: "range", projectRoot: cwd, range: "HEAD~1..HEAD" });
      assert.deepEqual(ranged.changedPaths, ["b.ts"]);
      assert.equal(ranged.untrackedPaths.length, 0);
      assert.equal(ranged.hits.some((hit) => hit.nodeId === fnB && hit.evidence === EVIDENCE.directlyChanged), true);
      assert.equal(ranged.changedPaths.includes("src/extra.ts"), false);
      assert.equal(JSON.stringify(graph), before);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test("scope filters impact, and refused paths are not an empty report", async () => {
    const graph = fourFileGraph();
    const scoped = await impact_of_diff(graph, { form: "paths", paths: ["a.ts", "missing.ts"] }, "a.ts");
    assert.deepEqual(scoped.changedPaths, ["a.ts"]);
    assert.deepEqual(scoped.unmappedPaths, []);
    assert.equal(scoped.status, "AVAILABLE");
    assert.equal(scoped.scope, "a.ts");
    assert.equal(scoped.hits.some((hit) => hit.filePath === "b.ts"), false);

    const normalized = await impact_of_diff(graph, { form: "paths", paths: ["src\\extra.ts"] });
    assert.deepEqual(normalized.unmappedPaths, ["src/extra.ts"]);

    await assert.rejects(() => impact_of_diff(graph, { form: "paths", paths: ["/etc/passwd"] }));
    await assert.rejects(() => impact_of_diff(graph, { form: "paths", paths: ["../secret"] }));
    assert.throws(() => paths(graph, fnA, fnD, -1), /non-negative integer/);
    assert.throws(() => architecture_overview(graph, "../secret"), /refusing scope/);
  });

  test("ambiguous names are partial, coverage can force partial, and a cycle stops", () => {
    const graph = makeGraph(
      [
        node("fn:one", "function", "run", "one.ts"),
        node("fn:two", "function", "run", "two.ts"),
        node("file:one.ts", "file", "one.ts", "one.ts"),
      ],
      [],
    );
    assert.deepEqual(ids(find_symbol(graph, "run")), ["fn:one", "fn:two"]);
    const ambiguous = related(graph, "run");
    assert.equal(ambiguous.status, "PARTIAL");
    assert.equal(ambiguous.reason, "ambiguous-target");
    assert.equal(ambiguous.target, null);

    const covered = callers(fourFileGraph(), fnA, 2, { partial: true });
    assert.equal(covered.status, "PARTIAL");
    assert.equal(covered.nodes.some((item) => item.id === fnB), true);

    const cyclic = fourFileGraph();
    cyclic.edges = [...cyclic.edges, edge(fnA, fnD, "calls")];
    const walked = related(cyclic, fnA, 8);
    unique(walked.visited);
    assert.ok(walked.visited.length < 30);
    const around = paths(cyclic, fnD, fnA, 6);
    assert.equal(around.paths.length, 1);
    unique(around.visited);
  });
});
