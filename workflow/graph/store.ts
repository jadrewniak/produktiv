/**
 * Project-local graph store.
 *
 * Published files live under `.workflow/graph/`. Scratch lives under
 * `.workflow/cache/graph/` and is safe to delete. Writes are a temp file
 * in the destination directory followed by rename, so a crash keeps the
 * previous graph.
 *
 * Path sanitizing matches upstream `sanitiseFilePaths` in
 * `workflow/vendor/understand-anything/core/src/persistence/index.ts`:
 * absolute paths inside the project become relative, absolute paths
 * outside become the basename, and relative paths stay as they are.
 * That helper is not exported and still writes `.ua/`. This module applies
 * the same rules on the v1 layout instead of forking persistence.
 */

import { randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, isAbsolute, join, relative } from "node:path";
import { validateGraph } from "../vendor/understand-anything/dist/schema.js";
import type { FingerprintStore } from "../vendor/understand-anything/dist/fingerprint.js";
import type { KnowledgeGraph } from "../vendor/understand-anything/dist/types.js";

/** UA graph schema string. An incompatible value forces a full rebuild. */
export const GRAPH_SCHEMA = "1.0.0";

/**
 * Vendored core pin plus grammar set. Bump when the parser surface changes
 * so the next `ensure_fresh` cannot reuse the envelope.
 */
export const PARSER_VERSION = "6df3065f1d8ddc2ce3615314d1d493f36d6b1c80";

export const GRAPH_FILE = "knowledge-graph.json";
export const META_FILE = "meta.json";
export const FINGERPRINT_FILE = "fingerprints.json";
export const IGNORE_FILE = "ignore";

export interface GraphMeta {
  analyzed_sha: string;
  gitCommitHash: string;
  graph_schema: string;
  assembler_version: string;
  parser_version: string;
  project_root_realpath: string;
  lastAnalyzedAt: string;
  analyzedFiles: number;
  version: string;
  partial: boolean;
  partial_reasons: string[];
}

export type StoreProblem =
  | { kind: "missing" }
  | { kind: "corrupt-json"; file: string }
  | { kind: "invalid-graph"; fatal: string }
  | { kind: "version-mismatch"; field: string }
  | { kind: "realpath-mismatch" }
  | { kind: "absent-sha" }
  | { kind: "inconsistent" };

export interface StoreLoad {
  problem: StoreProblem | null;
  meta: GraphMeta | null;
  graph: KnowledgeGraph | null;
  fingerprints: FingerprintStore | null;
}

export interface PublishInput {
  graph: KnowledgeGraph;
  fingerprints: FingerprintStore;
  partialReasons: string[];
  analyzedFiles: number;
  assemblerVersion: string;
}

export function graphPaths(projectRoot: string): {
  dir: string;
  graph: string;
  meta: string;
  fingerprints: string;
  ignore: string;
  scratch: string;
} {
  const dir = join(projectRoot, ".workflow", "graph");
  const scratch = join(projectRoot, ".workflow", "cache", "graph");
  return {
    dir,
    graph: join(dir, GRAPH_FILE),
    meta: join(dir, META_FILE),
    fingerprints: join(dir, FINGERPRINT_FILE),
    ignore: join(dir, IGNORE_FILE),
    scratch,
  };
}

export function clearScratch(projectRoot: string): void {
  rmSync(graphPaths(projectRoot).scratch, { recursive: true, force: true });
}

export function sanitiseFilePaths<T extends { nodes: Array<{ filePath?: string }> }>(
  graph: T,
  projectRoot: string,
): T {
  const normalRoot = projectRoot.endsWith("/") ? projectRoot : `${projectRoot}/`;
  const nodes = graph.nodes.map((node) => {
    if (typeof node.filePath !== "string") return node;
    const filePath = node.filePath;
    if (!isAbsolute(filePath)) return node;
    if (filePath.startsWith(normalRoot) || filePath.startsWith(projectRoot)) {
      return { ...node, filePath: relative(projectRoot, filePath) };
    }
    return { ...node, filePath: basename(filePath) };
  });
  return { ...graph, nodes };
}

export function loadStore(projectRoot: string, assemblerVersion: string): StoreLoad {
  const paths = graphPaths(projectRoot);
  const fingerprints = readFingerprints(paths.fingerprints);
  if (!existsSync(paths.graph)) {
    return { problem: { kind: "missing" }, meta: null, graph: null, fingerprints };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(paths.graph, "utf8"));
  } catch {
    return {
      problem: { kind: "corrupt-json", file: GRAPH_FILE },
      meta: null,
      graph: null,
      fingerprints,
    };
  }

  let validated: ReturnType<typeof validateGraph>;
  try {
    validated = validateGraph(raw);
  } catch (error) {
    return {
      problem: { kind: "invalid-graph", fatal: errorText(error) },
      meta: null,
      graph: null,
      fingerprints,
    };
  }
  if (!validated.success) {
    return {
      problem: { kind: "invalid-graph", fatal: validated.fatal ?? "invalid-graph" },
      meta: null,
      graph: null,
      fingerprints,
    };
  }

  const graph = raw as KnowledgeGraph;
  if (!existsSync(paths.meta)) {
    return { problem: { kind: "absent-sha" }, meta: null, graph, fingerprints };
  }

  let metaRaw: unknown;
  try {
    metaRaw = JSON.parse(readFileSync(paths.meta, "utf8"));
  } catch {
    return {
      problem: { kind: "corrupt-json", file: META_FILE },
      meta: null,
      graph,
      fingerprints,
    };
  }

  const meta = asMeta(metaRaw);
  if (meta == null) {
    const analyzed = analyzedSha(metaRaw);
    return {
      problem: analyzed == null ? { kind: "absent-sha" } : { kind: "version-mismatch", field: "envelope" },
      meta: null,
      graph,
      fingerprints,
    };
  }

  const envelope = assessMeta(meta, projectRoot, assemblerVersion);
  if (envelope != null) {
    return { problem: envelope, meta, graph, fingerprints };
  }
  if (graph.project?.gitCommitHash !== meta.analyzed_sha) {
    return { problem: { kind: "inconsistent" }, meta, graph, fingerprints };
  }
  return { problem: null, meta, graph, fingerprints };
}

export function publishGraph(projectRoot: string, input: PublishInput): GraphMeta {
  const root = realpathSync(projectRoot);
  const sanitised = sanitiseFilePaths(input.graph, root);
  const analyzedSha = sanitised.project?.gitCommitHash;
  if (typeof analyzedSha !== "string" || analyzedSha.length === 0) {
    throw new Error("refusing to publish a graph without gitCommitHash");
  }
  const validated = validateGraph(sanitised);
  if (!validated.success) {
    throw new Error(validated.fatal ?? "refusing to publish an invalid graph");
  }

  const reasons = [...new Set(input.partialReasons)].sort(compareText);
  const meta: GraphMeta = {
    analyzed_sha: analyzedSha,
    gitCommitHash: analyzedSha,
    graph_schema: GRAPH_SCHEMA,
    assembler_version: input.assemblerVersion,
    parser_version: PARSER_VERSION,
    project_root_realpath: root,
    lastAnalyzedAt: sanitised.project.analyzedAt,
    analyzedFiles: input.analyzedFiles,
    version: GRAPH_SCHEMA,
    partial: reasons.length > 0,
    partial_reasons: reasons,
  };
  const fingerprints: FingerprintStore = {
    ...input.fingerprints,
    version: "1.0.0",
    gitCommitHash: analyzedSha,
  };
  const paths = graphPaths(root);
  atomicWriteJson(paths.graph, sanitised);
  atomicWriteJson(paths.fingerprints, fingerprints);
  atomicWriteJson(paths.meta, meta);
  return meta;
}

export function writeScratchJson(projectRoot: string, name: string, value: unknown): string {
  if (!/^[a-z0-9][a-z0-9.-]*\.json$/i.test(name)) {
    throw new Error(`refusing scratch name: ${name}`);
  }
  const filePath = join(graphPaths(projectRoot).scratch, name);
  mkdirSync(dirname(filePath), { recursive: true });
  atomicWriteJson(filePath, value);
  return filePath;
}

function assessMeta(meta: GraphMeta, projectRoot: string, assemblerVersion: string): StoreProblem | null {
  if (meta.graph_schema !== GRAPH_SCHEMA) return { kind: "version-mismatch", field: "graph_schema" };
  if (meta.assembler_version !== assemblerVersion) return { kind: "version-mismatch", field: "assembler_version" };
  if (meta.parser_version !== PARSER_VERSION) return { kind: "version-mismatch", field: "parser_version" };
  if (meta.project_root_realpath !== realpathSync(projectRoot)) {
    return { kind: "realpath-mismatch" };
  }
  if (meta.analyzed_sha !== meta.gitCommitHash) return { kind: "inconsistent" };
  return null;
}

function asMeta(value: unknown): GraphMeta | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const analyzed = typeof record.analyzed_sha === "string" ? record.analyzed_sha : "";
  const gitCommitHash = typeof record.gitCommitHash === "string" ? record.gitCommitHash : "";
  const graphSchema = typeof record.graph_schema === "string" ? record.graph_schema : "";
  const assemblerVersion = typeof record.assembler_version === "string" ? record.assembler_version : "";
  const parserVersion = typeof record.parser_version === "string" ? record.parser_version : "";
  const projectRoot = typeof record.project_root_realpath === "string" ? record.project_root_realpath : "";
  const lastAnalyzedAt = typeof record.lastAnalyzedAt === "string" ? record.lastAnalyzedAt : "";
  if (
    analyzed.length === 0
    || gitCommitHash.length === 0
    || graphSchema.length === 0
    || assemblerVersion.length === 0
    || parserVersion.length === 0
    || projectRoot.length === 0
    || lastAnalyzedAt.length === 0
    || typeof record.analyzedFiles !== "number"
  ) {
    return null;
  }
  const reasons = Array.isArray(record.partial_reasons)
    ? record.partial_reasons.filter((reason): reason is string => typeof reason === "string")
    : [];
  return {
    analyzed_sha: analyzed,
    gitCommitHash,
    graph_schema: graphSchema,
    assembler_version: assemblerVersion,
    parser_version: parserVersion,
    project_root_realpath: projectRoot,
    lastAnalyzedAt,
    analyzedFiles: record.analyzedFiles,
    version: typeof record.version === "string" ? record.version : graphSchema,
    partial: record.partial === true || reasons.length > 0,
    partial_reasons: reasons,
  };
}

function analyzedSha(value: unknown): string | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return null;
  const analyzed = (value as { analyzed_sha?: unknown }).analyzed_sha;
  return typeof analyzed === "string" && analyzed.length > 0 ? analyzed : null;
}

function readFingerprints(filePath: string): FingerprintStore | null {
  if (!existsSync(filePath)) return null;
  try {
    const value = JSON.parse(readFileSync(filePath, "utf8")) as FingerprintStore;
    if (
      value == null
      || typeof value !== "object"
      || Array.isArray(value)
      || value.files == null
      || typeof value.files !== "object"
      || Array.isArray(value.files)
    ) {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

function atomicWriteJson(filePath: string, value: unknown): void {
  const dir = dirname(filePath);
  mkdirSync(dir, { recursive: true });
  const tmp = join(dir, `.${basename(filePath)}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`);
  try {
    writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    renameSync(tmp, filePath);
  } catch (error) {
    try {
      unlinkSync(tmp);
    } catch {
      // The temp file is already gone. The destination is unchanged.
    }
    throw error;
  }
}

function compareText(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
