/**
 * REWRITE. Depth-N callers, callees, dependencies, dependents, and paths
 * have no upstream function. The reference gap is Understand Anything
 * 6df3065f1d8ddc2ce3615314d1d493f36d6b1c80 `src/diff-analyzer.ts`, which
 * stops at one hop.
 * `find_symbol` is an exact id, filePath, and name index. No Fuse, no
 * summary search, no tag search.
 */

import { detectLayers } from "../vendor/understand-anything/dist/analyzer/layer-detector.js";
import { FrameworkRegistry } from "../vendor/understand-anything/dist/languages/framework-registry.js";
import type { GraphEdge, GraphNode, KnowledgeGraph, Layer, NodeType } from "../vendor/understand-anything/dist/types.js";
import {
  bfs,
  compareId,
  containsParents,
  coverageStatus,
  depthCapNote,
  directedSteps,
  indexNodes,
  normalizeScope,
  pathInScope,
  requireDepth,
  resolveTarget,
  rollupToFile,
  STRUCTURAL_EDGE_TYPES,
  tracePath,
  undirectedSteps,
  type CoverageOptions,
  type GraphStatus,
} from "./neighborhood.js";

export {
  DEFAULT_RELATED_DEPTH,
  related,
  STRUCTURAL_EDGE_TYPES,
  type CoverageOptions,
  type GraphStatus,
  type Neighborhood,
} from "./neighborhood.js";

export const DEFAULT_CALLERS_DEPTH = 2;
export const DEFAULT_CALLEES_DEPTH = 2;
export const DEFAULT_DEPENDENCIES_DEPTH = 2;
export const DEFAULT_DEPENDENTS_DEPTH = 2;
export const DEFAULT_PATH_DEPTH = 6;

const TOP_IMPORTS = 10;

export interface SymbolHit {
  id: string;
  name: string;
  type: NodeType;
  filePath?: string;
  matchedBy: Array<"id" | "filePath" | "name">;
}

export interface Traversal {
  status: GraphStatus;
  originId: string | null;
  depth: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
  visited: string[];
  depthCapped: boolean;
  note?: string;
  reason?: "target-not-found" | "ambiguous-target";
}

export interface GraphPath {
  nodeIds: string[];
  edges: GraphEdge[];
  /** Edge count. */
  depth: number;
}

export interface PathQuery {
  status: GraphStatus;
  from: string | null;
  to: string | null;
  maxDepth: number;
  paths: GraphPath[];
  visited: string[];
  depthCapped: boolean;
  /**
   * When the cap stops the search, this says so. An empty `paths` list
   * together with that note is not a claim that no path exists.
   */
  note?: string;
  reason?: "target-not-found" | "ambiguous-target";
}

export interface ComponentSlice {
  status: GraphStatus;
  file: GraphNode | null;
  children: GraphNode[];
  layer: Layer | null;
  reason?: "target-not-found" | "ambiguous-target";
}

export interface ImportDegree {
  id: string;
  name: string;
  filePath?: string;
  inDegree: number;
}

export interface ArchitectureSummary {
  status: GraphStatus;
  layers: Layer[];
  topImports: ImportDegree[];
  languages: string[];
  frameworks: string[];
  services: GraphNode[];
  endpoints: GraphNode[];
  tables: GraphNode[];
  pipelines: GraphNode[];
  schemas: GraphNode[];
  resources: GraphNode[];
  fileCount: number;
  /** File nodes placed in the Core fallback because no directory keyword matched. */
  unlayeredFiles: number;
  reason?: "most-files-unlayered";
}

export function find_symbol(graph: KnowledgeGraph, query: string): SymbolHit[] {
  if (query.length === 0) return [];
  const hits: SymbolHit[] = [];
  for (const node of graph.nodes) {
    const matchedBy: SymbolHit["matchedBy"] = [];
    if (node.id === query) matchedBy.push("id");
    if (node.filePath === query) matchedBy.push("filePath");
    if (node.name === query) matchedBy.push("name");
    if (matchedBy.length === 0) continue;
    const hit: SymbolHit = {
      id: node.id,
      name: node.name,
      type: node.type,
      matchedBy,
    };
    if (node.filePath !== undefined) hit.filePath = node.filePath;
    hits.push(hit);
  }
  return hits;
}

export function callers(
  graph: KnowledgeGraph,
  target: string,
  depth: number = DEFAULT_CALLERS_DEPTH,
  options?: CoverageOptions,
): Traversal {
  return walkCalls(graph, target, depth ?? DEFAULT_CALLERS_DEPTH, "reverse", options);
}

export function callees(
  graph: KnowledgeGraph,
  target: string,
  depth: number = DEFAULT_CALLEES_DEPTH,
  options?: CoverageOptions,
): Traversal {
  return walkCalls(graph, target, depth ?? DEFAULT_CALLEES_DEPTH, "forward", options);
}

export function dependencies(
  graph: KnowledgeGraph,
  target: string,
  depth: number = DEFAULT_DEPENDENCIES_DEPTH,
  options?: CoverageOptions,
): Traversal {
  return walkDependencies(graph, target, depth ?? DEFAULT_DEPENDENCIES_DEPTH, "forward", options);
}

export function dependents(
  graph: KnowledgeGraph,
  target: string,
  depth: number = DEFAULT_DEPENDENTS_DEPTH,
  options?: CoverageOptions,
): Traversal {
  return walkDependencies(graph, target, depth ?? DEFAULT_DEPENDENTS_DEPTH, "reverse", options);
}

export function paths(
  graph: KnowledgeGraph,
  from: string,
  to: string,
  maxDepth: number = DEFAULT_PATH_DEPTH,
  options?: CoverageOptions,
): PathQuery {
  const cap = maxDepth == null ? DEFAULT_PATH_DEPTH : requireDepth(maxDepth, "paths");
  const start = resolveTarget(graph, from);
  const end = resolveTarget(graph, to);
  if (start.kind !== "unique" || end.kind !== "unique") {
    const ambiguous = start.kind === "ambiguous" || end.kind === "ambiguous";
    return {
      status: coverageStatus(ambiguous ? "PARTIAL" : "AVAILABLE", options?.partial),
      from: start.kind === "unique" ? start.node.id : null,
      to: end.kind === "unique" ? end.node.id : null,
      maxDepth: cap,
      paths: [],
      visited: [],
      depthCapped: false,
      reason: ambiguous ? "ambiguous-target" : "target-not-found",
    };
  }

  if (start.node.id === end.node.id) {
    return {
      status: coverageStatus("AVAILABLE", options?.partial),
      from: start.node.id,
      to: end.node.id,
      maxDepth: cap,
      paths: [{ nodeIds: [start.node.id], edges: [], depth: 0 }],
      visited: [start.node.id],
      depthCapped: false,
    };
  }

  const adjacent = undirectedSteps(graph.edges, (edge) => STRUCTURAL_EDGE_TYPES.has(edge.type));
  const walk = bfs([start.node.id], adjacent, cap);
  const traced = tracePath(end.node.id, walk.parent);
  if (traced) {
    return {
      status: coverageStatus("AVAILABLE", options?.partial),
      from: start.node.id,
      to: end.node.id,
      maxDepth: cap,
      paths: [{ nodeIds: traced.nodeIds, edges: traced.edges, depth: traced.edges.length }],
      visited: walk.visited,
      depthCapped: false,
    };
  }

  const depthCapped = walk.depthCapped;
  const note = depthCapped
    ? `${depthCapNote(cap)}; search stopped and this is not proof there is no path`
    : "no structural path";
  return {
    status: coverageStatus(depthCapped ? "PARTIAL" : "AVAILABLE", options?.partial),
    from: start.node.id,
    to: end.node.id,
    maxDepth: cap,
    paths: [],
    visited: walk.visited,
    depthCapped,
    note,
  };
}

export function component(graph: KnowledgeGraph, target: string, options?: CoverageOptions): ComponentSlice {
  const resolved = resolveTarget(graph, target);
  if (resolved.kind !== "unique") {
    return {
      status: coverageStatus(resolved.kind === "ambiguous" ? "PARTIAL" : "AVAILABLE", options?.partial),
      file: null,
      children: [],
      layer: null,
      reason: resolved.kind === "ambiguous" ? "ambiguous-target" : "target-not-found",
    };
  }

  const byId = indexNodes(graph.nodes);
  const fileId = rollupToFile(resolved.node.id, byId, containsParents(graph.edges));
  const file = byId.get(fileId);
  if (file?.type !== "file") {
    return {
      status: coverageStatus("AVAILABLE", options?.partial),
      file: null,
      children: [],
      layer: null,
      reason: "target-not-found",
    };
  }

  const children = graph.edges
    .filter((edge) => edge.type === "contains" && edge.source === file.id)
    .flatMap((edge) => {
      const node = byId.get(edge.target);
      return node ? [node] : [];
    })
    .sort((left, right) => compareId(left.id, right.id));
  const layer = detectLayers(graph).find((item) => item.nodeIds.includes(file.id)) ?? null;
  return {
    status: coverageStatus("AVAILABLE", options?.partial),
    file,
    children,
    layer,
  };
}

/**
 * Heuristic layers, inbound import degree, project languages, and frameworks.
 * Manifest text is matched by keyword when `manifests` is passed. Otherwise
 * the frameworks already stored on the graph are returned. `PARTIAL` means
 * most file nodes fell through to the Core fallback.
 */
export function architecture_overview(
  graph: KnowledgeGraph,
  scope?: string,
  manifests?: Record<string, string>,
): ArchitectureSummary {
  const prefix = normalizeScope(scope);
  const nodes = graph.nodes.filter((node) => nodeInScope(node, prefix));
  const nodeIds = new Set(nodes.map((node) => node.id));
  const scoped: KnowledgeGraph = {
    ...graph,
    nodes,
    edges: graph.edges.filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)),
  };
  const layers = detectLayers(scoped);
  const files = nodes.filter((node) => node.type === "file");
  const unlayeredFiles = layers.find((layer) => layer.name === "Core")?.nodeIds.length ?? 0;
  const unlayered = files.length > 0 && unlayeredFiles * 2 > files.length;

  const inbound = new Map<string, number>();
  for (const edge of graph.edges) {
    if (edge.type !== "imports" || !nodeIds.has(edge.target)) continue;
    inbound.set(edge.target, (inbound.get(edge.target) ?? 0) + 1);
  }
  const topImports = files
    .map((node) => {
      const row: ImportDegree = {
        id: node.id,
        name: node.name,
        inDegree: inbound.get(node.id) ?? 0,
      };
      if (node.filePath !== undefined) row.filePath = node.filePath;
      return row;
    })
    .filter((row) => row.inDegree > 0)
    .sort((left, right) => right.inDegree - left.inDegree || compareId(left.id, right.id))
    .slice(0, TOP_IMPORTS);

  const byType = (type: NodeType) =>
    nodes.filter((node) => node.type === type).sort((left, right) => compareId(left.id, right.id));

  return {
    status: unlayered ? "PARTIAL" : "AVAILABLE",
    layers,
    topImports,
    languages: [...graph.project.languages],
    frameworks: frameworksOf(graph, manifests),
    services: byType("service"),
    endpoints: byType("endpoint"),
    tables: byType("table"),
    pipelines: byType("pipeline"),
    schemas: byType("schema"),
    resources: byType("resource"),
    fileCount: files.length,
    unlayeredFiles,
    ...(unlayered ? { reason: "most-files-unlayered" as const } : {}),
  };
}

function nodeInScope(node: GraphNode, scope: string | undefined): boolean {
  if (scope == null) return true;
  if (!node.filePath) return false;
  return pathInScope(node.filePath, scope);
}

function frameworksOf(graph: KnowledgeGraph, manifests: Record<string, string> | undefined): string[] {
  if (manifests == null) return [...graph.project.frameworks];
  return FrameworkRegistry.createDefault()
    .detectFrameworks(manifests)
    .map((framework) => framework.id)
    .sort(compareId);
}

function walkCalls(
  graph: KnowledgeGraph,
  target: string,
  depth: number,
  way: "forward" | "reverse",
  options: CoverageOptions | undefined,
): Traversal {
  const maxDepth = requireDepth(depth, way === "reverse" ? "callers" : "callees");
  const resolved = resolveTarget(graph, target);
  if (resolved.kind !== "unique") return emptyTraversal(maxDepth, resolved.kind, options);
  const adjacent = directedSteps(graph.edges, (edge) => edge.type === "calls", way);
  return finishWalk(graph, resolved.node.id, resolved.node.id, adjacent, maxDepth, options);
}

function walkDependencies(
  graph: KnowledgeGraph,
  target: string,
  depth: number,
  way: "forward" | "reverse",
  options: CoverageOptions | undefined,
): Traversal {
  const maxDepth = requireDepth(depth, way === "forward" ? "dependencies" : "dependents");
  const resolved = resolveTarget(graph, target);
  if (resolved.kind !== "unique") return emptyTraversal(maxDepth, resolved.kind, options);

  const byId = indexNodes(graph.nodes);
  const anchor = rollupToFile(resolved.node.id, byId, containsParents(graph.edges));
  const dependsOn = graph.edges.some((edge) => edge.type === "depends_on");
  const adjacent = directedSteps(
    graph.edges,
    (edge) => edge.type === "imports" || (dependsOn && edge.type === "depends_on"),
    way,
  );
  return finishWalk(graph, resolved.node.id, anchor, adjacent, maxDepth, options);
}

function finishWalk(
  graph: KnowledgeGraph,
  originId: string,
  anchorId: string,
  adjacent: Map<string, { to: string; edge: GraphEdge }[]>,
  maxDepth: number,
  options: CoverageOptions | undefined,
): Traversal {
  const walk = bfs([anchorId], adjacent, maxDepth);
  const hidden = new Set([originId, anchorId]);
  const nodeIds = walk.visited.filter((id) => !hidden.has(id));
  nodeIds.sort((left, right) => {
    const delta = (walk.depthOf.get(left) ?? 0) - (walk.depthOf.get(right) ?? 0);
    return delta !== 0 ? delta : compareId(left, right);
  });
  const byId = indexNodes(graph.nodes);
  const note = walk.depthCapped ? depthCapNote(maxDepth) : undefined;
  const visited = walk.visited[0] === originId ? walk.visited : [originId, ...walk.visited.filter((id) => id !== originId)];
  return {
    status: coverageStatus("AVAILABLE", options?.partial),
    originId,
    depth: maxDepth,
    nodes: nodeIds.flatMap((id) => {
      const node = byId.get(id);
      return node ? [node] : [];
    }),
    edges: nodeIds.flatMap((id) => {
      const link = walk.parent.get(id);
      return link ? [link.edge] : [];
    }),
    visited,
    depthCapped: walk.depthCapped,
    ...(note ? { note } : {}),
  };
}

function emptyTraversal(depth: number, kind: "ambiguous" | "missing", options: CoverageOptions | undefined): Traversal {
  return {
    status: coverageStatus(kind === "ambiguous" ? "PARTIAL" : "AVAILABLE", options?.partial),
    originId: null,
    depth,
    nodes: [],
    edges: [],
    visited: [],
    depthCapped: false,
    reason: kind === "ambiguous" ? "ambiguous-target" : "target-not-found",
  };
}
