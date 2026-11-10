/**
 * store and reconcile.
 *
 * Equal SHA does not rebuild. One commit behind does not answer until
 * analyzed_sha matches HEAD. Corrupt JSON returns STALE_RECOVERABLE and
 * rebuilds. Git failure is not fresh.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs";
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

for (const name of ["assemble.ts", "store.ts", "reconcile.ts"]) {
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

const { ensure_fresh } = await import(pathToFileURL(path.join(workflowDir, "graph/reconcile.js")).href);
const { sanitiseFilePaths, GRAPH_SCHEMA, PARSER_VERSION } = await import(
  pathToFileURL(path.join(workflowDir, "graph/store.js")).href
);
const { ASSEMBLER_VERSION } = await import(pathToFileURL(path.join(workflowDir, "graph/assemble.js")).href);

const LIB = `export function knownSymbol(): number {\n  return 1;\n}\n`;
const APP = `import { knownSymbol } from "./lib";\n\nexport function main(): number {\n  return knownSymbol();\n}\n`;

function git(cwd, args) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

function initRepo() {
  const cwd = mkdtempSync(path.join(tmpdir(), "produktiv-graph-store-"));
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

function commitSources(cwd, message) {
  git(cwd, ["add", "src"]);
  git(cwd, ["commit", "-m", message]);
}

function graphFile(cwd) {
  return path.join(cwd, ".workflow/graph/knowledge-graph.json");
}

function metaFile(cwd) {
  return path.join(cwd, ".workflow/graph/meta.json");
}

function fingerprintFile(cwd) {
  return path.join(cwd, ".workflow/graph/fingerprints.json");
}

function readGraph(cwd) {
  return JSON.parse(readFileSync(graphFile(cwd), "utf8"));
}

function readMeta(cwd) {
  return JSON.parse(readFileSync(metaFile(cwd), "utf8"));
}

function hashFile(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function snapshot(cwd) {
  return {
    graph: hashFile(graphFile(cwd)),
    meta: hashFile(metaFile(cwd)),
    fingerprints: hashFile(fingerprintFile(cwd)),
    scratch: statSync(path.join(cwd, ".workflow/cache/graph")).mtimeMs,
  };
}

describe("store and reconcile", { concurrency: false }, () => {
  test("path sanitizing matches the upstream filePath rules", () => {
    const root = path.join(tmpdir(), "produktiv-graph-sanitise");
    const graph = {
      nodes: [
        { filePath: "src/lib.ts" },
        { filePath: path.join(root, "src/app.ts") },
        { filePath: path.join(root, "..", "outside.ts") },
        { name: "no-path" },
      ],
    };
    const sanitised = sanitiseFilePaths(graph, root);
    assert.equal(sanitised.nodes[0].filePath, "src/lib.ts");
    assert.equal(sanitised.nodes[1].filePath.split(path.sep).join("/"), "src/app.ts");
    assert.equal(sanitised.nodes[2].filePath, "outside.ts");
    assert.equal(sanitised.nodes[3].name, "no-path");
    assert.equal(graph.nodes[1].filePath, path.join(root, "src/app.ts"));
  });

  test("ensure_fresh does not call getChangedFiles", () => {
    const source = readFileSync(path.join(workflowDir, "graph/reconcile.ts"), "utf8");
    assert.equal(/\bgetChangedFiles\s*\(/.test(source), false);
  });

  test("missing graph is unavailable until setup or the eval", { timeout: 180_000 }, async () => {
    const cwd = initRepo();
    try {
      write(cwd, "src/lib.ts", LIB);
      commitSources(cwd, "initial");
      const withheld = await ensure_fresh(cwd, "src/lib.ts");
      assert.equal(withheld.status, "UNAVAILABLE");
      assert.equal(withheld.reason, "missing-graph");
      assert.equal(withheld.scope, "src/lib.ts");
      assert.equal(existsSync(graphFile(cwd)), false);

      const built = await ensure_fresh(cwd, undefined, "eval");
      assert.equal(built.status, "AVAILABLE");
      assert.equal(built.analyzed_sha, git(cwd, ["rev-parse", "HEAD"]));
      assert.equal(readMeta(cwd).assembler_version, ASSEMBLER_VERSION);
      assert.equal(readMeta(cwd).graph_schema, GRAPH_SCHEMA);
      assert.equal(readMeta(cwd).parser_version, PARSER_VERSION);
      assert.equal(readMeta(cwd).project_root_realpath, realpathSync(cwd));
      assert.equal(readMeta(cwd).analyzed_sha, readGraph(cwd).project.gitCommitHash);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test("equal SHA does not rebuild and does not read the worktree", { timeout: 180_000 }, async () => {
    const cwd = initRepo();
    try {
      write(cwd, "src/lib.ts", LIB);
      write(cwd, "src/app.ts", APP);
      commitSources(cwd, "initial");
      const head = git(cwd, ["rev-parse", "HEAD"]);
      const built = await ensure_fresh(cwd, "src/ignored-scope", "eval");
      assert.equal(built.status, "AVAILABLE");
      assert.equal(built.analyzed_sha, head);
      assert.equal(built.rebuilt, true);
      const names = nodeNames(readGraph(cwd));
      assert.equal(names.has("knownSymbol"), true);
      assert.equal(names.has("main"), true);

      const before = snapshot(cwd);
      write(cwd, "src/lib.ts", "export function dirtySymbol(): number {\n  return 9;\n}\n");
      write(cwd, "untracked.ts", "export function untrackedSymbol(): number {\n  return 0;\n}\n");
      const again = await ensure_fresh(cwd, "src/ignored-scope", "eval");
      assert.equal(again.status, "AVAILABLE");
      assert.equal(again.analyzed_sha, head);
      assert.equal(again.head, head);
      assert.equal(again.rebuilt, false);
      assert.deepEqual(snapshot(cwd), before);
      const after = nodeNames(readGraph(cwd));
      assert.equal(after.has("knownSymbol"), true);
      assert.equal(after.has("dirtySymbol"), false);
      assert.equal(after.has("untrackedSymbol"), false);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test("one commit behind does not answer until analyzed_sha matches HEAD", { timeout: 180_000 }, async () => {
    const cwd = initRepo();
    try {
      write(cwd, "src/lib.ts", LIB);
      write(cwd, "src/app.ts", APP);
      commitSources(cwd, "initial");
      const first = await ensure_fresh(cwd, undefined, "eval");
      const previous = git(cwd, ["rev-parse", "HEAD"]);
      assert.equal(first.analyzed_sha, previous);

      write(cwd, "src/lib.ts", `${LIB}\nexport function addedSymbol(): number {\n  return 2;\n}\n`);
      commitSources(cwd, "add symbol");
      const head = git(cwd, ["rev-parse", "HEAD"]);
      assert.notEqual(head, previous);
      write(cwd, "src/app.ts", "export function dirtySymbol(): number {\n  return 3;\n}\n");
      write(cwd, "untracked.ts", "export function untrackedSymbol(): number {\n  return 4;\n}\n");

      const report = await ensure_fresh(cwd, "vendor/other");
      assert.equal(report.scope, "vendor/other");
      assert.equal(report.analyzed_sha, head);
      assert.notEqual(report.analyzed_sha, previous);
      assert.equal(report.head, head);
      assert.ok(report.status === "AVAILABLE" || report.status === "PARTIAL", report.status);
      const graph = readGraph(cwd);
      assert.equal(graph.project.gitCommitHash, head);
      assert.equal(readMeta(cwd).analyzed_sha, head);
      const names = nodeNames(graph);
      assert.equal(names.has("knownSymbol"), true);
      assert.equal(names.has("addedSymbol"), true);
      assert.equal(names.has("dirtySymbol"), false);
      assert.equal(names.has("untrackedSymbol"), false);
      assert.equal(graph.edges.some((edge) => (
        edge.type === "imports"
        && edge.source === "file:src/app.ts"
        && edge.target === "file:src/lib.ts"
      )), true);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test("corrupt JSON returns STALE_RECOVERABLE and rebuilds", { timeout: 180_000 }, async () => {
    const cwd = initRepo();
    try {
      write(cwd, "src/lib.ts", LIB);
      write(cwd, "src/app.ts", APP);
      commitSources(cwd, "initial");
      await ensure_fresh(cwd, undefined, "eval");
      const head = git(cwd, ["rev-parse", "HEAD"]);
      writeFileSync(graphFile(cwd), "{");

      const report = await ensure_fresh(cwd, "src/lib.ts");
      assert.equal(report.status, "STALE_RECOVERABLE");
      assert.equal(report.reason, "corrupt-json");
      assert.equal(report.rebuilt, true);
      assert.equal(report.analyzed_sha, head);
      const graph = readGraph(cwd);
      assert.equal(graph.project.gitCommitHash, head);
      assert.equal(nodeNames(graph).has("knownSymbol"), true);

      const again = await ensure_fresh(cwd, "src/lib.ts");
      assert.equal(again.status, "AVAILABLE");
      assert.equal(again.analyzed_sha, head);
      assert.equal(again.rebuilt, false);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test("an incompatible assembler_version full-rebuilds", { timeout: 180_000 }, async () => {
    const cwd = initRepo();
    try {
      write(cwd, "src/lib.ts", LIB);
      commitSources(cwd, "initial");
      await ensure_fresh(cwd, undefined, "eval");
      const head = git(cwd, ["rev-parse", "HEAD"]);
      const meta = readMeta(cwd);
      meta.assembler_version = "999";
      writeFileSync(metaFile(cwd), `${JSON.stringify(meta, null, 2)}\n`);

      const report = await ensure_fresh(cwd);
      assert.equal(report.rebuilt, true);
      assert.equal(report.analyzed_sha, head);
      assert.ok(report.status === "AVAILABLE" || report.status === "PARTIAL");
      assert.equal(readMeta(cwd).assembler_version, ASSEMBLER_VERSION);
      assert.equal(readGraph(cwd).project.gitCommitHash, head);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });

  test("git failure is not fresh", { timeout: 180_000 }, async () => {
    const cwd = initRepo();
    try {
      write(cwd, "src/lib.ts", LIB);
      commitSources(cwd, "initial");
      await ensure_fresh(cwd, undefined, "eval");
      const before = hashFile(graphFile(cwd));
      const stored = readMeta(cwd).analyzed_sha;
      rmSync(path.join(cwd, ".git"), { recursive: true, force: true });

      const report = await ensure_fresh(cwd, "src/lib.ts");
      assert.equal(report.status, "UNAVAILABLE");
      assert.equal(report.reason, "git-head-unavailable");
      assert.notEqual(report.status, "AVAILABLE");
      assert.notEqual(report.status, "PARTIAL");
      assert.equal(hashFile(graphFile(cwd)), before);
      assert.equal(readMeta(cwd).analyzed_sha, stored);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
});

function nodeNames(graph) {
  return new Set(graph.nodes.map((node) => node.name));
}
