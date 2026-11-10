/**
 * diagram fixtures, twelve-node render, RSS.
 *
 * Integration and cost evals for the vendored diagram adapter.
 * Five small IR files, one invalid set, one ~12-node architecture
 * diagram, and one compare pair. The 20-node chain is a fail-closed
 * layout diagnostic, not a cost row. Windows is not claimed.
 */

import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const evalDir = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.resolve(evalDir, "../fixtures/diagram");
const workflowDir = path.resolve(evalDir, "../..");
const repoRoot = path.dirname(workflowDir);
const vendorRoot = path.join(workflowDir, "vendor/archify");
const adapterPath = path.join(workflowDir, "adapters/diagram/index.mjs");
const resultsPath = path.join(evalDir, "RESULTS.md");
const selfPath = fileURLToPath(import.meta.url);

const TYPES = ["architecture", "workflow", "sequence", "dataflow", "lifecycle"];

const SMALL = [
  ["architecture", "architecture.json"],
  ["workflow", "workflow.json"],
  ["sequence", "sequence.json"],
  ["dataflow", "dataflow.json"],
  ["lifecycle", "lifecycle.json"],
];

const INVALID = [
  ["architecture", "invalid/missing-title.architecture.json", "schema/required"],
  ["architecture", "invalid/duplicate-id.architecture.json", "layout/constraint"],
  ["architecture", "invalid/dangling-endpoint.architecture.json", "layout/constraint"],
  ["workflow", "invalid/unknown-lane.workflow.json", "workflow/unknown-node-lane"],
];

const COST = [
  ["architecture", "architecture.json"],
  ["workflow", "workflow.json"],
  ["sequence", "sequence.json"],
  ["dataflow", "dataflow.json"],
  ["lifecycle", "lifecycle.json"],
  ["architecture-12", "architecture-12.json"],
];

if (process.env.DIAGRAM_MEASURE === "cost") {
  try {
    await measureCost();
  } catch (error) {
    console.error(error instanceof Error ? error.stack : error);
    process.exit(1);
  }
} else if (process.env.DIAGRAM_MEASURE === "offline") {
  try {
    await measureOffline();
  } catch (error) {
    console.error(error instanceof Error ? error.stack : error);
    process.exit(1);
  }
} else {
  const { describe, test } = await import("node:test");
  const adapter = await import(adapterPath);

  describe("diagram fixtures", { concurrency: 1 }, () => {
    test("supports only the five diagram types", () => {
      for (const type of TYPES) assert.equal(adapter.supports(type), true);
      assert.equal(adapter.supports("delta"), false);
      const source = readFileSync(adapterPath, "utf8");
      assert.doesNotMatch(source, /\.upstream/);
      assert.equal(existsSync(path.join(vendorRoot, "renderers/shared/generated-brand-marks.mjs")), false);
    });

    test("each type validates, renders, and keeps only data urls", async () => {
      for (const [type, file] of SMALL) {
        const ir = loadFixture(file);
        const validated = await expectNoTempLeak(() => adapter.validate_ir(type, ir));
        assert.equal(validated.ok, true, `${file} ${validated.diagnostics?.[0]?.message || ""}`);
        assert.deepEqual(validated.diagnostics, []);

        const dir = mkdtempSync(path.join(tmpdir(), "produktiv-diagram-out-"));
        const output = path.join(dir, `${type}.html`);
        try {
          const rendered = await expectNoTempLeak(() => adapter.render_ir(type, ir, output));
          assert.equal(rendered.ok, true, `${file} ${rendered.diagnostics?.[0]?.message || ""}`);
          assert.equal(rendered.path, output);
          assert.equal(outputInside(vendorRoot, output), false);
          assertArtifact(readFileSync(output, "utf8"), ir);
        } finally {
          rmSync(dir, { recursive: true, force: true });
        }
      }
    });

    test("failing cases leave no destination file", async () => {
      for (const [type, file, code] of INVALID) {
        const ir = loadFixture(file);
        const validated = await expectNoTempLeak(() => adapter.validate_ir(type, ir));
        assert.equal(validated.ok, false, file);
        assert.equal(validated.diagnostics[0].code, code, file);

        const dir = mkdtempSync(path.join(tmpdir(), "produktiv-diagram-out-"));
        const output = path.join(dir, "diagram.html");
        try {
          const rendered = await expectNoTempLeak(() => adapter.render_ir(type, ir, output));
          assert.equal(rendered.ok, false, file);
          assert.equal(rendered.path, null, file);
          assert.equal(rendered.diagnostics[0].code, code, file);
          assert.equal(existsSync(output), false, file);
          assert.equal(readdirSync(dir).some((name) => name.endsWith(".html")), false, file);
        } finally {
          rmSync(dir, { recursive: true, force: true });
        }
      }
    });

    test("compare cases follow the architecture receipt", () => {
      const current = loadFixture("compare/current.json");
      const renamed = loadFixture("compare/label-rename.json");
      assert.deepEqual(current, loadFixture("architecture.json"));

      const identical = adapter.compare_architecture(current, structuredClone(current));
      assert.equal(identical.ok, true);
      assert.equal(identical.receipt.proofLevel, "authored");
      assert.equal(semanticRows(identical).length, 0);

      const label = adapter.compare_architecture(current, renamed);
      assert.equal(label.ok, true);
      assert.deepEqual(label.semantic.changes.components.map(changeId), ["changed:web:semantic"]);
      assert.equal(label.semantic.changes.connections.length, 0);
      assert.equal(label.semantic.changes.boundaries.length, 0);

      const movedIr = structuredClone(current);
      movedIr.components.find((component) => component.id === "web").row = 1;
      const moved = adapter.compare_architecture(current, movedIr);
      assert.equal(moved.ok, true);
      assert.equal(moved.receipt.summary.components.moved, 1);
      assert.equal(moved.receipt.changes.components.some((change) => change.status === "moved"), true);
      assert.equal(moved.semantic.changes.components.some((change) => change.status === "moved"), false);
      assert.equal(Object.hasOwn(moved.semantic.summary.components, "moved"), false);
      assert.equal(semanticRows(moved).length, 0);

      const addedIr = structuredClone(current);
      addedIr.components.push({ id: "worker", type: "backend", label: "Worker", row: 1, col: 0 });
      addedIr.connections.push({ id: "api-worker", from: "api", to: "worker", label: "job" });
      const added = adapter.compare_architecture(current, addedIr);
      assert.deepEqual(added.semantic.changes.components.map(changeId), ["added:worker:semantic"]);
      assert.deepEqual(added.semantic.changes.connections.map(changeId), ["added:api-worker:topology"]);

      const removedIr = structuredClone(current);
      removedIr.components = removedIr.components.filter((component) => component.id !== "db");
      removedIr.connections = removedIr.connections.filter((connection) => connection.id !== "api-db");
      removedIr.boundaries[0].wraps = ["web", "api"];
      const removed = adapter.compare_architecture(current, removedIr);
      assert.deepEqual(removed.semantic.changes.components.map(changeId), ["removed:db:semantic"]);
      assert.deepEqual(removed.semantic.changes.connections.map(changeId), ["removed:api-db:topology"]);
      assert.equal(removed.semantic.changes.boundaries.length, 1);
      assert.equal(removed.semantic.changes.boundaries[0].status, "changed");
      assert.equal(removed.semantic.changes.boundaries[0].classifications.includes("scope"), true);

      const sameId = structuredClone(current);
      sameId.connections.find((connection) => connection.id === "web-api").to = "db";
      const retargetSame = adapter.compare_architecture(current, sameId);
      assert.deepEqual(retargetSame.semantic.changes.connections.map(changeId), ["changed:web-api:topology"]);
      assert.equal(retargetSame.semantic.changes.components.length, 0);

      const newId = structuredClone(current);
      newId.connections = newId.connections.filter((connection) => connection.id !== "web-api");
      newId.connections.push({ id: "web-db", from: "web", to: "db", label: "call" });
      const retargetNew = adapter.compare_architecture(current, newId);
      assert.deepEqual(
        retargetNew.semantic.changes.connections.map(changeId).sort(),
        ["added:web-db:topology", "removed:web-api:topology"],
      );

      const missingId = structuredClone(current);
      delete missingId.connections[0].id;
      const rejected = adapter.compare_architecture(current, missingId);
      assert.equal(rejected.ok, false);
      assert.equal(rejected.receipt, null);
      assert.equal(rejected.diagnostics[0].code, "delta/relationship-id-required");
    });

    test("envelope metadata stays outside the IR", async () => {
      const ir = loadFixture("architecture.json");
      const current = {
        diagram_type: "architecture",
        status: "CURRENT",
        analyzed_sha: "a".repeat(40),
        evidence: "working tree differs from HEAD",
        ir,
      };
      const proposed = {
        diagram_type: "architecture",
        status: "PROPOSED",
        lifetime: "ephemeral",
        ir,
      };
      assert.equal(current.ir.meta.analyzed_sha, undefined);
      assert.equal(proposed.ir.meta.repository, undefined);

      const dir = mkdtempSync(path.join(tmpdir(), "produktiv-diagram-out-"));
      try {
        const currentRender = await adapter.render_ir(
          current.diagram_type,
          current.ir,
          path.join(dir, "current.html"),
          current.status,
        );
        assert.equal(currentRender.ok, true, currentRender.diagnostics?.[0]?.message || "");
        const proposedRender = await adapter.render_ir(
          proposed.diagram_type,
          proposed.ir,
          path.join(dir, "proposed.html"),
          proposed.status,
        );
        assert.equal(proposedRender.ok, true, proposedRender.diagnostics?.[0]?.message || "");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }

      const compared = adapter.compare_architecture(current.ir, proposed.ir);
      assert.equal(compared.ok, true);
      assert.equal(semanticRows(compared).length, 0);

      const withRepository = structuredClone(ir);
      withRepository.meta.repository = {
        url: "https://github.com/acme/app",
        revision: "a".repeat(40),
      };
      const withSources = structuredClone(ir);
      withSources.components[0].sources = [{ path: "src/api.ts" }];
      await withGitTrap(async () => {
        const repository = await adapter.validate_ir("architecture", withRepository, "PROPOSED");
        assert.equal(repository.ok, false);
        assert.equal(repository.diagnostics[0].code, "diagram/proposed-evidence");
        const outDir = mkdtempSync(path.join(tmpdir(), "produktiv-diagram-out-"));
        try {
          const sources = await adapter.render_ir(
            "architecture",
            withSources,
            path.join(outDir, "proposed.html"),
            "PROPOSED",
          );
          assert.equal(sources.ok, false);
          assert.equal(sources.diagnostics[0].code, "diagram/proposed-evidence");
          assert.equal(existsSync(path.join(outDir, "proposed.html")), false);
        } finally {
          rmSync(outDir, { recursive: true, force: true });
        }
      });
    });

    test("the twelve-node diagram is valid geometry", async () => {
      const ir = loadFixture("architecture-12.json");
      assert.equal(ir.components.length, 12);
      assert.equal(ir.layout.mode, "grid");
      assert.notEqual(ir.components.length, 20);
      const dir = mkdtempSync(path.join(tmpdir(), "produktiv-diagram-out-"));
      const output = path.join(dir, "twelve.html");
      try {
        const rendered = await adapter.render_ir("architecture", ir, output);
        assert.equal(rendered.ok, true, rendered.diagnostics?.[0]?.message || "");
        assertArtifact(readFileSync(output, "utf8"), ir);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    test("the twenty-node chain fails closed and writes nothing", async () => {
      const ir = loadFixture("architecture-20-chain.json");
      assert.equal(ir.components.length, 20);
      for (let index = 0; index < ir.connections.length; index += 1) {
        assert.equal(ir.connections[index].from, `n${index}`);
        assert.equal(ir.connections[index].to, `n${index + 1}`);
      }
      const dir = mkdtempSync(path.join(tmpdir(), "produktiv-diagram-out-"));
      const output = path.join(dir, "chain.html");
      try {
        const rendered = await adapter.render_ir("architecture", ir, output);
        assert.equal(rendered.ok, false);
        assert.equal(rendered.path, null);
        assert.equal(rendered.diagnostics[0].code, "clean-flow/endpoint-side-direction");
        assert.equal(existsSync(output), false);
        assert.equal(readdirSync(dir).some((name) => name.endsWith(".html")), false);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    test("offline render contains no remote asset", (t) => {
      const sandbox = networkDeniedCommand();
      if (!sandbox) {
        assert.equal(process.env.CI, undefined, "CI must prove the render with the network denied");
        t.skip("no OS network sandbox on this machine");
        return;
      }
      const dir = mkdtempSync(path.join(tmpdir(), "produktiv-diagram-out-"));
      const output = path.join(dir, "offline.html");
      try {
        const result = spawnSync(sandbox[0], [
          ...sandbox.slice(1),
          process.execPath,
          selfPath,
        ], {
          env: childEnv({ DIAGRAM_MEASURE: "offline", DIAGRAM_OUTPUT: output }),
          encoding: "utf8",
          timeout: 30_000,
        });
        assert.equal(result.status, 0, result.stderr || result.stdout);
        assert.match(result.stdout, /offline-ok/);
        const html = readFileSync(output, "utf8");
        assertArtifact(html, loadFixture("architecture.json"));
        assert.equal(outputInside(vendorRoot, output), false);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    test("cost eval records time and RSS", { timeout: 120_000 }, () => {
      const rows = [];
      for (const [name, file] of COST) {
        const result = spawnSync(process.execPath, [selfPath], {
          env: childEnv({ DIAGRAM_MEASURE: "cost", DIAGRAM_FIXTURE: file, DIAGRAM_FIXTURE_NAME: name }),
          encoding: "utf8",
          timeout: 60_000,
        });
        assert.equal(result.status, 0, `${name}\n${result.stderr || result.stdout}`);
        const line = result.stdout.trim().split("\n").findLast((entry) => entry.startsWith("{"));
        const row = JSON.parse(line);
        assert.equal(row.ok, true, name);
        assert.equal(row.fixture, name);
        assert.ok(row.validateMs >= 0, name);
        assert.ok(row.renderMs > 0, name);
        assert.ok(row.htmlBytes > 0, name);
        assert.ok(row.svgBytes > 0, name);
        assert.ok(row.peakRssBytes > 0, name);
        rows.push(row);
      }
      assert.equal(rows.find((row) => row.fixture === "architecture-12").nodes, 12);
      assert.equal(rows.some((row) => row.fixture.includes("20")), false);

      const text = mergeResults(renderNodeSection(rows, dirBytes(vendorRoot)));
      // Measurements vary per machine; only refresh the tracked record on request.
      if (process.env.PRODUKTIV_RECORD_RESULTS === "1") writeFileSync(resultsPath, text);
      const written = text;
      const section = nodeSection(written, process.version);
      assert.match(written, /^windows: not claimed$/m);
      assert.match(section, new RegExp(`^## Node ${escapeRegExp(process.version)}$`, "m"));
      for (const type of TYPES) assert.match(section, new RegExp(`^### ${type}$`, "m"));
      assert.match(section, /^### architecture-12$/m);
      assert.doesNotMatch(section, /^### architecture-20/m);
      for (const row of rows) {
        assert.match(section, new RegExp(`^### ${row.fixture}\\n[\\s\\S]*?validate_ms: ${row.validateMs}$`, "m"));
        assert.match(section, new RegExp(`^### ${row.fixture}\\n[\\s\\S]*?peak_rss_bytes: ${row.peakRssBytes}$`, "m"));
      }
    });
  });
}

async function measureCost() {
  const { render_ir, validate_ir } = await import(adapterPath);
  const file = process.env.DIAGRAM_FIXTURE;
  const name = process.env.DIAGRAM_FIXTURE_NAME;
  const ir = loadFixture(file);
  const dir = mkdtempSync(path.join(tmpdir(), "produktiv-diagram-cost-"));
  const output = path.join(dir, "diagram.html");
  let peak = process.memoryUsage().rss;
  const poll = setInterval(() => {
    peak = Math.max(peak, process.memoryUsage().rss, treeRss(process.pid));
  }, 20);
  try {
    const validateStarted = process.hrtime.bigint();
    const validated = await validate_ir(diagramType(ir), ir);
    const validateMs = elapsedMs(validateStarted);
    if (!validated.ok) throw new Error(`${name} validate_ir failed: ${validated.diagnostics?.[0]?.message || ""}`);
    const renderStarted = process.hrtime.bigint();
    const rendered = await render_ir(diagramType(ir), ir, output);
    const renderMs = elapsedMs(renderStarted);
    if (!rendered.ok) throw new Error(`${name} render_ir failed: ${rendered.diagnostics?.[0]?.message || ""}`);
    peak = Math.max(peak, process.memoryUsage().rss, treeRss(process.pid));
    const html = readFileSync(output);
    const svg = svgBytes(html.toString("utf8"));
    const selfRss = process.memoryUsage().rss;
    const raw = process.resourceUsage().maxRSS;
    const rawIsBytes = raw > selfRss * 0.5 && raw < selfRss * 4;
    const payload = {
      ok: true,
      fixture: name,
      nodes: nodeCount(ir),
      validateMs,
      renderMs,
      htmlBytes: html.length,
      svgBytes: svg,
      peakRssBytes: peak,
      resourceMaxRss: raw,
      resourceMaxRssUnit: rawIsBytes ? "bytes" : "kilobytes",
    };
    process.stdout.write(`${JSON.stringify(payload)}\n`);
  } finally {
    clearInterval(poll);
    rmSync(dir, { recursive: true, force: true });
  }
}

async function measureOffline() {
  const net = await import("node:net");
  await new Promise((resolve, reject) => {
    const socket = net.connect({ host: "1.1.1.1", port: 443 });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error("network block did not fail closed"));
    }, 2000);
    socket.once("connect", () => {
      clearTimeout(timer);
      socket.destroy();
      reject(new Error("network was not blocked"));
    });
    socket.once("error", () => {
      clearTimeout(timer);
      resolve();
    });
  });

  const { render_ir } = await import(adapterPath);
  const output = process.env.DIAGRAM_OUTPUT;
  if (!output) throw new Error("DIAGRAM_OUTPUT is not set");
  const ir = loadFixture("architecture.json");
  const rendered = await render_ir("architecture", ir, output);
  if (!rendered.ok) throw new Error(rendered.diagnostics?.[0]?.message || "offline render failed");
  process.stdout.write("offline-ok\n");
}

const RESULTS_HEADER = [
  "# Diagram cost eval",
  "",
  "windows: not claimed",
  "",
  "Measured on the vendored adapter at workflow/vendor/archify. validate_ms is validate_ir. render_ms is render_ir, including the artifact checker. html_bytes and svg_bytes are the written HTML file. peak_rss_bytes is the highest RSS sampled from the measurement process and its renderer child. resource_max_rss is process.resourceUsage().maxRSS for that measurement process. The 20-node chain is a fail-closed layout diagnostic and has no cost row. Each Node section below is one passing suite run.",
  "",
  "vendor_root: workflow/vendor/archify",
  "",
].join("\n");

function renderNodeSection(rows, vendorBytes) {
  const lines = [
    `## Node ${process.version}`,
    "",
    `node: ${process.version}`,
    `node_binary: ${process.execPath}`,
    "exit: 0",
    `vendor_bytes: ${vendorBytes}`,
    "",
  ];
  for (const row of rows) {
    lines.push(
      `### ${row.fixture}`,
      `nodes: ${row.nodes}`,
      `validate_ms: ${row.validateMs}`,
      `render_ms: ${row.renderMs}`,
      `html_bytes: ${row.htmlBytes}`,
      `svg_bytes: ${row.svgBytes}`,
      `peak_rss_bytes: ${row.peakRssBytes}`,
      `peak_rss_mib: ${(row.peakRssBytes / (1024 * 1024)).toFixed(1)}`,
      `resource_max_rss: ${row.resourceMaxRss}`,
      `resource_max_rss_unit: ${row.resourceMaxRssUnit}`,
      "",
    );
  }
  return lines.join("\n");
}

function networkDeniedCommand() {
  if (process.platform === "darwin") return ["sandbox-exec", "-p", "(version 1)(allow default)(deny network*)"];
  if (process.platform === "linux" && spawnSync("unshare", ["-rn", "true"]).status === 0) return ["unshare", "-rn"];
  return null;
}

function mergeResults(section) {
  const sections = new Map();
  if (existsSync(resultsPath)) {
    for (const [version, body] of readNodeSections(readFileSync(resultsPath, "utf8"))) {
      sections.set(version, body);
    }
  }
  const version = process.version;
  sections.set(version, section.trimEnd());
  const ordered = [...sections.entries()].sort((left, right) => compareNodeVersion(left[0], right[0]));
  return `${RESULTS_HEADER}\n${ordered.map(([, body]) => body).join("\n\n")}\n`;
}

function readNodeSections(text) {
  const sections = [];
  const parts = text.split(/^(?=## Node )/m);
  for (const part of parts) {
    const match = /^## Node (\S+)/.exec(part);
    if (!match) continue;
    sections.push([match[1], part.trimEnd()]);
  }
  return sections;
}

function nodeSection(text, version) {
  const found = readNodeSections(text).find(([entry]) => entry === version);
  assert.ok(found, `RESULTS.md is missing Node ${version}`);
  return found[1];
}

function compareNodeVersion(left, right) {
  const parse = (version) => version.replace(/^v/, "").split(".").map((part) => Number(part) || 0);
  const a = parse(left);
  const b = parse(right);
  for (let index = 0; index < 3; index += 1) {
    if ((a[index] || 0) !== (b[index] || 0)) return (a[index] || 0) - (b[index] || 0);
  }
  return left < right ? -1 : left > right ? 1 : 0;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function loadFixture(file) {
  return JSON.parse(readFileSync(path.join(fixturesDir, file), "utf8"));
}

function diagramType(ir) {
  return ir.diagram_type;
}

function nodeCount(ir) {
  if (ir.diagram_type === "architecture") return ir.components.length;
  if (ir.diagram_type === "workflow") return ir.nodes.length;
  if (ir.diagram_type === "sequence") return ir.participants.length;
  if (ir.diagram_type === "dataflow") return ir.nodes.length;
  if (ir.diagram_type === "lifecycle") return ir.states.length;
  return 0;
}

function elapsedMs(started) {
  return Math.round(Number(process.hrtime.bigint() - started) / 1e6);
}

function treeRss(rootPid) {
  let raw;
  try {
    raw = spawnSync("ps", ["-ax", "-o", "pid=,ppid=,rss="], { encoding: "utf8" }).stdout || "";
  } catch {
    return 0;
  }
  const rows = [];
  for (const line of raw.split("\n")) {
    const match = /^\s*(\d+)\s+(\d+)\s+(\d+)\s*$/.exec(line);
    if (!match) continue;
    rows.push({ pid: Number(match[1]), ppid: Number(match[2]), rss: Number(match[3]) * 1024 });
  }
  const children = new Map();
  for (const row of rows) {
    const list = children.get(row.ppid) ?? [];
    list.push(row);
    children.set(row.ppid, list);
  }
  let peak = 0;
  const stack = [rootPid];
  const seen = new Set();
  while (stack.length) {
    const pid = stack.pop();
    if (seen.has(pid)) continue;
    seen.add(pid);
    for (const child of children.get(pid) ?? []) {
      peak = Math.max(peak, child.rss);
      stack.push(child.pid);
    }
  }
  return peak;
}

function dirBytes(root) {
  let total = 0;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.name === ".DS_Store") continue;
    const full = path.join(root, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) total += dirBytes(full);
    else if (entry.isFile()) total += statSync(full).size;
  }
  return total;
}

function childEnv(extra) {
  const env = { ...process.env, ...extra };
  for (const key of Object.keys(env)) {
    if (key.startsWith("NODE_TEST_") || key.startsWith("ARCHIFY_")) delete env[key];
  }
  return env;
}

function diagramTemps() {
  return readdirSync(tmpdir()).filter((name) => name.startsWith("produktiv-diagram-"));
}

async function expectNoTempLeak(run) {
  const before = diagramTemps();
  try {
    return await run();
  } finally {
    assert.deepEqual(diagramTemps(), before);
  }
}

function assertArtifact(html, ir) {
  assert.equal((html.match(/<svg\b/g) || []).length, 1);
  assert.match(html, /data-quality-profile="standard"/);
  assert.doesNotMatch(html, /data-quality-profile="showcase"/);
  assert.equal(html.includes("ARCHIFY:"), false);
  assert.equal(html.includes("{{"), false);
  assert.doesNotMatch(html, /<meta\b[^>]*\bname=["']generator["']/i);
  assert.doesNotMatch(html, /<[^>]*\bclass=["'][^"']*\btoolbar\b/);
  assert.doesNotMatch(visibleText(html), /Archify/);
  for (const url of cssUrls(html)) {
    assert.equal(url.startsWith("data:"), true, url.slice(0, 80));
  }
  assert.doesNotMatch(html, /url\(\s*['"]?https?:/i);
  assert.doesNotMatch(html, /\b(?:src|href)\s*=\s*['"]https?:/i);
  for (const label of collectLabels(ir)) {
    if (label.includes("<") || label.includes("&")) {
      assert.equal(html.includes(label), false, label);
      assert.equal(html.includes(escapeHtml(label)), true, label);
    } else {
      assert.equal(html.includes(label), true, label);
    }
  }
}

function visibleText(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");
}

function cssUrls(html) {
  const styles = [...html.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi)].map((match) => match[0]).join("\n");
  return [...styles.matchAll(/url\(\s*(['"]?)([^)'"]+)\1\s*\)/g)].map((match) => match[2]);
}

function collectLabels(ir) {
  const labels = [];
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    if (typeof value.label === "string") labels.push(value.label);
    for (const entry of Object.values(value)) {
      if (Array.isArray(entry)) entry.forEach(visit);
    }
  };
  visit(ir);
  if (typeof ir.meta?.title === "string") labels.push(ir.meta.title);
  return labels;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function svgBytes(html) {
  const match = /<svg\b[\s\S]*?<\/svg>/.exec(html);
  if (!match) return 0;
  return Buffer.byteLength(match[0]);
}

function changeId(change) {
  const classification = (change.classifications || [])[0] || "";
  return `${change.status}:${change.id}:${classification}`;
}

function semanticRows(result) {
  return [
    ...result.semantic.changes.components,
    ...result.semantic.changes.connections,
    ...result.semantic.changes.boundaries,
  ];
}

function outputInside(root, target) {
  const relative = path.relative(root, target);
  return relative === "" || (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

async function withGitTrap(run) {
  const dir = mkdtempSync(path.join(tmpdir(), "produktiv-git-stub-"));
  const log = path.join(dir, "git.log");
  const stub = path.join(dir, "git");
  writeFileSync(log, "");
  writeFileSync(stub, `#!/bin/sh\necho called >> ${JSON.stringify(log)}\nexit 99\n`);
  chmodSync(stub, 0o755);
  const previousPath = process.env.PATH;
  const previousRoot = process.env.ARCHIFY_REPO_ROOT;
  process.env.PATH = `${dir}${path.delimiter}${previousPath || ""}`;
  process.env.ARCHIFY_REPO_ROOT = repoRoot;
  try {
    await run();
    assert.equal(readFileSync(log, "utf8"), "");
  } finally {
    if (previousPath === undefined) delete process.env.PATH;
    else process.env.PATH = previousPath;
    if (previousRoot === undefined) delete process.env.ARCHIFY_REPO_ROOT;
    else process.env.ARCHIFY_REPO_ROOT = previousRoot;
    rmSync(dir, { recursive: true, force: true });
  }
}
