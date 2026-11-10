/**
 * `ensure_fresh` reconciles the persistent graph to committed HEAD.
 *
 * Scope is accepted and ignored for staleness. An equal SHA does not read
 * the worktree and does not rebuild. A different SHA runs the adapted
 * incremental planner (`classifyUpdate`, importer closure, fingerprints on
 * blob text). `FULL_UPDATE` widens that into a full rebuild from
 * `git ls-tree` blobs. Parses use `git show` only.
 *
 * Do not call getChangedFiles. A git error there becomes an empty list and
 * looks fresh. `getGraphFreshness` is used only after HEAD is known, and
 * only to tell a missing commit from a git failure.
 * Failure leaves the previous graph in place and does not claim freshness.
 */

import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { head, show } from "../adapters/host/git.mjs";
import { ASSEMBLER_VERSION, assemble } from "./assemble.js";
import type { AssembleFile } from "./assemble.js";
import {
  clearScratch,
  graphPaths,
  loadStore,
  publishGraph,
  writeScratchJson,
  type StoreLoad,
} from "./store.js";
import {
  FrameworkRegistry,
  PluginRegistry,
  TreeSitterPlugin,
  builtinLanguageConfigs,
  contentHash,
  detectLayers,
  extractFileFingerprint,
  getGraphFreshness,
  mergeGraphUpdate,
  registerAllParsers,
} from "../vendor/understand-anything/dist/index.js";
import type {
  FileFingerprint,
  FingerprintStore,
} from "../vendor/understand-anything/dist/fingerprint.js";
import type {
  GraphEdge,
  GraphNode,
  KnowledgeGraph,
  StructuralAnalysis,
} from "../vendor/understand-anything/dist/types.js";

export type GraphStatus = "AVAILABLE" | "PARTIAL" | "STALE_RECOVERABLE" | "UNAVAILABLE";

export interface FreshnessReport {
  status: GraphStatus;
  reason?: string;
  analyzed_sha?: string;
  head?: string;
  /** This call published a graph whose analyzed SHA is HEAD. */
  rebuilt?: boolean;
  /** Accepted for the following query. It does not decide staleness. */
  scope?: string;
}

interface ScanFile {
  path: string;
  language?: string;
  fileCategory?: string;
  sizeLines?: number;
}

interface ScanResult {
  files: ScanFile[];
  totalFiles?: number;
  failures?: unknown[];
  importMap?: Record<string, string[]>;
}

interface IncrementalPlan {
  baseCommit: string;
  headCommit: string;
  action: string;
  filesToReanalyze: string[];
  deletedFiles: string[];
  rerunArchitecture?: boolean;
}

interface FingerprintPatch {
  files?: Record<string, FileFingerprint>;
  deletedFiles?: string[];
}

interface ExtractResult {
  path: string;
  functions?: Array<{ name: string; startLine: number; endLine: number; params?: string[] }>;
  classes?: Array<{
    name: string;
    startLine: number;
    endLine: number;
    methods?: string[];
    properties?: string[];
  }>;
  exports?: Array<{ name: string; line: number; isDefault?: boolean }>;
  definitions?: Array<{ name: string; kind: string; fields?: string[]; startLine: number; endLine: number }>;
  services?: Array<{ name: string; image?: string; ports?: number[]; startLine?: number; endLine?: number }>;
  endpoints?: Array<{ method?: string; path: string; startLine: number; endLine: number }>;
  steps?: Array<{ name: string; startLine: number; endLine: number }>;
  resources?: Array<{ name: string; kind: string; startLine: number; endLine: number }>;
  callGraph?: Array<{ caller: string; callee: string; lineNumber: number }>;
}

const MANIFEST_NAMES = new Set([
  "package.json",
  "go.mod",
  "requirements.txt",
  "Cargo.toml",
  "pom.xml",
  "composer.json",
  "pyproject.toml",
  "Gemfile",
  "Package.swift",
  "build.gradle",
  "build.gradle.kts",
]);

const scriptsDir = join(dirname(fileURLToPath(import.meta.url)), "../vendor/understand-anything/scripts");

class LeavePrevious extends Error {
  readonly status: "STALE_RECOVERABLE" | "UNAVAILABLE";
  readonly reason: string;

  constructor(status: "STALE_RECOVERABLE" | "UNAVAILABLE", reason: string) {
    super(reason);
    this.status = status;
    this.reason = reason;
  }
}

export async function ensure_fresh(
  projectRoot: string,
  scope?: string,
  caller?: string,
): Promise<FreshnessReport> {
  let root: string;
  try {
    root = realpathSync(projectRoot);
  } catch {
    return finish("UNAVAILABLE", scope, { reason: "missing-graph" });
  }
  try {
    return await ensureFreshAt(root, scope, caller);
  } catch (error) {
    return failureReport(error, root, scope);
  }
}

async function ensureFreshAt(
  projectRoot: string,
  scope: string | undefined,
  caller: string | undefined,
): Promise<FreshnessReport> {
  const loaded = loadStore(projectRoot, ASSEMBLER_VERSION);
  if (loaded.problem?.kind === "missing") {
    if (!allowsInitialBuild(caller)) {
      return finish("UNAVAILABLE", scope, { reason: "missing-graph" });
    }
    const headSha = await readHead(projectRoot);
    return coverageReport(await rebuild(projectRoot, headSha), scope);
  }

  const headSha = await readHead(projectRoot);
  if (loaded.problem?.kind === "corrupt-json" || loaded.problem?.kind === "invalid-graph") {
    try {
      const built = await rebuild(projectRoot, headSha);
      return finish("STALE_RECOVERABLE", scope, {
        reason: loaded.problem.kind === "corrupt-json" ? "corrupt-json" : "invalid-graph",
        rebuilt: true,
        analyzed_sha: built.analyzed_sha,
        head: built.head,
      });
    } catch (error) {
      if (isGitHeadError(error)) throw error;
      return finish("STALE_RECOVERABLE", scope, {
        reason: loaded.problem.kind === "corrupt-json" ? "corrupt-json" : "invalid-graph",
      });
    }
  }

  if (loaded.problem != null) {
    return coverageReport(await rebuild(projectRoot, headSha), scope);
  }

  const meta = loaded.meta;
  if (meta == null) {
    return coverageReport(await rebuild(projectRoot, headSha), scope);
  }
  if (meta.analyzed_sha === headSha) {
    return finish(meta.partial ? "PARTIAL" : "AVAILABLE", scope, {
      analyzed_sha: headSha,
      head: headSha,
      rebuilt: false,
    });
  }

  const freshness = await getGraphFreshness(projectRoot, {
    graphCommitHash: meta.analyzed_sha,
    lastAnalyzedAt: meta.lastAnalyzedAt,
  });
  if (freshness.status === "unknown") {
    if (freshness.reason === "graph-commit-unavailable" || freshness.reason === "missing-graph-commit") {
      return coverageReport(await rebuild(projectRoot, headSha), scope);
    }
    return finish("UNAVAILABLE", scope, { reason: freshness.reason });
  }
  if (freshness.status === "fresh" || freshness.status === "dirty") {
    return finish(meta.partial ? "PARTIAL" : "AVAILABLE", scope, {
      analyzed_sha: freshness.headCommitHash,
      head: freshness.headCommitHash,
      rebuilt: false,
    });
  }

  try {
    return await incremental(projectRoot, headSha, loaded, scope);
  } catch (error) {
    if (isGitHeadError(error) || error instanceof LeavePrevious) throw error;
    return coverageReport(await rebuild(projectRoot, headSha), scope);
  }
}

async function incremental(
  projectRoot: string,
  headSha: string,
  loaded: StoreLoad,
  scope: string | undefined,
): Promise<FreshnessReport> {
  const meta = loaded.meta;
  const existing = loaded.graph;
  if (meta == null || existing == null) {
    return coverageReport(await rebuild(projectRoot, headSha), scope);
  }

  await runNode(
    [join(scriptsDir, "prepare-incremental.mjs"), projectRoot, meta.analyzed_sha],
    projectRoot,
  );
  const plan = readPlan(projectRoot);
  if (plan.headCommit !== headSha || plan.baseCommit !== meta.analyzed_sha) {
    throw new Error("incremental plan does not match HEAD");
  }
  if (plan.action === "FULL_UPDATE") {
    return coverageReport(await rebuild(projectRoot, headSha), scope);
  }

  const scan = readScan(projectRoot);
  // SKIP still advances analyzed_sha. A generated-only commit must not leave
  // the graph behind HEAD, or the next call would reconcile forever.
  if (plan.action === "SKIP") {
    return publishPrepared(
      projectRoot,
      headSha,
      existing,
      loaded.fingerprints,
      scan,
      scope,
      meta.partial_reasons,
    );
  }

  const byPath = new Map(scan.files.map((file) => [file.path, file]));
  const seeds = widenSeeds(plan, scan.importMap ?? {}, byPath);
  const deleted = plan.deletedFiles.filter((filePath) => !byPath.has(filePath));
  const targets = importTargets(scan.importMap ?? {}, seeds, byPath);
  const assemblePaths = [...seeds, ...targets];

  let assembledNodes: GraphNode[] = [];
  let assembledEdges: GraphEdge[] = [];
  let addedReasons: string[] = [];
  if (assemblePaths.length > 0) {
    const assembled = await assemblePathsFromHead(projectRoot, assemblePaths, scan, byPath);
    const seedSet = new Set(seeds);
    assembledNodes = assembled.graph.nodes.filter(
      (node) => typeof node.filePath === "string" && seedSet.has(node.filePath),
    );
    assembledEdges = assembled.graph.edges;
    addedReasons = partialReasons(assembled.partialFiles, assembled.droppedCalls);
    if (assembled.graph.project.gitCommitHash !== headSha) {
      throw new LeavePrevious("STALE_RECOVERABLE", "head-moved");
    }
  }

  let merged = mergeGraphUpdate(
    existing,
    [...seeds, ...deleted],
    assembledNodes,
    assembledEdges,
    headSha,
    [],
  );
  merged = applyCrossEdges(merged, assembledEdges);
  merged = {
    ...merged,
    nodes: dedupeNodes(merged.nodes),
    project: {
      ...merged.project,
      languages: languagesOf(scan.files),
      frameworks: frameworkIds(await readManifests(projectRoot, scan.files)),
      gitCommitHash: headSha,
      description: merged.project.description ?? "",
    },
  };
  if (plan.action === "ARCHITECTURE_UPDATE" || plan.rerunArchitecture === true) {
    merged = { ...merged, layers: detectLayers(merged) };
  }
  merged = dropDanglingEdges(merged);

  const scratch = graphPaths(projectRoot).scratch;
  const symbolReport = await validateSymbols(projectRoot, merged, scratch);
  if (!symbolReport.ok) {
    return coverageReport(await rebuild(projectRoot, headSha), scope);
  }

  const reasons = nextReasons(meta.partial_reasons, new Set([...seeds, ...deleted]), addedReasons);
  return publishPrepared(projectRoot, headSha, merged, loaded.fingerprints, scan, scope, reasons);
}

async function publishPrepared(
  projectRoot: string,
  headSha: string,
  graph: KnowledgeGraph,
  fingerprints: FingerprintStore | null,
  scan: ScanResult,
  scope: string | undefined,
  partialReasons: string[],
): Promise<FreshnessReport> {
  if (graph.project.gitCommitHash !== headSha) {
    graph = {
      ...graph,
      project: {
        ...graph.project,
        gitCommitHash: headSha,
        analyzedAt: new Date().toISOString(),
      },
    };
  }
  const latest = await readHead(projectRoot);
  if (latest !== headSha) {
    throw new LeavePrevious("STALE_RECOVERABLE", "head-moved");
  }

  const published = publishGraph(projectRoot, {
    graph,
    fingerprints: mergeFingerprints(fingerprints, readPatch(projectRoot), headSha),
    partialReasons,
    analyzedFiles: scan.totalFiles ?? scan.files.length,
    assemblerVersion: ASSEMBLER_VERSION,
  });
  if (published.analyzed_sha !== headSha) {
    throw new LeavePrevious("STALE_RECOVERABLE", "head-moved");
  }
  return finish(published.partial ? "PARTIAL" : "AVAILABLE", scope, {
    analyzed_sha: published.analyzed_sha,
    head: headSha,
    rebuilt: true,
  });
}

interface BuiltGraph {
  analyzed_sha: string;
  head: string;
  partial: boolean;
}

async function rebuild(projectRoot: string, headSha: string): Promise<BuiltGraph> {
  clearScratch(projectRoot);
  mkdirSync(graphPaths(projectRoot).scratch, { recursive: true });
  const scan = await scanHead(projectRoot, "full-scan.json");
  if (scan.files.length === 0) {
    const exists = existsSync(graphPaths(projectRoot).graph);
    throw new LeavePrevious(exists ? "STALE_RECOVERABLE" : "UNAVAILABLE", "empty-inventory");
  }
  const importMap = await importMapFor(projectRoot, scan.files, scan.files.map((file) => file.path));
  const extracted = await extractHead(projectRoot, scan.files);
  const manifests = await readManifests(projectRoot, scan.files);
  const assembled = await assemble({
    projectRoot,
    files: toAssembleFiles(scan.files, extracted),
    importMap,
    manifests,
  });
  if (assembled.graph.project.gitCommitHash !== headSha) {
    const latest = await readHead(projectRoot);
    if (assembled.graph.project.gitCommitHash !== latest) {
      throw new LeavePrevious("STALE_RECOVERABLE", "head-moved");
    }
    headSha = latest;
  }
  const withLayers: KnowledgeGraph = {
    ...assembled.graph,
    layers: detectLayers(assembled.graph as KnowledgeGraph),
    tour: [],
  };
  const fingerprints = await fingerprintInventory(projectRoot, scan.files, headSha);
  const published = publishGraph(projectRoot, {
    graph: withLayers,
    fingerprints,
    partialReasons: partialReasons(assembled.partialFiles, assembled.droppedCalls),
    analyzedFiles: scan.files.length,
    assemblerVersion: ASSEMBLER_VERSION,
  });
  // prepare-incremental treats a missing importMap key as a resolution change
  // and promotes cosmetic SKIP into a reparse. The baseline must name every file.
  writeBaselineScan(projectRoot, scan, importMap);
  return {
    analyzed_sha: published.analyzed_sha,
    head: headSha,
    partial: published.partial,
  };
}

async function assemblePathsFromHead(
  projectRoot: string,
  assemblePaths: string[],
  scan: ScanResult,
  byPath: Map<string, ScanFile>,
) {
  const files = assemblePaths.map((filePath) => byPath.get(filePath)).filter((file): file is ScanFile => file != null);
  const importMap = await importMapFor(projectRoot, scan.files, assemblePaths);
  const extracted = await extractHead(projectRoot, files);
  const manifests = await readManifests(projectRoot, scan.files);
  return assemble({
    projectRoot,
    files: toAssembleFiles(files, extracted),
    importMap,
    manifests,
  });
}

async function scanHead(projectRoot: string, name: string): Promise<ScanResult> {
  const outputPath = join(graphPaths(projectRoot).scratch, name);
  mkdirSync(graphPaths(projectRoot).scratch, { recursive: true });
  await runNode(
    [join(scriptsDir, "scan-project.mjs"), projectRoot, outputPath, "--exclude-analysis-data"],
    projectRoot,
  );
  return parseScan(JSON.parse(readFileSync(outputPath, "utf8")));
}

async function importMapFor(
  projectRoot: string,
  inventory: ScanFile[],
  analysisPaths: string[],
): Promise<Record<string, string[]>> {
  const inputPath = writeScratchJson(projectRoot, "import-input.json", {
    projectRoot,
    files: inventory,
    analysisPaths,
  });
  const outputPath = join(graphPaths(projectRoot).scratch, "import-output.json");
  await runNode(
    [join(scriptsDir, "extract-import-map.mjs"), inputPath, outputPath],
    projectRoot,
  );
  const parsed = JSON.parse(readFileSync(outputPath, "utf8")) as { importMap?: Record<string, string[]> };
  return parsed.importMap ?? {};
}

async function extractHead(projectRoot: string, files: ScanFile[]): Promise<ExtractResult[]> {
  const inputPath = writeScratchJson(projectRoot, "extract-input.json", {
    projectRoot,
    batchFiles: files,
  });
  const outputPath = join(graphPaths(projectRoot).scratch, "extract-output.json");
  await runNode(
    [join(scriptsDir, "extract-structure.mjs"), inputPath, outputPath],
    projectRoot,
  );
  const parsed = JSON.parse(readFileSync(outputPath, "utf8")) as { results?: ExtractResult[] };
  return Array.isArray(parsed.results) ? parsed.results : [];
}

async function fingerprintInventory(
  projectRoot: string,
  files: ScanFile[],
  headSha: string,
): Promise<FingerprintStore> {
  const { registry, structural } = await openRegistry();
  const store: Record<string, FileFingerprint> = {};
  for (const file of files) {
    const content = (await show(projectRoot, file.path)).toString("utf8");
    store[file.path] = fingerprintFile(registry, structural, file.path, content);
  }
  return {
    version: "1.0.0",
    gitCommitHash: headSha,
    generatedAt: new Date().toISOString(),
    files: store,
  };
}

function fingerprintFile(
  registry: PluginRegistry,
  structural: Set<string>,
  filePath: string,
  content: string,
): FileFingerprint {
  const language = registry.getLanguageForFile(filePath);
  const analysis = language == null ? null : registry.analyzeFile(filePath, content);
  if (analysis != null && language != null && structural.has(language)) {
    return extractFileFingerprint(filePath, content, analysis);
  }
  return {
    filePath,
    contentHash: contentHash(content),
    functions: [],
    classes: [],
    imports: [],
    exports: [],
    totalLines: content.split("\n").length,
    hasStructuralAnalysis: false,
  };
}

async function openRegistry(): Promise<{ registry: PluginRegistry; structural: Set<string> }> {
  const configs = builtinLanguageConfigs.filter((config) => config.treeSitter);
  const plugin = new TreeSitterPlugin(configs);
  await plugin.init();
  const registry = new PluginRegistry();
  registry.register(plugin);
  registerAllParsers(registry);
  return { registry, structural: new Set(configs.map((config) => config.id)) };
}

async function readManifests(
  projectRoot: string,
  files: ScanFile[],
): Promise<Record<string, string>> {
  const manifests: Record<string, string> = {};
  for (const file of files) {
    const name = file.path.split("/").at(-1) ?? "";
    if (!MANIFEST_NAMES.has(name)) continue;
    manifests[file.path] = (await show(projectRoot, file.path)).toString("utf8");
  }
  return manifests;
}

function frameworkIds(manifests: Record<string, string>): string[] {
  if (Object.keys(manifests).length === 0) return [];
  return FrameworkRegistry.createDefault()
    .detectFrameworks(manifests)
    .map((framework) => framework.id)
    .sort(compareText);
}

async function validateSymbols(
  projectRoot: string,
  graph: KnowledgeGraph,
  intermediateDir: string,
): Promise<{ ok: boolean }> {
  const validator = await import(
    pathToFileURL(join(scriptsDir, "validate-incremental-symbols.mjs")).href
  ) as {
    validateIncrementalSymbols: (
      root: string,
      options: { graph: KnowledgeGraph; intermediateDir: string },
    ) => Promise<{ ok: boolean }>;
  };
  return validator.validateIncrementalSymbols(projectRoot, { graph, intermediateDir });
}

function widenSeeds(
  plan: IncrementalPlan,
  importMap: Record<string, string[]>,
  inventory: Map<string, ScanFile>,
): string[] {
  const seeds = new Set(plan.filesToReanalyze.filter((filePath) => inventory.has(filePath)));
  let grew = true;
  while (grew) {
    grew = false;
    for (const [source, deps] of Object.entries(importMap)) {
      if (!inventory.has(source) || seeds.has(source) || !Array.isArray(deps)) continue;
      if (deps.some((dep) => seeds.has(dep))) {
        seeds.add(source);
        grew = true;
      }
    }
  }
  return [...seeds].sort(compareText);
}

function importTargets(
  importMap: Record<string, string[]>,
  seeds: string[],
  inventory: Map<string, ScanFile>,
): string[] {
  const seedSet = new Set(seeds);
  const targets = new Set<string>();
  for (const seed of seeds) {
    for (const target of importMap[seed] ?? []) {
      if (inventory.has(target) && !seedSet.has(target)) targets.add(target);
    }
  }
  return [...targets].sort(compareText);
}

function toAssembleFiles(files: ScanFile[], results: ExtractResult[]): AssembleFile[] {
  const byPath = new Map(results.map((result) => [result.path, result]));
  return files.map((file) => {
    const result = byPath.get(file.path);
    if (result == null) {
      return {
        path: file.path,
        language: file.language,
        fileCategory: file.fileCategory,
        analysis: null,
        structureOutcome: "skipped" as const,
      };
    }
    return {
      path: file.path,
      language: file.language,
      fileCategory: file.fileCategory,
      analysis: analysisFromExtract(result),
      calls: result.callGraph ?? [],
      structureOutcome: "succeeded" as const,
    };
  });
}

function analysisFromExtract(result: ExtractResult): StructuralAnalysis | null {
  const functions = (result.functions ?? []).map((fn) => ({
    name: fn.name,
    lineRange: [fn.startLine, fn.endLine] as [number, number],
    params: fn.params ?? [],
  }));
  const classes = (result.classes ?? []).map((cls) => ({
    name: cls.name,
    lineRange: [cls.startLine, cls.endLine] as [number, number],
    methods: cls.methods ?? [],
    properties: cls.properties ?? [],
  }));
  const exports = (result.exports ?? []).map((exp) => ({
    name: exp.name,
    lineNumber: exp.line,
    isDefault: exp.isDefault === true,
  }));
  const definitions = (result.definitions ?? []).map((definition) => ({
    name: definition.name,
    kind: definition.kind,
    lineRange: [definition.startLine, definition.endLine] as [number, number],
    fields: definition.fields ?? [],
  }));
  const services = (result.services ?? []).map((service) => ({
    name: service.name,
    image: service.image,
    ports: service.ports ?? [],
    ...(service.startLine != null && service.endLine != null
      ? { lineRange: [service.startLine, service.endLine] as [number, number] }
      : {}),
  }));
  const endpoints = (result.endpoints ?? []).map((endpoint) => ({
    method: endpoint.method,
    path: endpoint.path,
    lineRange: [endpoint.startLine, endpoint.endLine] as [number, number],
  }));
  const steps = (result.steps ?? []).map((step) => ({
    name: step.name,
    lineRange: [step.startLine, step.endLine] as [number, number],
  }));
  const resources = (result.resources ?? []).map((resource) => ({
    name: resource.name,
    kind: resource.kind,
    lineRange: [resource.startLine, resource.endLine] as [number, number],
  }));
  if (
    functions.length === 0
    && classes.length === 0
    && exports.length === 0
    && definitions.length === 0
    && services.length === 0
    && endpoints.length === 0
    && steps.length === 0
    && resources.length === 0
  ) {
    return null;
  }
  return {
    functions,
    classes,
    imports: [],
    exports,
    ...(definitions.length > 0 ? { definitions } : {}),
    ...(services.length > 0 ? { services } : {}),
    ...(endpoints.length > 0 ? { endpoints } : {}),
    ...(steps.length > 0 ? { steps } : {}),
    ...(resources.length > 0 ? { resources } : {}),
  };
}

function partialReasons(
  partialFiles: string[],
  droppedCalls: Array<{ filePath: string }>,
): string[] {
  return [
    ...partialFiles.map((filePath) => `unparsed:${filePath}`),
    ...droppedCalls.map((call) => `ambiguous-call:${call.filePath}`),
  ];
}

function nextReasons(previous: string[], replacePaths: Set<string>, added: string[]): string[] {
  const kept = previous.filter((reason) => {
    const index = reason.lastIndexOf(":");
    if (index === -1) return true;
    return !replacePaths.has(reason.slice(index + 1));
  });
  return [...new Set([...kept, ...added])].sort(compareText);
}

function applyCrossEdges(graph: KnowledgeGraph, edges: GraphEdge[]): KnowledgeGraph {
  const ids = new Set(graph.nodes.map((node) => node.id));
  const seen = new Set(graph.edges.map((edge) => edgeKey(edge)));
  const next = [...graph.edges];
  for (const edge of edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) continue;
    const key = edgeKey(edge);
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(edge);
  }
  return { ...graph, edges: next };
}

function dropDanglingEdges(graph: KnowledgeGraph): KnowledgeGraph {
  const ids = new Set(graph.nodes.map((node) => node.id));
  return {
    ...graph,
    edges: graph.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)),
  };
}

function dedupeNodes(nodes: GraphNode[]): GraphNode[] {
  const byId = new Map<string, GraphNode>();
  for (const node of nodes) byId.set(node.id, node);
  return [...byId.values()];
}

function edgeKey(edge: { source: string; target: string; type: string; direction: string }): string {
  return `${edge.source}\0${edge.target}\0${edge.type}\0${edge.direction}`;
}

function mergeFingerprints(
  existing: FingerprintStore | null,
  patch: FingerprintPatch,
  headSha: string,
): FingerprintStore {
  const files = { ...(existing?.files ?? {}) };
  for (const filePath of patch.deletedFiles ?? []) delete files[filePath];
  for (const [filePath, fingerprint] of Object.entries(patch.files ?? {})) {
    files[filePath] = fingerprint;
  }
  return {
    version: "1.0.0",
    gitCommitHash: headSha,
    generatedAt: new Date().toISOString(),
    files,
  };
}

function writeBaselineScan(
  projectRoot: string,
  scan: ScanResult,
  importMap: Record<string, string[]>,
): void {
  const complete: Record<string, string[]> = {};
  for (const file of scan.files) {
    const targets = importMap[file.path];
    complete[file.path] = Array.isArray(targets) ? [...targets] : [];
  }
  writeScratchJson(projectRoot, "scan-result.json", { ...scan, importMap: complete });
}

function readPlan(projectRoot: string): IncrementalPlan {
  const plan = JSON.parse(
    readFileSync(join(graphPaths(projectRoot).scratch, "incremental-plan.json"), "utf8"),
  ) as IncrementalPlan;
  if (
    plan == null
    || typeof plan.action !== "string"
    || typeof plan.baseCommit !== "string"
    || typeof plan.headCommit !== "string"
    || !Array.isArray(plan.filesToReanalyze)
    || !Array.isArray(plan.deletedFiles)
  ) {
    throw new Error("incremental plan is missing");
  }
  return plan;
}

function readScan(projectRoot: string): ScanResult {
  return parseScan(JSON.parse(
    readFileSync(join(graphPaths(projectRoot).scratch, "scan-result.json"), "utf8"),
  ));
}

function parseScan(value: unknown): ScanResult {
  const scan = value as ScanResult;
  if (!Array.isArray(scan?.files)) throw new Error("scan output is missing files");
  if (Array.isArray(scan.failures) && scan.failures.length > 0) {
    throw new Error(`scan reported ${scan.failures.length} failure(s)`);
  }
  return scan;
}

function readPatch(projectRoot: string): FingerprintPatch {
  const filePath = join(graphPaths(projectRoot).scratch, "fingerprint-patch.json");
  if (!existsSync(filePath)) return {};
  const patch = JSON.parse(readFileSync(filePath, "utf8")) as FingerprintPatch;
  return patch ?? {};
}

function languagesOf(files: ScanFile[]): string[] {
  return [...new Set(
    files
      .map((file) => file.language)
      .filter((language): language is string => typeof language === "string" && language.length > 0),
  )].sort(compareText);
}

function coverageReport(built: BuiltGraph, scope: string | undefined): FreshnessReport {
  return finish(built.partial ? "PARTIAL" : "AVAILABLE", scope, {
    analyzed_sha: built.analyzed_sha,
    head: built.head,
    rebuilt: true,
  });
}

function finish(
  status: GraphStatus,
  scope: string | undefined,
  extra: Omit<FreshnessReport, "status" | "scope"> = {},
): FreshnessReport {
  return { status, scope, ...extra };
}

function failureReport(error: unknown, projectRoot: string, scope: string | undefined): FreshnessReport {
  if (error instanceof LeavePrevious) {
    return finish(error.status, scope, { reason: error.reason });
  }
  if (isGitHeadError(error)) {
    return finish("UNAVAILABLE", scope, { reason: "git-head-unavailable" });
  }
  const exists = existsSync(graphPaths(projectRoot).graph);
  return finish(exists ? "STALE_RECOVERABLE" : "UNAVAILABLE", scope, {
    reason: errorText(error).split("\n")[0]?.slice(0, 500) || "reconcile-failed",
  });
}

async function readHead(projectRoot: string): Promise<string> {
  const headSha = await head(projectRoot);
  if (headSha.length === 0) {
    throw new Error("git rev-parse HEAD failed: empty hash");
  }
  return headSha;
}

function allowsInitialBuild(caller: string | undefined): boolean {
  if (typeof caller !== "string") return false;
  const value = caller.trim().toLowerCase();
  return ["/pk-setup", "pk-setup", "/setup", "setup", "eval", "/eval"].includes(value);
}

function isGitHeadError(error: unknown): boolean {
  return errorText(error).includes("rev-parse HEAD");
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function compareText(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function runNode(args: string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      args,
      {
        cwd,
        timeout: 120_000,
        maxBuffer: 64 * 1024 * 1024,
        encoding: "utf8",
        windowsHide: true,
      },
      (error, _stdout, stderr) => {
        if (error) {
          const detail = typeof stderr === "string" ? stderr.trim() : "";
          reject(new Error(detail || error.message));
          return;
        }
        resolve();
      },
    );
  });
}
