/**
 * ADAPT of Understand Anything 6df3065f1d8ddc2ce3615314d1d493f36d6b1c80
 * `src/diff-analyzer.ts` (`buildDiffContext`).
 * Frozen reason: structural edges only, depth (default 2), and evidence
 * classes. Each affected node keeps one shortest path from a changed node.
 * Markdown risk sections and prompt formatters are not copied.
 * Worktree and untracked paths are reported. This module does not parse
 * those bytes and does not write the persistent graph. Comment-only
 * classification belongs to the vendored change classifier, not here.
 */

import { diffNames, untrackedNames } from "../adapters/host/git.mjs";
import { createIgnoreFilter } from "../vendor/understand-anything/dist/ignore-filter.js";
import type { GraphNode, KnowledgeGraph, NodeType } from "../vendor/understand-anything/dist/types.js";
import {
  bfs,
  compareId,
  depthCapNote,
  indexNodes,
  normalizeScope,
  pathInScope,
  requireDepth,
  tracePath,
  undirectedSteps,
  STRUCTURAL_EDGE_TYPES,
  type GraphStatus,
} from "./neighborhood.js";

export const DEFAULT_IMPACT_DEPTH = 2;

/**
 * Same v1 extras as `V1_IGNORE_PATTERNS` in
 * `workflow/vendor/understand-anything/scripts/head-source.mjs`.
 * Applied only to the worktree form, after Git's own exclude rules.
 */
export const WORKTREE_IGNORE_PATTERNS: readonly string[] = Object.freeze([
  ".workflow/",
  ".ua/",
  ".understand-anything/",
  ".env",
  ".env.*",
  "!.env.example",
  "*credentials*",
  "*secret*",
]);

export const EVIDENCE = {
  directlyChanged: "directly changed",
  structurallyImpacted: "likely structurally impacted",
  semanticImpact: "potential semantic impact",
  unmapped: "unmapped",
} as const;

export type EvidenceClass = (typeof EVIDENCE)[keyof typeof EVIDENCE];

/** Inference edges v1 does not create. Honored only when one is already stored. */
const INFERENCE_EDGE_TYPES: ReadonlySet<string> = new Set([
  "related",
  "similar_to",
  "reads_from",
  "writes_to",
  "configures",
  "triggers",
]);

export type ImpactSource =
  | { form: "worktree"; projectRoot: string }
  | { form: "staged"; projectRoot: string }
  | { form: "range"; projectRoot: string; range: string }
  | { form: "paths"; paths: readonly string[] };

export interface ImpactHit {
  evidence: EvidenceClass;
  path?: string;
  nodeId?: string;
  name?: string;
  type?: NodeType;
  filePath?: string;
  /** Node ids from a directly changed node to this hit, inclusive. */
  via?: string[];
}

export interface ImpactReport {
  status: GraphStatus;
  form: ImpactSource["form"];
  changedPaths: string[];
  /** Untracked paths kept on the worktree form. Empty for every other form. */
  untrackedPaths: string[];
  unmappedPaths: string[];
  hits: ImpactHit[];
  depth: number;
  depthCapped: boolean;
  /** Set when the structural walk stopped with neighbors still outside the cap. */
  depthNote?: string;
  scope?: string;
}

interface CollectedPaths {
  form: ImpactSource["form"];
  changedPaths: string[];
  untrackedPaths: string[];
}

export async function impact_of_diff(
  graph: KnowledgeGraph,
  source: ImpactSource,
  scope?: string,
  depth?: number,
): Promise<ImpactReport> {
  const maxDepth = depth == null ? DEFAULT_IMPACT_DEPTH : requireDepth(depth, "impact");
  const prefix = normalizeScope(scope);
  const collected = await collectPaths(source, prefix);
  const byId = indexNodes(graph.nodes);

  const unmappedPaths: string[] = [];
  const changed = new Set<string>();
  for (const file of collected.changedPaths) {
    let mapped = false;
    for (const node of graph.nodes) {
      if (node.filePath !== file) continue;
      changed.add(node.id);
      mapped = true;
    }
    if (!mapped) unmappedPaths.push(file);
  }

  const seeded = new Set(changed);
  for (const edge of graph.edges) {
    if (edge.type === "contains" && seeded.has(edge.source)) changed.add(edge.target);
  }

  const origins = [...changed].sort(compareId);
  const adjacent = undirectedSteps(graph.edges, (edge) => STRUCTURAL_EDGE_TYPES.has(edge.type));
  const walk = bfs(origins, adjacent, maxDepth);

  const structuralIds = walk.visited
    .filter((id) => (walk.depthOf.get(id) ?? 0) > 0)
    .sort((left, right) => {
      const delta = (walk.depthOf.get(left) ?? 0) - (walk.depthOf.get(right) ?? 0);
      return delta !== 0 ? delta : compareId(left, right);
    });

  const semantic = semanticHits(graph, walk.depthOf, walk.parent);

  const hits: ImpactHit[] = [];
  for (const file of unmappedPaths) {
    hits.push({ evidence: EVIDENCE.unmapped, path: file });
  }
  for (const id of origins) {
    const hit = nodeHit(byId.get(id), EVIDENCE.directlyChanged, [id]);
    if (hit && hitInScope(hit, prefix)) hits.push(hit);
  }
  for (const id of structuralIds) {
    const via = tracePath(id, walk.parent)?.nodeIds ?? [id];
    const hit = nodeHit(byId.get(id), EVIDENCE.structurallyImpacted, via);
    if (hit && hitInScope(hit, prefix)) hits.push(hit);
  }
  for (const item of semantic) {
    const viaFrom = tracePath(item.from, walk.parent)?.nodeIds ?? [item.from];
    const hit = nodeHit(byId.get(item.to), EVIDENCE.semanticImpact, [...viaFrom, item.to]);
    if (hit && hitInScope(hit, prefix)) hits.push(hit);
  }

  const depthCapped = walk.depthCapped;
  return {
    status: unmappedPaths.length > 0 ? "PARTIAL" : "AVAILABLE",
    form: collected.form,
    changedPaths: collected.changedPaths,
    untrackedPaths: collected.untrackedPaths,
    unmappedPaths,
    hits,
    depth: maxDepth,
    depthCapped,
    ...(depthCapped ? { depthNote: `${depthCapNote(maxDepth)}; nodes beyond the cap were omitted` } : {}),
    ...(prefix ? { scope: prefix } : {}),
  };
}

function nodeHit(node: GraphNode | undefined, evidence: EvidenceClass, via: string[]): ImpactHit | null {
  if (!node) return null;
  const hit: ImpactHit = {
    evidence,
    nodeId: node.id,
    name: node.name,
    type: node.type,
    via,
  };
  if (node.filePath !== undefined) hit.filePath = node.filePath;
  return hit;
}

function hitInScope(hit: ImpactHit, scope: string | undefined): boolean {
  if (scope == null) return true;
  if (hit.path !== undefined) return pathInScope(hit.path, scope);
  if (hit.filePath === undefined) return false;
  return pathInScope(hit.filePath, scope);
}

interface SemanticLink {
  from: string;
  to: string;
}

function semanticHits(
  graph: KnowledgeGraph,
  depthOf: ReadonlyMap<string, number>,
  parent: ReadonlyMap<string, { id: string } | null>,
): SemanticLink[] {
  const found: SemanticLink[] = [];
  const seen = new Set<string>();
  for (const edge of graph.edges) {
    if (!INFERENCE_EDGE_TYPES.has(edge.type) || edge.source === edge.target) continue;
    const sourceReached = depthOf.has(edge.source);
    const targetReached = depthOf.has(edge.target);
    if (sourceReached === targetReached) continue;
    const from = sourceReached ? edge.source : edge.target;
    const to = sourceReached ? edge.target : edge.source;
    if (seen.has(to) || !parent.has(from)) continue;
    seen.add(to);
    found.push({ from, to });
  }
  found.sort((left, right) => compareId(left.to, right.to));
  return found;
}

async function collectPaths(source: ImpactSource, scope: string | undefined): Promise<CollectedPaths> {
  if (source.form === "paths") {
    return {
      form: "paths",
      changedPaths: applyScope(normalizeExplicit(source.paths), scope),
      untrackedPaths: [],
    };
  }
  if (source.form === "staged") {
    const names = await diffNames(assertRoot(source.projectRoot), ["--cached"]);
    return { form: "staged", changedPaths: applyScope(names, scope), untrackedPaths: [] };
  }
  if (source.form === "range") {
    const names = await diffNames(assertRoot(source.projectRoot), [source.range]);
    return { form: "range", changedPaths: applyScope(names, scope), untrackedPaths: [] };
  }
  if (source.form === "worktree") {
    const root = assertRoot(source.projectRoot);
    const filter = createIgnoreFilter(root, [...WORKTREE_IGNORE_PATTERNS]);
    const dirty = (await diffNames(root)).filter((file) => !filter.isIgnored(file));
    const untracked = (await untrackedNames(root)).filter((file) => !filter.isIgnored(file));
    const dirtySet = new Set(dirty);
    const untrackedPaths = untracked.filter((file) => !dirtySet.has(file));
    return {
      form: "worktree",
      changedPaths: applyScope([...dirty, ...untrackedPaths], scope),
      untrackedPaths: applyScope(untrackedPaths, scope),
    };
  }
  const unknown: never = source;
  throw new Error(`unknown impact form: ${String(unknown)}`);
}

function applyScope(paths: readonly string[], scope: string | undefined): string[] {
  if (scope == null) return [...paths];
  return paths.filter((file) => pathInScope(file, scope));
}

function assertRoot(projectRoot: string): string {
  if (typeof projectRoot !== "string" || projectRoot.length === 0) {
    throw new Error("projectRoot is required");
  }
  return projectRoot;
}

function normalizeExplicit(paths: readonly string[]): string[] {
  if (!Array.isArray(paths)) throw new Error("paths must be an array");
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of paths) {
    const normalized = normalizeRepoPath(raw);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function normalizeRepoPath(filePath: string): string {
  if (typeof filePath !== "string" || filePath.length === 0 || filePath.includes("\0")) {
    throw new Error("refusing path");
  }
  const posix = filePath.split("\\").join("/");
  if (posix.startsWith("/") || /^[A-Za-z]:\//.test(posix)) {
    throw new Error(`refusing absolute path: ${filePath}`);
  }
  if (posix.split("/").includes("..")) {
    throw new Error(`refusing path that contains '..': ${filePath}`);
  }
  const cleaned = posix
    .split("/")
    .filter((part) => part.length > 0 && part !== ".")
    .join("/");
  if (cleaned.length === 0) throw new Error("refusing path");
  return cleaned;
}
