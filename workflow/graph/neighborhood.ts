/**
 * ADAPT of Understand Anything 6df3065f1d8ddc2ce3615314d1d493f36d6b1c80
 * `src/explain-builder.ts` (`buildExplainContext`).
 * Frozen reason: the neighborhood walks structural edges to `depth`
 * (default 1). Direct `contains` children stay in the start set, which is
 * the upstream 1-hop seed, and the walk goes outward from there.
 * The prompt formatter is not copied. Layers come from `detectLayers` only.
 */

import { detectLayers } from "../vendor/understand-anything/dist/analyzer/layer-detector.js";
import type {
  EdgeType,
  GraphEdge,
  GraphNode,
  KnowledgeGraph,
  Layer,
} from "../vendor/understand-anything/dist/types.js";

export const DEFAULT_RELATED_DEPTH = 1;

/** Structural edges the persistent graph is allowed to walk. */
export const STRUCTURAL_EDGE_TYPES: ReadonlySet<EdgeType> = new Set([
  "contains",
  "imports",
  "calls",
  "exports",
  "inherits",
  "implements",
]);

export type GraphStatus = "AVAILABLE" | "PARTIAL" | "STALE_RECOVERABLE" | "UNAVAILABLE";

export interface CoverageOptions {
  /** The fresh graph is partial: a parser was missing, or a call was dropped. */
  partial?: boolean;
}

export interface Neighborhood {
  status: GraphStatus;
  projectName: string;
  target: GraphNode | null;
  depth: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
  visited: string[];
  depthCapped: boolean;
  /** Set when the walk stopped because the depth cap still had neighbors. */
  note?: string;
  layer: Layer | null;
  reason?: "target-not-found" | "ambiguous-target";
}

export interface Step {
  to: string;
  edge: GraphEdge;
}

export interface ParentLink {
  id: string;
  edge: GraphEdge;
}

export interface BfsWalk {
  depthOf: Map<string, number>;
  parent: Map<string, ParentLink | null>;
  visited: string[];
  depthCapped: boolean;
}

export type TargetResolution =
  | { kind: "unique"; node: GraphNode }
  | { kind: "ambiguous" }
  | { kind: "missing" };

export function requireDepth(depth: number, label: string): number {
  if (!Number.isInteger(depth) || depth < 0) {
    throw new Error(`${label} depth must be a non-negative integer`);
  }
  return depth;
}

export function coverageStatus(status: GraphStatus, partial?: boolean): GraphStatus {
  if (partial === true && status === "AVAILABLE") return "PARTIAL";
  return status;
}

export function depthCapNote(depth: number): string {
  return `depth cap ${depth} reached; traversal stopped`;
}

export function compareId(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function indexNodes(nodes: readonly GraphNode[]): Map<string, GraphNode> {
  return new Map(nodes.map((node) => [node.id, node]));
}

export function containsParents(edges: readonly GraphEdge[]): Map<string, string[]> {
  const parents = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.type !== "contains") continue;
    const list = parents.get(edge.target);
    if (list) list.push(edge.source);
    else parents.set(edge.target, [edge.source]);
  }
  for (const list of parents.values()) list.sort(compareId);
  return parents;
}

/** Walk `contains` upward until a file node. The hop is not a traversal depth. */
export function rollupToFile(
  start: string,
  byId: ReadonlyMap<string, GraphNode>,
  parents: ReadonlyMap<string, readonly string[]>,
): string {
  let current = start;
  const seen = new Set<string>();
  while (!seen.has(current)) {
    seen.add(current);
    if (byId.get(current)?.type === "file") return current;
    const ups = parents.get(current) ?? [];
    const fileParent = ups.find((id) => byId.get(id)?.type === "file");
    const next = fileParent ?? ups[0];
    if (!next) return current;
    current = next;
  }
  return start;
}

export function normalizeScope(scope: string | undefined): string | undefined {
  if (scope == null) return undefined;
  const trimmed = scope.trim();
  if (trimmed.length === 0) return undefined;
  const posix = trimmed.split("\\").join("/").replace(/^\.\//, "");
  if (posix.startsWith("/") || /^[A-Za-z]:\//.test(posix)) {
    throw new Error(`refusing absolute scope: ${scope}`);
  }
  if (posix.split("/").includes("..")) {
    throw new Error(`refusing scope that contains '..': ${scope}`);
  }
  const cleaned = posix
    .split("/")
    .filter((part) => part.length > 0 && part !== ".")
    .join("/");
  return cleaned.length > 0 ? cleaned : undefined;
}

export function pathInScope(filePath: string, scope: string): boolean {
  const prefix = scope.endsWith("/") ? scope : `${scope}/`;
  return filePath === scope || filePath.startsWith(prefix);
}

function pushStep(map: Map<string, Step[]>, from: string, step: Step): void {
  const list = map.get(from);
  if (list) list.push(step);
  else map.set(from, [step]);
}

function sortSteps(map: Map<string, Step[]>): Map<string, Step[]> {
  for (const list of map.values()) {
    list.sort((left, right) => compareId(left.to, right.to) || compareId(left.edge.type, right.edge.type));
  }
  return map;
}

export function undirectedSteps(
  edges: readonly GraphEdge[],
  accept: (edge: GraphEdge) => boolean,
): Map<string, Step[]> {
  const map = new Map<string, Step[]>();
  for (const edge of edges) {
    if (!accept(edge) || edge.source === edge.target) continue;
    pushStep(map, edge.source, { to: edge.target, edge });
    pushStep(map, edge.target, { to: edge.source, edge });
  }
  return sortSteps(map);
}

export function directedSteps(
  edges: readonly GraphEdge[],
  accept: (edge: GraphEdge) => boolean,
  way: "forward" | "reverse",
): Map<string, Step[]> {
  const map = new Map<string, Step[]>();
  for (const edge of edges) {
    if (!accept(edge) || edge.source === edge.target) continue;
    if (way === "forward") pushStep(map, edge.source, { to: edge.target, edge });
    else pushStep(map, edge.target, { to: edge.source, edge });
  }
  return sortSteps(map);
}

/**
 * Multi-source BFS. A node is enqueued once. Neighbors still waiting past
 * `maxDepth` set `depthCapped` and are left out of `visited`.
 */
export function bfs(origins: readonly string[], adjacent: ReadonlyMap<string, readonly Step[]>, maxDepth: number): BfsWalk {
  const depthOf = new Map<string, number>();
  const parent = new Map<string, ParentLink | null>();
  const visited: string[] = [];
  const queue: string[] = [];
  for (const id of origins) {
    if (depthOf.has(id)) continue;
    depthOf.set(id, 0);
    parent.set(id, null);
    visited.push(id);
    queue.push(id);
  }

  let depthCapped = false;
  let index = 0;
  while (index < queue.length) {
    const id = queue[index]!;
    index += 1;
    const depth = depthOf.get(id)!;
    const nexts = adjacent.get(id) ?? [];
    if (depth >= maxDepth) {
      if (nexts.some((step) => !depthOf.has(step.to))) depthCapped = true;
      continue;
    }
    for (const step of nexts) {
      if (depthOf.has(step.to)) continue;
      depthOf.set(step.to, depth + 1);
      parent.set(step.to, { id, edge: step.edge });
      visited.push(step.to);
      queue.push(step.to);
    }
  }

  return { depthOf, parent, visited, depthCapped };
}

export function tracePath(id: string, parent: ReadonlyMap<string, ParentLink | null>): { nodeIds: string[]; edges: GraphEdge[] } | null {
  if (!parent.has(id)) return null;
  const nodeIds: string[] = [];
  const edges: GraphEdge[] = [];
  let current: string | null = id;
  const guard = new Set<string>();
  while (current != null && !guard.has(current)) {
    guard.add(current);
    nodeIds.push(current);
    const link = parent.get(current);
    if (link == null) current = null;
    else {
      edges.push(link.edge);
      current = link.id;
    }
  }
  nodeIds.reverse();
  edges.reverse();
  return { nodeIds, edges };
}

/**
 * Exact id, then `path:name`, then a file path (the file node when several
 * nodes share it), then a unique name. Names that hit more than one node
 * stay ambiguous. Summaries and tags are not consulted.
 */
export function resolveTarget(graph: KnowledgeGraph, target: string): TargetResolution {
  const byId = indexNodes(graph.nodes);
  const direct = byId.get(target);
  if (direct) return { kind: "unique", node: direct };

  const colon = target.lastIndexOf(":");
  if (colon > 0 && !target.includes("://")) {
    const filePath = target.slice(0, colon);
    const name = target.slice(colon + 1);
    const named = graph.nodes.filter((node) => node.filePath === filePath && node.name === name);
    if (named.length === 1) return { kind: "unique", node: named[0]! };
    if (named.length > 1) return { kind: "ambiguous" };
  }

  const byPath = graph.nodes.filter((node) => node.filePath === target);
  if (byPath.length === 1) return { kind: "unique", node: byPath[0]! };
  if (byPath.length > 1) {
    const files = byPath.filter((node) => node.type === "file");
    if (files.length === 1) return { kind: "unique", node: files[0]! };
    return { kind: "ambiguous" };
  }

  const byName = graph.nodes.filter((node) => node.name === target);
  if (byName.length === 1) return { kind: "unique", node: byName[0]! };
  if (byName.length > 1) return { kind: "ambiguous" };
  return { kind: "missing" };
}

function layerFor(graph: KnowledgeGraph, node: GraphNode, byId: ReadonlyMap<string, GraphNode>): Layer | null {
  const parents = containsParents(graph.edges);
  const fileId = rollupToFile(node.id, byId, parents);
  const file = byId.get(fileId);
  if (file?.type !== "file") return null;
  return detectLayers(graph).find((layer) => layer.nodeIds.includes(file.id)) ?? null;
}

function directContainsChildren(edges: readonly GraphEdge[], nodeId: string, byId: ReadonlyMap<string, GraphNode>): string[] {
  const children: string[] = [];
  for (const edge of edges) {
    if (edge.type !== "contains" || edge.source !== nodeId || edge.target === nodeId) continue;
    if (!byId.has(edge.target) || children.includes(edge.target)) continue;
    children.push(edge.target);
  }
  children.sort(compareId);
  return children;
}

/**
 * Structural neighborhood. Default depth is 1.
 * `contains` children of the target are inside the start set, then the walk
 * follows structural edges for `depth` hops and stops when an id repeats.
 */
export function related(
  graph: KnowledgeGraph,
  target: string,
  depth: number = DEFAULT_RELATED_DEPTH,
  options?: CoverageOptions,
): Neighborhood {
  const maxDepth = depth == null ? DEFAULT_RELATED_DEPTH : requireDepth(depth, "related");
  const resolved = resolveTarget(graph, target);
  if (resolved.kind !== "unique") {
    return {
      status: coverageStatus(resolved.kind === "ambiguous" ? "PARTIAL" : "AVAILABLE", options?.partial),
      projectName: graph.project.name,
      target: null,
      depth: maxDepth,
      nodes: [],
      edges: [],
      visited: [],
      depthCapped: false,
      layer: null,
      reason: resolved.kind === "ambiguous" ? "ambiguous-target" : "target-not-found",
    };
  }

  const byId = indexNodes(graph.nodes);
  const children = directContainsChildren(graph.edges, resolved.node.id, byId);
  const seeds = [resolved.node.id, ...children];
  const adjacent = undirectedSteps(graph.edges, (edge) => STRUCTURAL_EDGE_TYPES.has(edge.type));
  const walk = bfs(seeds, adjacent, maxDepth);

  const nodeIds = walk.visited.filter((id) => id !== resolved.node.id);
  nodeIds.sort((left, right) => {
    const delta = (walk.depthOf.get(left) ?? 0) - (walk.depthOf.get(right) ?? 0);
    return delta !== 0 ? delta : compareId(left, right);
  });

  const edges: GraphEdge[] = [];
  const seenEdges = new Set<string>();
  const remember = (edge: GraphEdge) => {
    const key = `${edge.type}\0${edge.source}\0${edge.target}`;
    if (seenEdges.has(key)) return;
    seenEdges.add(key);
    edges.push(edge);
  };
  for (const edge of graph.edges) {
    if (edge.type === "contains" && edge.source === resolved.node.id && children.includes(edge.target)) {
      remember(edge);
    }
  }
  for (const id of nodeIds) {
    const link = walk.parent.get(id);
    if (link && (walk.depthOf.get(id) ?? 0) > 0) remember(link.edge);
  }

  const note = walk.depthCapped ? depthCapNote(maxDepth) : undefined;
  return {
    status: coverageStatus("AVAILABLE", options?.partial),
    projectName: graph.project.name,
    target: resolved.node,
    depth: maxDepth,
    nodes: nodeIds.flatMap((id) => {
      const node = byId.get(id);
      return node ? [node] : [];
    }),
    edges,
    visited: walk.visited,
    depthCapped: walk.depthCapped,
    ...(note ? { note } : {}),
    layer: layerFor(graph, resolved.node, byId),
  };
}
