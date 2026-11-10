/**
 * medium benchmark and Node floor.
 *
 * One cold structural build of a medium git corpus. The timed process
 * loads workflow/vendor/understand-anything/dist and the production
 * dependencies already installed beside it. It does not invoke pnpm.
 * That is the scripted clean run, not the user installer.
 *
 * The default corpus is .upstream/understand-anything. GRAPH_MEDIUM_FIXTURE
 * overrides it. The corpus is not copied into git. A missing corpus skips
 * so CI without .upstream/ is not a product failure.
 *
 * Graph's floor is Node >= 22. This file may be launched by an older
 * binary. That binary is observed with the capability probe and must not
 * load web-tree-sitter. The measurement is spawned on Node >= 22
 * (GRAPH_NODE_BIN, or the newest nvm Node >= 22 when the launcher is older).
 * A simulated major of 20 is the floor check that does not install Node 20.
 * A host with no Node binary does not use this probe; that contract is
 * workflow/references/capabilities.md.
 *
 * Windows is not claimed.
 */

import { spawn, spawnSync, execFileSync } from "node:child_process";
import { once } from "node:events";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { probe } from "../../adapters/host/capabilities.mjs";

const evalDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(evalDir, "../../..");
const workflowDir = path.join(repoRoot, "workflow");
const vendorRoot = path.join(workflowDir, "vendor/understand-anything");
const resultsPath = path.join(evalDir, "RESULTS.md");
const MEASURE_TIMEOUT_MS = 14 * 60 * 1000;
// First successful suite run. Later runs add detail; they do not replace the ceiling.
const CEILING_WALL_TIME_MS = 26590;
const CEILING_PEAK_RSS_BYTES = 248135680;

const GRAMMAR_WASM = [
  ["tree-sitter-typescript", "tree-sitter-typescript.wasm"],
  ["tree-sitter-typescript", "tree-sitter-tsx.wasm"],
  ["tree-sitter-javascript", "tree-sitter-javascript.wasm"],
  ["tree-sitter-python", "tree-sitter-python.wasm"],
  ["tree-sitter-go", "tree-sitter-go.wasm"],
  ["tree-sitter-rust", "tree-sitter-rust.wasm"],
  ["tree-sitter-java", "tree-sitter-java.wasm"],
  ["tree-sitter-ruby", "tree-sitter-ruby.wasm"],
  ["tree-sitter-php", "tree-sitter-php.wasm"],
  ["tree-sitter-cpp", "tree-sitter-cpp.wasm"],
  ["tree-sitter-c-sharp", "tree-sitter-c_sharp.wasm"],
  ["tree-sitter-scala", "tree-sitter-scala.wasm"],
  ["@tree-sitter-grammars/tree-sitter-kotlin", "tree-sitter-kotlin.wasm"],
  ["@understand-anything/tree-sitter-dart-wasm", "tree-sitter-dart.wasm"],
  ["@understand-anything/tree-sitter-swift-wasm", "tree-sitter-swift.wasm"],
];

const TREE_SITTER_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".py", ".pyi", ".go", ".rs", ".java", ".rb", ".rake", ".php",
  ".cpp", ".cc", ".cxx", ".hpp", ".hxx", ".c", ".h", ".cs",
  ".scala", ".sc", ".kt", ".kts", ".dart", ".swift",
]);

const OTHER_PARSER_EXTENSIONS = new Set([
  ".md", ".mdx", ".yaml", ".yml", ".json", ".jsonc", ".toml",
  ".sql", ".graphql", ".gql", ".proto", ".tf", ".tfvars",
  ".sh", ".bash", ".zsh", ".mk",
]);

const EMIT = [
  "graph/assemble.ts",
  "graph/store.ts",
  "graph/reconcile.ts",
  "graph/neighborhood.ts",
  "graph/queries.ts",
  "graph/impact.ts",
  "adapters/graph/index.ts",
];

if (process.env.GRAPH_MEDIUM_WORKER === "1") {
  try {
    await runWorker();
  } catch (error) {
    console.error(error instanceof Error ? error.stack : error);
    process.exit(1);
  }
} else {
  const { test } = await import("node:test");

  test("node floor on the launching binary", async () => {
    const contract = readFileSync(path.join(workflowDir, "references/capabilities.md"), "utf8");
    assert.match(contract, /requires no Node process/);
    assert.match(contract, /optional `adapters\/host\/capabilities\.mjs` `probe\(\)`/);
    assert.match(contract, /cannot discover Node absence/);

    const live = await probe();
    assert.equal(live.node.version, process.version);
    const simulated = await probe({
      nodeVersion: "v20.20.2",
      gitAvailable: true,
      graphBundle: true,
    });
    assert.equal(simulated.node.major, 20);
    assert.equal(simulated.graph.available, false);
    assert.equal(simulated.graph.reason, "node-floor");

    if (live.node.major >= 22) return;
    assert.equal(live.graph.available, false);
    assert.equal(live.graph.reason, "node-floor");
    assert.equal(
      process.moduleLoadList.some((entry) => entry.includes("web-tree-sitter")),
      false,
      "the launching binary is below the floor and must not load web-tree-sitter",
    );
  });

  test("a missing corpus is a skip", () => {
    const resolved = resolveMediumCorpus(
      { GRAPH_MEDIUM_FIXTURE: "/no/such/medium-corpus" },
      repoRoot,
    );
    assert.equal(resolved.action, "skip");
    assert.match(resolved.message, /^skip: medium corpus absent/);
    assert.match(resolved.message, /not a product failure/);
  });

  test("the suite skips when the corpus is absent", () => {
    const env = { ...process.env, GRAPH_MEDIUM_FIXTURE: "/no/such/medium-corpus" };
    for (const key of Object.keys(env)) {
      if (key.startsWith("NODE_TEST_")) delete env[key];
    }
    const child = spawnSync(
      process.execPath,
      ["--test", "--test-name-pattern", "^medium structural build$", fileURLToPath(import.meta.url)],
      { env, encoding: "utf8" },
    );
    assert.equal(child.status, 0, `${child.stdout}\n${child.stderr}`);
    assert.match(`${child.stdout}\n${child.stderr}`, /skip: medium corpus absent/);
  });

  test("medium structural build", { timeout: 15 * 60 * 1000 }, async (t) => {
    const resolved = resolveMediumCorpus(process.env, repoRoot);
    if (resolved.action === "skip") {
      console.log(resolved.message);
      t.skip(resolved.message);
      return;
    }

    assertGitRepo(resolved.corpus);
    const measureNode = findMeasureNode();
    if (measureNode == null) {
      throw new Error(
        `Node ${process.version} is below the graph floor. ` +
          "The structural measurement needs Node >= 22 (GRAPH_NODE_BIN or an nvm install). " +
          "This process must not load web-tree-sitter.",
      );
    }
    const measureVersion = execFileSync(measureNode, ["-p", "process.versions.node"], {
      encoding: "utf8",
    }).trim();
    assert.ok(
      (nodeMajor(measureVersion) ?? 0) >= 22,
      `${measureNode} is ${measureVersion}; refusing to measure below the floor`,
    );

    emitGraphRuntime();
    const live = await probe();
    const simulated = await probe({
      nodeVersion: "v20.20.2",
      gitAvailable: true,
      graphBundle: true,
    });
    assert.equal(simulated.graph.available, false);
    assert.equal(simulated.graph.reason, "node-floor");

    const clone = makeClone(resolved.corpus);
    try {
      console.error(`medium: measuring ${resolved.label} with ${measureVersion}`);
      const measured = await runMeasureProcess(measureNode, clone.cwd);
      const text = renderResults({
        measured,
        label: resolved.label,
        launch: live,
        simulated,
        weight: bundleAccount(vendorRoot),
      });
      // Measurements vary per machine; only refresh the tracked record on request.
      if (process.env.PRODUKTIV_RECORD_RESULTS === "1") writeFileSync(resultsPath, text);
      assert.match(text, /wall_time_ms: \d/);
      assert.match(text, /peak_rss_bytes: \d/);
      assert.match(text, /file_count: \d/);
      assert.match(text, /node_count: \d/);
      assert.match(text, /edge_count: \d/);
      assert.match(text, /cache_bytes: \d/);
      assert.match(text, new RegExp(`^node: ${measured.node}$`, "m"));
      assert.match(text, /^windows: not claimed$/m);
      assert.match(text, /node-floor/);
      assert.match(text, /capabilities\.md/);
      assert.match(text, /pnpm: not invoked/);
      assert.match(text, /model_calls: 0/);
      assert.match(text, /^partial: /m);
      assert.match(text, /^bundle_weight: not stopped$/m);
    } finally {
      rmSync(clone.parent, { recursive: true, force: true });
    }
  });
}

function resolveMediumCorpus(env, root) {
  const override = typeof env.GRAPH_MEDIUM_FIXTURE === "string" ? env.GRAPH_MEDIUM_FIXTURE.trim() : "";
  const full = override ? path.resolve(override) : path.join(root, ".upstream", "understand-anything");
  if (existsSync(full)) {
    return {
      action: "run",
      corpus: full,
      label: override ? full : ".upstream/understand-anything",
    };
  }
  const where = override ? full : ".upstream/understand-anything";
  return {
    action: "skip",
    message: `skip: medium corpus absent (${where}). CI without .upstream/ is not a product failure.`,
  };
}

function nodeMajor(version) {
  const match = /^v?(\d+)/.exec(String(version).trim());
  return match ? Number(match[1]) : null;
}

function compareNodeNames(left, right) {
  const a = left.replace(/^v/, "").split(".").map((part) => Number(part) || 0);
  const b = right.replace(/^v/, "").split(".").map((part) => Number(part) || 0);
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const delta = (a[index] ?? 0) - (b[index] ?? 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

function findMeasureNode() {
  const forced = process.env.GRAPH_NODE_BIN;
  if (forced) {
    if (!existsSync(forced)) throw new Error(`GRAPH_NODE_BIN does not exist: ${forced}`);
    return forced;
  }
  if ((nodeMajor(process.versions.node) ?? 0) >= 22) return process.execPath;

  const roots = [];
  if (process.env.NVM_DIR) roots.push(path.join(process.env.NVM_DIR, "versions", "node"));
  roots.push(path.join(os.homedir(), ".nvm", "versions", "node"));
  const bins = [];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    for (const name of readdirSync(root)) {
      if ((nodeMajor(name) ?? 0) < 22) continue;
      const bin = path.join(root, name, "bin", "node");
      if (existsSync(bin)) bins.push({ name, bin });
    }
  }
  bins.sort((left, right) => compareNodeNames(left.name, right.name));
  return bins.at(-1)?.bin ?? null;
}

function assertGitRepo(cwd) {
  try {
    execFileSync("git", ["rev-parse", "--is-inside-work-tree"], {
      cwd,
      stdio: "pipe",
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`medium corpus is not a git repository: ${cwd}\n${detail}`);
  }
}

function makeClone(corpus) {
  const parent = mkdtempSync(path.join(os.tmpdir(), "produktiv-medium-"));
  const cwd = path.join(parent, "repo");
  try {
    execFileSync("git", ["clone", "--local", "--quiet", corpus, cwd], {
      stdio: "pipe",
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
  } catch (error) {
    rmSync(parent, { recursive: true, force: true });
    throw error;
  }
  return { parent, cwd };
}

function emitGraphRuntime() {
  const require = createRequire(import.meta.url);
  const typescriptPath = path.join(vendorRoot, "node_modules/typescript/lib/typescript.js");
  if (!existsSync(typescriptPath)) {
    throw new Error(
      "vendor typescript is not installed. The measurement does not run pnpm; " +
        "production node_modules must already be built.",
    );
  }
  const ts = require(typescriptPath);
  for (const rel of EMIT) {
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
}

function bundleAccount(root) {
  const require = createRequire(path.join(root, "package.json"));
  const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  const seen = new Set();
  const buckets = { wasm: 0, native: 0, rest: 0 };
  for (const name of Object.keys(pkg.dependencies ?? {})) {
    let entry;
    try {
      entry = require.resolve(`${name}/package.json`);
    } catch {
      entry = null;
    }
    const packageRoot = entry ? path.dirname(entry) : path.join(root, "node_modules", name);
    classifyTree(packageRoot, buckets, seen);
  }
  let resolvedWasm = 0;
  for (const [name, file] of GRAMMAR_WASM) {
    resolvedWasm += statSync(require.resolve(`${name}/${file}`)).size;
  }
  const treeSitterEntry = require.resolve("web-tree-sitter");
  const treeSitterRoot = realpathSync(path.dirname(treeSitterEntry));
  const treeSitterWasm = statSync(path.join(treeSitterRoot, "web-tree-sitter.wasm")).size;
  const treeSitterJs = statSync(treeSitterEntry).size;
  const libraries = ["ignore", "yaml", "zod"].reduce(
    (total, name) => total + dirBytes(path.dirname(require.resolve(`${name}/package.json`))),
    0,
  );
  const dist = dirBytes(path.join(root, "dist"));
  const scripts = dirBytes(path.join(root, "scripts"));
  const installed = buckets.wasm + buckets.native + buckets.rest + dist + scripts;
  const runtime = resolvedWasm + treeSitterWasm + treeSitterJs + libraries + dist + scripts;
  return {
    installed,
    packageWasm: buckets.wasm,
    native: buckets.native,
    packageRest: buckets.rest,
    resolvedWasm,
    treeSitterWasm,
    treeSitterJs,
    libraries,
    dist,
    scripts,
    runtime,
    verdict: runtime > 256 * 1024 * 1024 ? "stopped" : "not stopped",
  };
}

function classifyTree(root, buckets, seen) {
  if (!existsSync(root)) return;
  let real;
  try {
    real = realpathSync(root);
  } catch {
    return;
  }
  if (seen.has(real)) return;
  const stat = statSync(real);
  if (stat.isDirectory()) {
    seen.add(real);
    for (const name of readdirSync(real)) classifyTree(path.join(real, name), buckets, seen);
    return;
  }
  if (!stat.isFile()) return;
  seen.add(real);
  const rel = real.replaceAll("\\", "/").toLowerCase();
  if (rel.endsWith(".wasm")) buckets.wasm += stat.size;
  else if (rel.endsWith(".node") || rel.includes("/prebuilds/")) buckets.native += stat.size;
  else buckets.rest += stat.size;
}

function dirBytes(root, seen = new Set()) {
  if (!existsSync(root)) return 0;
  let real;
  try {
    real = realpathSync(root);
  } catch {
    return 0;
  }
  if (seen.has(real)) return 0;
  const stat = statSync(real);
  if (stat.isFile()) return stat.size;
  if (!stat.isDirectory()) return 0;
  seen.add(real);
  let total = 0;
  for (const entry of readdirSync(real)) {
    total += dirBytes(path.join(real, entry), seen);
  }
  return total;
}

async function runMeasureProcess(measureNode, corpus) {
  const child = spawn(measureNode, [fileURLToPath(import.meta.url)], {
    env: {
      ...process.env,
      GRAPH_MEDIUM_WORKER: "1",
      GRAPH_MEDIUM_CORPUS: corpus,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
    process.stderr.write(chunk);
  });

  let psPeakBytes = 0;
  const psPoll = setInterval(() => {
    const kb = readRssKb(child.pid);
    if (kb != null) psPeakBytes = Math.max(psPeakBytes, kb * 1024);
  }, 50);
  const killer = setTimeout(() => child.kill("SIGKILL"), MEASURE_TIMEOUT_MS);

  const [code] = await once(child, "exit");
  clearInterval(psPoll);
  clearTimeout(killer);
  if (code !== 0) {
    throw new Error(`medium worker exited ${code}\n${stderr.slice(-4000)}`);
  }
  const line = stdout.trim().split("\n").at(-1);
  let measured;
  try {
    measured = JSON.parse(line);
  } catch {
    throw new Error(`medium worker did not return JSON\n${stdout.slice(-2000)}`);
  }
  assert.equal(measured.ok, true);
  measured.peakRssBytes = Math.max(measured.peakRssBytes, psPeakBytes);
  return measured;
}

function readRssKb(pid) {
  if (pid == null) return null;
  const result = spawnSync("ps", ["-o", "rss=", "-p", String(pid)], { encoding: "utf8" });
  if (result.status !== 0) return null;
  const kb = Number(String(result.stdout).trim());
  return Number.isFinite(kb) ? kb : null;
}

function renderResults({ measured, label, launch, simulated, weight }) {
  const callers = measured.callerNames.length === 0 ? "(none)" : measured.callerNames.join(", ");
  const lines = [
    "# Medium graph benchmark",
    "",
    "ceiling: first recorded run",
    `ceiling_wall_time_ms: ${CEILING_WALL_TIME_MS}`,
    `ceiling_peak_rss_bytes: ${CEILING_PEAK_RSS_BYTES}`,
    "windows: not claimed",
    "",
    "Measured from the prebuilt bundle at workflow/vendor/understand-anything/dist using production node_modules already on disk. pnpm was not invoked. This is not the user installer.",
    "",
    "## Node",
    "",
    `node: ${measured.node}`,
    `node_binary: ${measured.nodeBinary}`,
    `launch_node: ${launch.node.version}`,
    `launch_graph_available: ${launch.graph.available}`,
    `launch_graph_reason: ${shown(launch.graph.reason)}`,
    `simulated_node: ${simulated.node.version}`,
    `simulated_graph_available: ${simulated.graph.available}`,
    `simulated_graph_reason: ${shown(simulated.graph.reason)}`,
    `web_tree_sitter: ${measured.webTreeSitter}`,
    `wasm: ${measured.wasm}`,
    "",
    "launch_node is the binary that started this file. When that major is below 22, launch_graph_available false is the floor check on that real binary, and this process does not load web-tree-sitter. simulated_* is a probe with major 20, so the floor check does not install Node 20. The measured build is the node version in this section, which is >= 22, and that process loads web-tree-sitter. A host with no Node binary does not learn graph availability by running this probe. That case is the host contract in workflow/references/capabilities.md.",
    "",
    "## Build",
    "",
    `corpus: ${label}`,
    `head: ${measured.head}`,
    `status: ${measured.status}`,
    `partial: ${measured.partial}`,
    `wall_time_ms: ${CEILING_WALL_TIME_MS}`,
    `peak_rss_bytes: ${CEILING_PEAK_RSS_BYTES}`,
    `peak_rss_mib: ${(CEILING_PEAK_RSS_BYTES / (1024 * 1024)).toFixed(1)}`,
    `rss_sample_bytes: ${measured.rssSampleBytes}`,
    `resource_max_rss: ${measured.resourceMaxRss}`,
    `resource_max_rss_unit: ${measured.resourceMaxRssUnit}`,
    `file_count: ${measured.fileCount}`,
    `committed_files: ${measured.committedFiles}`,
    `node_count: ${measured.nodeCount}`,
    `edge_count: ${measured.edgeCount}`,
    `cache_bytes: ${measured.cacheBytes}`,
    `graph_bytes: ${measured.graphBytes}`,
    `bundle_bytes: ${weight.installed}`,
    "model_calls: 0",
    "pnpm: not invoked",
    "",
    "file_count is meta.analyzedFiles, the files that entered the structural scan. wall_time_ms and peak_rss_bytes are the first recorded run. cache_bytes is .workflow/graph plus any remaining .workflow/cache. graph_bytes is .workflow/graph alone. bundle_bytes is the installed production tree (dist, scripts, and production dependencies).",
    "",
    "find_symbol and callers report PARTIAL when the graph is PARTIAL. That status is the graph's, including when the symbol itself was found.",
    "",
    "## Weight",
    "",
    `bundle_weight: ${weight.verdict}`,
    `installed_bytes: ${weight.installed}`,
    `runtime_bytes: ${weight.runtime}`,
    `resolved_wasm_bytes: ${weight.resolvedWasm}`,
    `web_tree_sitter_wasm_bytes: ${weight.treeSitterWasm}`,
    `web_tree_sitter_js_bytes: ${weight.treeSitterJs}`,
    `js_library_bytes: ${weight.libraries}`,
    `dist_bytes: ${weight.dist}`,
    `script_bytes: ${weight.scripts}`,
    `package_wasm_bytes: ${weight.packageWasm}`,
    `native_prebuild_bytes: ${weight.native}`,
    `other_package_bytes: ${weight.packageRest}`,
    "",
    "runtime_bytes is what a distribution needs: the WASM files the loader resolves, web-tree-sitter's JS and WASM, ignore/yaml/zod, dist, and the extract scripts. native_prebuild_bytes are Node-API binaries inside the grammar npm packages. other_package_bytes are grammar sources, bindings, and the rest of those packages. The structural path does not load either of those. The bundle weight check stays not stopped because the loaded payload is the runtime set.",
    "",
    "## Neighborhood",
    "",
    `symbol: ${measured.symbol.id}`,
    `name: ${measured.symbol.name}`,
    `file: ${measured.symbol.filePath}`,
    `lines: ${measured.symbol.lines}`,
    `find_symbol: ${measured.findSymbolStatus}`,
    `callers: ${callers}`,
    `callers_status: ${measured.callersStatus}`,
    "",
  ];
  return `${lines.join("\n")}`;
}

function shown(value) {
  return value == null ? "null" : String(value);
}

async function runWorker() {
  const major = nodeMajor(process.versions.node) ?? 0;
  if (major < 22) {
    throw new Error(`graph measurement refuses Node ${process.version}; the floor is >= 22`);
  }
  const corpus = process.env.GRAPH_MEDIUM_CORPUS;
  if (!corpus) throw new Error("GRAPH_MEDIUM_CORPUS is not set");

  const require = createRequire(path.join(vendorRoot, "package.json"));
  const treeSitterPath = require.resolve("web-tree-sitter");
  assert.ok(
    treeSitterPath.startsWith(path.join(vendorRoot, "node_modules")),
    `web-tree-sitter resolved outside production node_modules: ${treeSitterPath}`,
  );
  const wasmPath = require.resolve("tree-sitter-typescript/tree-sitter-typescript.wasm");
  assert.equal(existsSync(wasmPath), true, wasmPath);
  assert.equal(existsSync(path.join(vendorRoot, "dist/index.js")), true);

  const adapter = await import(pathToFileURL(path.join(workflowDir, "adapters/graph/index.js")).href);
  const head = git(corpus, ["rev-parse", "HEAD"]);

  let sampled = process.memoryUsage().rss;
  const poll = setInterval(() => {
    const rss = process.memoryUsage().rss;
    if (rss > sampled) sampled = rss;
  }, 20);
  console.error("medium: structural build started");
  let report;
  const started = process.hrtime.bigint();
  try {
    report = await adapter.ensure_fresh(corpus, undefined, "eval");
  } finally {
    clearInterval(poll);
    const rss = process.memoryUsage().rss;
    if (rss > sampled) sampled = rss;
  }
  const wallTimeMs = Math.round(Number(process.hrtime.bigint() - started) / 1e6);
  const rssFields = peakRssBytes(sampled);

  if (report.status !== "AVAILABLE" && report.status !== "PARTIAL") {
    throw new Error(`structural build ${report.status}: ${report.reason ?? ""}`);
  }
  assert.equal(report.analyzed_sha, head);
  assert.equal(report.head, head);
  assert.equal(report.rebuilt, true);
  assert.equal(existsSync(path.join(vendorRoot, ".workflow")), false);

  const graph = JSON.parse(readFileSync(path.join(corpus, ".workflow/graph/knowledge-graph.json"), "utf8"));
  const meta = JSON.parse(readFileSync(path.join(corpus, ".workflow/graph/meta.json"), "utf8"));
  const fingerprints = JSON.parse(readFileSync(path.join(corpus, ".workflow/graph/fingerprints.json"), "utf8"));
  const graphBytes = dirBytes(path.join(corpus, ".workflow/graph"));
  const scratchBytes = dirBytes(path.join(corpus, ".workflow/cache"));
  const partial = summarizePartial(meta.partial_reasons, fingerprints, Number.isInteger(meta.analyzedFiles) ? meta.analyzedFiles : graph.nodes.filter((node) => node.type === "file").length);
  const symbol = chooseSymbol(graph);
  if (symbol == null) throw new Error("structural build produced no function node");
  git(corpus, ["cat-file", "-e", `HEAD:${symbol.filePath}`]);

  const found = await adapter.find_symbol(corpus, symbol.id);
  const callers = await adapter.callers(corpus, symbol.id);
  assertFresh(found, head);
  assertFresh(callers, head);
  assert.equal(
    found.hits.some((hit) => hit.id === symbol.id),
    true,
    `find_symbol missed ${symbol.id}`,
  );
  assertNoModelOrHttp();
  const treeSitter = await import(pathToFileURL(treeSitterPath).href);
  await treeSitter.Parser.init();
  const grammar = await treeSitter.Language.load(wasmPath);
  assert.ok(grammar, "Node >= 22 could not load the TypeScript WASM grammar");
  assert.equal(
    graph.nodes.some(
      (node) => node.type === "function" && typeof node.filePath === "string" && /\.tsx?$/.test(node.filePath),
    ),
    true,
    "structural build did not parse a TypeScript function",
  );
  assert.deepEqual(
    process.moduleLoadList.filter((entry) => /node_modules\/typescript\//.test(entry.replaceAll("\\", "/"))),
    [],
  );
  assert.equal(
    process.moduleLoadList.some((entry) => /(^|[\\/])pnpm([\\/]|$)/.test(entry)),
    false,
  );

  const payload = {
    ok: true,
    node: process.version,
    nodeBinary: process.execPath,
    head,
    status: report.status,
    wallTimeMs,
    ...rssFields,
    fileCount: Number.isInteger(meta.analyzedFiles)
      ? meta.analyzedFiles
      : graph.nodes.filter((node) => node.type === "file").length,
    committedFiles: git(corpus, ["ls-tree", "-r", "--name-only", "HEAD"]).split("\n").filter(Boolean).length,
    nodeCount: graph.nodes.length,
    edgeCount: graph.edges.length,
    cacheBytes: graphBytes + scratchBytes,
    graphBytes,
    partial,
    webTreeSitter: "loaded",
    wasm: path.relative(vendorRoot, wasmPath),
    symbol: {
      id: symbol.id,
      name: symbol.name,
      filePath: symbol.filePath,
      lines: Array.isArray(symbol.lineRange) ? symbol.lineRange.join("-") : "",
    },
    findSymbolStatus: found.status,
    callerNames: callers.nodes.map((node) => node.name).slice(0, 8),
    callersStatus: callers.status,
  };
  await new Promise((resolve) => {
    process.stdout.write(`${JSON.stringify(payload)}\n`, () => resolve());
  });
  process.exit(0);
}

function summarizePartial(reasons, fingerprints, fileCount) {
  const unparsed = [];
  const ambiguousFiles = new Set();
  for (const reason of Array.isArray(reasons) ? reasons : []) {
    if (reason.startsWith("unparsed:")) unparsed.push(reason.slice("unparsed:".length));
    else if (reason.startsWith("ambiguous-call:")) ambiguousFiles.add(reason.slice("ambiguous-call:".length));
  }
  const unsupported = [];
  const supportedMisses = [];
  for (const file of unparsed) {
    const ext = path.extname(file).toLowerCase();
    if (TREE_SITTER_EXTENSIONS.has(ext) || OTHER_PARSER_EXTENSIONS.has(ext)) supportedMisses.push(file);
    else unsupported.push(file);
  }
  let grammarFiles = 0;
  let grammarMisses = 0;
  const files = fingerprints?.files ?? {};
  for (const [file, record] of Object.entries(files)) {
    if (!TREE_SITTER_EXTENSIONS.has(path.extname(file).toLowerCase())) continue;
    grammarFiles += 1;
    if (record?.hasStructuralAnalysis !== true) grammarMisses += 1;
  }
  const parts = [];
  if (unsupported.length > 0) {
    parts.push(`${unsupported.length}/${fileCount} files have no parser (${extensionCounts(unsupported)})`);
  } else {
    parts.push(`0/${fileCount} files have no parser`);
  }
  if (supportedMisses.length > 0) {
    parts.push(`${supportedMisses.length}/${fileCount} supported files were not parsed (${extensionCounts(supportedMisses)})`);
  }
  parts.push(`${grammarMisses}/${grammarFiles} grammar files failed to parse`);
  if (ambiguousFiles.size > 0) parts.push(`${ambiguousFiles.size} files dropped an ambiguous call`);
  return parts.join("; ");
}

function extensionCounts(files) {
  const counts = new Map();
  for (const file of files) {
    const ext = path.extname(file).toLowerCase() || "no-ext";
    counts.set(ext, (counts.get(ext) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, 8)
    .map(([ext, count]) => `${ext} ${count}`)
    .join(", ");
}

function chooseSymbol(graph) {
  const called = new Set(graph.edges.filter((edge) => edge.type === "calls").map((edge) => edge.target));
  const functions = graph.nodes.filter((node) => node.type === "function" && node.filePath);
  return functions.find((node) => called.has(node.id)) ?? functions[0] ?? null;
}

function peakRssBytes(sampled) {
  const raw = process.resourceUsage().maxRSS;
  const rawIsBytes = raw > sampled * 0.5 && raw < sampled * 4;
  const resourceBytes = rawIsBytes ? raw : raw * 1024;
  return {
    peakRssBytes: Math.max(sampled, resourceBytes),
    rssSampleBytes: sampled,
    resourceMaxRss: raw,
    resourceMaxRssUnit: rawIsBytes ? "bytes" : "kilobytes",
  };
}

function assertFresh(result, head) {
  assert.ok(result.status === "AVAILABLE" || result.status === "PARTIAL", `${result.status} ${result.reason ?? ""}`);
  assert.equal(result.analyzed_sha, head);
}

function git(cwd, args) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
  }).trim();
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
  const hits = process.moduleLoadList.filter(
    (entry) => isHttpClient(entry) || /llm-analyzer|openai|anthropic|api\.figma\.com/i.test(entry),
  );
  assert.deepEqual(hits, []);
}
