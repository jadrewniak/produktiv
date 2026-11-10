/**
 * Deterministic structural assembler.
 *
 * Parser output (structural analysis, the import map, and unresolved call
 * entries for HEAD paths) becomes a KnowledgeGraph. Summaries are the node
 * name. Ambiguous calls are omitted and reported so the caller can surface
 * PARTIAL. This module does not call a model.
 */

import path from "node:path";
import { head } from "../adapters/host/git.mjs";
import {
  FrameworkRegistry,
  GraphBuilder,
  validateGraph,
} from "../vendor/understand-anything/dist/index.js";
import type {
  CallGraphEntry,
  GraphEdge,
  GraphNode,
  ReferenceResolution,
  StructuralAnalysis,
} from "../vendor/understand-anything/dist/index.js";

/** Bump when a stored graph must be rebuilt from scratch. */
export const ASSEMBLER_VERSION = "1";

const STRUCTURAL_COMPLEXITY = "moderate" as const;

const DOC_EXTENSIONS = new Set([".md", ".mdx"]);
const CONFIG_EXTENSIONS = new Set([
  ".yaml",
  ".yml",
  ".json",
  ".jsonc",
  ".toml",
  ".xml",
  ".ini",
  ".env",
  ".properties",
]);

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/**
 * GraphBuilder maps `type`, `enum`, and `message` to `schema` and leaves the
 * other GraphQL definition kinds as `concept`. v1 does not emit `concept`.
 * The id stays `<kind>:<path>:<name>`.
 */
const SCHEMA_DEFINITION_KINDS = new Set(["input", "interface", "union", "scalar"]);

export interface AssembleFile {
  path: string;
  fileCategory?: string;
  /** Carried on scan records. Node type follows fileCategory and the path. */
  language?: string;
  analysis?: StructuralAnalysis | null;
  calls?: CallGraphEntry[] | null;
  references?: ReferenceResolution[];
  /** `skipped` means no parser. `failed` means the parser did not return structure. */
  structureOutcome?: "succeeded" | "failed" | "skipped";
}

export interface AssembleInput {
  projectRoot: string;
  projectName?: string;
  files: AssembleFile[];
  /** Source path to resolved project-relative paths. */
  importMap?: Record<string, string[]>;
  /** Manifest path to committed blob text. Keyword detection only. */
  manifests?: Record<string, string>;
}

export interface DroppedCall {
  filePath: string;
  caller: string;
  callee: string;
  lineNumber: number;
  reason: "ambiguous";
}

export interface StructuralGraphNode extends GraphNode {
  evidence: "structural" | "docs";
  owner?: string | null;
}

export interface AssembleResult {
  graph: {
    version: string;
    kind?: "codebase" | "knowledge" | "design";
    project: {
      name: string;
      languages: string[];
      frameworks: string[];
      description: string;
      analyzedAt: string;
      gitCommitHash: string;
    };
    nodes: StructuralGraphNode[];
    edges: GraphEdge[];
    layers: [];
    tour: [];
  };
  /** True when a parser is missing or an ambiguous call was dropped. */
  partial: boolean;
  droppedCalls: DroppedCall[];
  partialFiles: string[];
}

interface PreparedFile {
  path: string;
  parent: "file" | "config" | "document";
  analysis: StructuralAnalysis | null;
  calls: CallGraphEntry[];
  references: ReferenceResolution[];
  partial: boolean;
}

interface SymbolRef {
  id: string;
  filePath: string;
  name: string;
  kind: "function" | "class";
  startLine: number;
  owner?: string | null;
}

interface FileIndex {
  path: string;
  symbols: SymbolRef[];
  exportNames: Set<string>;
}

type Resolution =
  | { status: "unique"; symbol: SymbolRef }
  | { status: "ambiguous" }
  | { status: "unresolved" };

interface PendingClassCall {
  sourceId: string;
  targetId: string;
}

export async function assemble(input: AssembleInput): Promise<AssembleResult> {
  if (input == null || typeof input.projectRoot !== "string" || input.projectRoot.length === 0) {
    throw new Error("projectRoot is required");
  }
  if (!Array.isArray(input.files) || input.files.length === 0) {
    throw new Error("assemble requires at least one file");
  }

  const projectRoot = path.resolve(input.projectRoot);
  const gitCommitHash = await head(projectRoot);
  if (gitCommitHash.length === 0) {
    throw new Error("git rev-parse HEAD returned an empty hash");
  }

  const projectName = input.projectName?.trim() || path.basename(projectRoot);
  if (projectName.length === 0) {
    throw new Error("project name is empty");
  }

  const prepared = prepareFiles(input.files);
  const fileNodeIds = new Map<string, string>();
  const indexes = new Map<string, FileIndex>();

  const builder = new GraphBuilder(projectName, gitCommitHash);
  for (const file of prepared) {
    fileNodeIds.set(file.path, `${file.parent}:${file.path}`);
    indexes.set(file.path, indexFile(file));
    emitFile(builder, file);
  }

  const importMap = normalizeImportMap(input.importMap, fileNodeIds);
  for (const [fromFile, targets] of importMap) {
    for (const toFile of targets) {
      if (fromFile === toFile) continue;
      builder.addImportEdge(fromFile, toFile);
    }
  }

  const droppedCalls: DroppedCall[] = [];
  const classCalls: PendingClassCall[] = [];
  for (const file of prepared) {
    resolveCalls(file, indexes, importMap, builder, droppedCalls, classCalls);
  }

  const built = builder.build();
  const nodes = built.nodes as StructuralGraphNode[];
  let edges = retargetImportEdges(built.edges, fileNodeIds);
  edges = appendUniqueEdges(edges, classCalls, nodes);
  edges = appendDocumentEdges(edges, prepared, fileNodeIds);

  promoteSchemaDefinitions(nodes, prepared);
  stampNodes(nodes, indexes);

  const graph = {
    version: built.version,
    kind: "codebase" as const,
    project: {
      ...built.project,
      name: projectName,
      description: "",
      gitCommitHash,
      frameworks: frameworkIds(input.manifests),
    },
    nodes,
    edges,
    layers: [] as [],
    tour: [] as [],
  };

  const validated = validateGraph(graph);
  if (!validated.success) {
    throw new Error(validated.fatal ?? "assemble produced a graph validateGraph rejected");
  }

  const partialFiles = prepared.filter((file) => file.partial).map((file) => file.path);
  return {
    graph,
    partial: partialFiles.length > 0 || droppedCalls.length > 0,
    droppedCalls,
    partialFiles,
  };
}

function prepareFiles(files: AssembleFile[]): PreparedFile[] {
  const prepared: PreparedFile[] = [];
  const seen = new Set<string>();
  for (const file of files) {
    const filePath = normalizeRepoPath(file.path);
    if (seen.has(filePath)) {
      throw new Error(`duplicate path in assemble input: ${filePath}`);
    }
    seen.add(filePath);
    const analysis = normalizeAnalysis(file.analysis);
    const parent = parentNodeType(file, filePath);
    const partial = file.structureOutcome === "skipped"
      || file.structureOutcome === "failed"
      || (analysis == null && file.structureOutcome !== "succeeded");
    prepared.push({
      path: filePath,
      parent,
      analysis,
      calls: file.calls ?? [],
      references: file.references ?? [],
      partial,
    });
  }
  return prepared;
}

function parentNodeType(file: AssembleFile, filePath: string): "file" | "config" | "document" {
  if (file.fileCategory === "docs") return "document";
  if (file.fileCategory === "config") return "config";
  if (file.fileCategory) return "file";

  const base = path.posix.basename(filePath);
  const ext = path.posix.extname(filePath).toLowerCase();
  if (DOC_EXTENSIONS.has(ext)) return "document";
  if (base === ".env" || base.startsWith(".env.") || CONFIG_EXTENSIONS.has(ext)) return "config";
  return "file";
}

function normalizeAnalysis(analysis: StructuralAnalysis | null | undefined): StructuralAnalysis | null {
  if (analysis == null) return null;
  return {
    functions: analysis.functions ?? [],
    classes: analysis.classes ?? [],
    imports: analysis.imports ?? [],
    exports: analysis.exports ?? [],
    definitions: analysis.definitions,
    services: analysis.services,
    endpoints: analysis.endpoints,
    steps: analysis.steps,
    resources: analysis.resources,
  };
}

function emitFile(builder: GraphBuilder, file: PreparedFile): void {
  const meta = {
    summary: "",
    tags: [] as string[],
    complexity: STRUCTURAL_COMPLEXITY,
  };

  // One document node. Heading sections stay off the graph.
  if (file.parent === "document" || file.analysis == null) {
    if (file.parent === "file") {
      builder.addFile(file.path, meta);
    } else {
      builder.addNonCodeFile(file.path, { ...meta, nodeType: file.parent });
    }
    return;
  }

  const hasCode = file.parent === "file"
    && (file.analysis.functions.length > 0 || file.analysis.classes.length > 0);
  if (hasCode) {
    builder.addFileWithAnalysis(file.path, {
      functions: file.analysis.functions,
      classes: file.analysis.classes,
      imports: file.analysis.imports,
      exports: file.analysis.exports,
    }, {
      summary: "",
      summaries: {},
      fileSummary: "",
      tags: [],
      complexity: STRUCTURAL_COMPLEXITY,
    });
    return;
  }

  const hasParserNodes = Boolean(
    file.analysis.definitions?.length
    || file.analysis.services?.length
    || file.analysis.endpoints?.length
    || file.analysis.steps?.length
    || file.analysis.resources?.length,
  );
  if (hasParserNodes) {
    builder.addNonCodeFileWithAnalysis(file.path, {
      ...meta,
      nodeType: file.parent,
      definitions: file.analysis.definitions,
      services: file.analysis.services,
      endpoints: file.analysis.endpoints,
      steps: file.analysis.steps,
      resources: file.analysis.resources,
    });
    return;
  }

  if (file.parent === "file") builder.addFile(file.path, meta);
  else builder.addNonCodeFile(file.path, { ...meta, nodeType: file.parent });
}

function indexFile(file: PreparedFile): FileIndex {
  const symbols: SymbolRef[] = [];
  const nodeIds = new Set<string>();
  const analysis = file.analysis;
  const emittedCode = file.parent === "file"
    && analysis != null
    && (analysis.functions.length > 0 || analysis.classes.length > 0);
  if (!emittedCode || analysis == null) {
    return { path: file.path, symbols, exportNames: new Set() };
  }

  // Match GraphBuilder: the first function of a name keeps the bare id,
  // and a later duplicate gains #startLine.
  for (const fn of analysis?.functions ?? []) {
    const base = `function:${file.path}:${fn.name}`;
    const id = nodeIds.has(base) ? `${base}#${fn.lineRange[0]}` : base;
    if (nodeIds.has(id)) continue;
    nodeIds.add(id);
    const symbol: SymbolRef = {
      id,
      filePath: file.path,
      name: fn.name,
      kind: "function",
      startLine: fn.lineRange[0],
    };
    if (fn.owner !== undefined) symbol.owner = fn.owner;
    symbols.push(symbol);
  }

  for (const cls of analysis?.classes ?? []) {
    const id = `class:${file.path}:${cls.name}`;
    symbols.push({
      id,
      filePath: file.path,
      name: cls.name,
      kind: "class",
      startLine: cls.lineRange[0],
    });
  }

  return {
    path: file.path,
    symbols,
    exportNames: new Set((analysis?.exports ?? []).map((entry) => entry.name)),
  };
}

function normalizeImportMap(
  importMap: Record<string, string[]> | undefined,
  fileNodeIds: Map<string, string>,
): Map<string, string[]> {
  const normalized = new Map<string, string[]>();
  if (importMap == null) return normalized;
  for (const [rawFrom, targets] of Object.entries(importMap)) {
    const fromFile = tryNormalizeRepoPath(rawFrom);
    if (fromFile == null || !fileNodeIds.has(fromFile) || !Array.isArray(targets)) continue;
    const resolved: string[] = [];
    const seen = new Set<string>();
    for (const rawTo of targets) {
      if (typeof rawTo !== "string") continue;
      const toFile = tryNormalizeRepoPath(rawTo);
      if (toFile == null || !fileNodeIds.has(toFile) || seen.has(toFile)) continue;
      seen.add(toFile);
      resolved.push(toFile);
    }
    normalized.set(fromFile, resolved);
  }
  return normalized;
}

function resolveCalls(
  file: PreparedFile,
  indexes: Map<string, FileIndex>,
  importMap: Map<string, string[]>,
  builder: GraphBuilder,
  droppedCalls: DroppedCall[],
  classCalls: PendingClassCall[],
): void {
  const local = indexes.get(file.path);
  if (!local) return;

  for (const call of file.calls) {
    const caller = resolveCaller(local, call.caller);
    const callee = resolveCallee(file.path, call.callee, indexes, importMap);
    if (caller.status === "ambiguous" || callee.status === "ambiguous") {
      droppedCalls.push({
        filePath: file.path,
        caller: call.caller,
        callee: call.callee,
        lineNumber: call.lineNumber,
        reason: "ambiguous",
      });
      continue;
    }
    if (caller.status !== "unique" || callee.status !== "unique") continue;

    if (callee.symbol.kind === "function") {
      builder.addCallEdge(
        caller.symbol.filePath,
        caller.symbol.name,
        callee.symbol.filePath,
        callee.symbol.name,
        caller.symbol.startLine,
        callee.symbol.startLine,
      );
      continue;
    }

    classCalls.push({
      sourceId: caller.symbol.id,
      targetId: callee.symbol.id,
    });
  }
}

function resolveCaller(local: FileIndex, caller: string): Resolution {
  return resolveNamed(local, caller, ["function"]);
}

function resolveCallee(
  filePath: string,
  callee: string,
  indexes: Map<string, FileIndex>,
  importMap: Map<string, string[]>,
): Resolution {
  const local = indexes.get(filePath);
  if (!local) return { status: "unresolved" };

  const inFile = resolveNamed(local, callee, ["function", "class"]);
  if (inFile.status !== "unresolved") return inFile;

  const hits: SymbolRef[] = [];
  for (const imported of importMap.get(filePath) ?? []) {
    const target = indexes.get(imported);
    if (!target) continue;
    const exported = exportedHits(target, callee);
    if (exported === "ambiguous") return { status: "ambiguous" };
    if (exported) hits.push(exported);
  }
  if (hits.length > 1) return { status: "ambiguous" };
  if (hits.length === 1) return { status: "unique", symbol: hits[0] };
  return { status: "unresolved" };
}

function exportedHits(file: FileIndex, callee: string): SymbolRef | "ambiguous" | null {
  const names = candidateNames(callee);
  for (const name of names) {
    if (!file.exportNames.has(name)) continue;
    const hits = file.symbols.filter((symbol) => symbol.name === name);
    if (hits.length > 1) return "ambiguous";
    if (hits.length === 1) return hits[0];
  }
  return null;
}

function resolveNamed(
  file: FileIndex,
  rawName: string,
  kinds: Array<SymbolRef["kind"]>,
): Resolution {
  for (const name of candidateNames(rawName)) {
    const hits = file.symbols.filter((symbol) => symbol.name === name && kinds.includes(symbol.kind));
    if (hits.length > 1) return { status: "ambiguous" };
    if (hits.length === 1) return { status: "unique", symbol: hits[0] };
  }
  return { status: "unresolved" };
}

function candidateNames(rawName: string): string[] {
  const names: string[] = [];
  if (rawName.length > 0) names.push(rawName);
  const simple = simpleName(rawName);
  if (simple && simple !== rawName) names.push(simple);
  return names;
}

function simpleName(callee: string): string | null {
  let text = callee.trim();
  if (text.startsWith("new ")) text = text.slice(4).trim();
  if (text.length === 0 || /[\s(){}[\]<>`'"]/.test(text)) return null;
  const parts = text.split(/\.|::/);
  const last = parts[parts.length - 1];
  if (!last || !IDENTIFIER.test(last) || last === "this" || last === "super") return null;
  return last;
}

function retargetImportEdges(edges: GraphEdge[], fileNodeIds: Map<string, string>): GraphEdge[] {
  const seen = new Set<string>();
  const next: GraphEdge[] = [];
  for (const edge of edges) {
    if (edge.type !== "imports") {
      next.push(edge);
      continue;
    }
    const source = fileNodeId(edge.source, fileNodeIds);
    const target = fileNodeId(edge.target, fileNodeIds);
    if (source === target) continue;
    const key = `imports\0${source}\0${target}`;
    if (seen.has(key)) continue;
    seen.add(key);
    next.push({ ...edge, source, target });
  }
  return next;
}

function fileNodeId(nodeId: string, fileNodeIds: Map<string, string>): string {
  if (!nodeId.startsWith("file:")) return nodeId;
  return fileNodeIds.get(nodeId.slice("file:".length)) ?? nodeId;
}

function appendUniqueEdges(
  edges: GraphEdge[],
  classCalls: PendingClassCall[],
  nodes: StructuralGraphNode[],
): GraphEdge[] {
  const nodeIds = new Set(nodes.map((node) => node.id));
  const seen = new Set(edges.filter((edge) => edge.type === "calls").map((edge) => `${edge.source}\0${edge.target}`));
  const next = edges.slice();
  for (const call of classCalls) {
    if (!nodeIds.has(call.sourceId) || !nodeIds.has(call.targetId)) continue;
    const key = `${call.sourceId}\0${call.targetId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    next.push({
      source: call.sourceId,
      target: call.targetId,
      type: "calls",
      direction: "forward",
      weight: 0.8,
    });
  }
  return next;
}

function appendDocumentEdges(
  edges: GraphEdge[],
  files: PreparedFile[],
  fileNodeIds: Map<string, string>,
): GraphEdge[] {
  const known = new Set(fileNodeIds.keys());
  const seen = new Set<string>();
  const next = edges.slice();
  for (const file of files) {
    if (file.parent !== "document") continue;
    const source = fileNodeIds.get(file.path);
    if (!source) continue;
    for (const reference of file.references) {
      const targetPath = resolveDocumentTarget(file.path, reference.target, known);
      if (!targetPath) continue;
      const target = fileNodeIds.get(targetPath);
      if (!target || target === source) continue;
      const key = `${source}\0${target}`;
      if (seen.has(key)) continue;
      seen.add(key);
      next.push({
        source,
        target,
        type: "documents",
        direction: "forward",
        weight: 0.5,
      });
    }
  }
  return next;
}

function resolveDocumentTarget(fromFile: string, target: string, known: Set<string>): string | null {
  const trimmed = target.trim();
  if (trimmed.length === 0 || trimmed.startsWith("#")) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return null;

  const pathOnly = trimmed.split("#", 1)[0]?.split("?", 1)[0] ?? "";
  if (pathOnly.length === 0) return null;

  const posix = pathOnly.split("\\").join("/");
  const relative = posix.startsWith("/")
    ? path.posix.normalize(posix.slice(1))
    : path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), posix));
  if (relative.length === 0 || relative === "." || relative.split("/").includes("..")) return null;
  if (!known.has(relative)) return null;
  return relative;
}

function promoteSchemaDefinitions(nodes: StructuralGraphNode[], files: PreparedFile[]): void {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  for (const file of files) {
    for (const definition of file.analysis?.definitions ?? []) {
      if (!SCHEMA_DEFINITION_KINDS.has(definition.kind)) continue;
      const node = byId.get(`${definition.kind}:${file.path}:${definition.name}`);
      if (node?.type === "concept") node.type = "schema";
    }
  }
}

function stampNodes(nodes: StructuralGraphNode[], indexes: Map<string, FileIndex>): void {
  const byId = new Map<string, SymbolRef>();
  for (const index of indexes.values()) {
    for (const symbol of index.symbols) {
      if (symbol.kind === "function" && symbol.owner !== undefined && !byId.has(symbol.id)) {
        byId.set(symbol.id, symbol);
      }
    }
  }

  for (const node of nodes) {
    node.evidence = node.type === "document" ? "docs" : "structural";
    const symbol = byId.get(node.id);
    if (symbol && symbol.owner !== undefined) node.owner = symbol.owner;
  }
}

function frameworkIds(manifests: Record<string, string> | undefined): string[] {
  if (manifests == null || Object.keys(manifests).length === 0) return [];
  const registry = FrameworkRegistry.createDefault();
  return registry
    .detectFrameworks(manifests)
    .map((framework) => framework.id)
    .sort((left, right) => left.localeCompare(right));
}

function normalizeRepoPath(filePath: string): string {
  const normalized = tryNormalizeRepoPath(filePath);
  if (normalized == null) {
    throw new Error(`refusing path: ${filePath}`);
  }
  return normalized;
}

function tryNormalizeRepoPath(filePath: string): string | null {
  if (typeof filePath !== "string" || filePath.length === 0 || filePath.includes("\0")) return null;
  const posix = filePath.split("\\").join("/");
  if (posix.startsWith("/") || /^[A-Za-z]:\//.test(posix)) return null;
  if (posix.split("/").includes("..")) return null;
  const cleaned = posix
    .split("/")
    .filter((part) => part.length > 0 && part !== ".")
    .join("/");
  return cleaned.length > 0 ? cleaned : null;
}
