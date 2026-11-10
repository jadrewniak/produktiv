/**
 * Workflow graph adapter.
 *
 * Skills are the only allowed importers of this module. They follow
 * workflow/references/capabilities.md and call these primitives only when
 * the host reports the graph capability. They do not import vendor paths.
 * This module does not install Node or Git. `domain_slice` and `hotspots`
 * are not exported, not even as stubs.
 *
 * Each query calls `ensure_fresh` before it reads the graph. Impact of an
 * uncommitted diff is the exception, and only when the persistent graph
 * already matches HEAD. A query does not run when `analyzed_sha` is not HEAD.
 * `UNAVAILABLE` and a failed `STALE_RECOVERABLE` return that status and no facts.
 * `PARTIAL` is kept when a language has no parser or call resolution dropped edges.
 *
 * Initial build is `ensure_fresh` with caller `/setup` or `eval`. A query does
 * not grant that permission, so a missing graph stays `UNAVAILABLE`.
 */

import { realpathSync } from "node:fs";
import { head } from "../host/git.mjs";
import { ASSEMBLER_VERSION } from "../../graph/assemble.js";
import {
  impact_of_diff as impactQuery,
  DEFAULT_IMPACT_DEPTH,
  type ImpactReport,
  type ImpactSource,
} from "../../graph/impact.js";
import { coverageStatus, normalizeScope, pathInScope } from "../../graph/neighborhood.js";
import {
  architecture_overview as architectureQuery,
  callers as callersQuery,
  callees as calleesQuery,
  component as componentQuery,
  dependencies as dependenciesQuery,
  dependents as dependentsQuery,
  find_symbol as findSymbolQuery,
  paths as pathsQuery,
  related as relatedQuery,
  DEFAULT_CALLEES_DEPTH,
  DEFAULT_CALLERS_DEPTH,
  DEFAULT_DEPENDENCIES_DEPTH,
  DEFAULT_DEPENDENTS_DEPTH,
  DEFAULT_PATH_DEPTH,
  DEFAULT_RELATED_DEPTH,
  type ArchitectureSummary,
  type ComponentSlice,
  type Neighborhood,
  type PathQuery,
  type SymbolHit,
  type Traversal,
} from "../../graph/queries.js";
import {
  ensure_fresh as reconcileFresh,
  type FreshnessReport,
  type GraphStatus,
} from "../../graph/reconcile.js";
import { loadStore } from "../../graph/store.js";

export type {
  ArchitectureSummary,
  ComponentSlice,
  FreshnessReport,
  GraphStatus,
  ImpactReport,
  ImpactSource,
  Neighborhood,
  PathQuery,
  SymbolHit,
  Traversal,
};

export interface SymbolQuery {
  status: GraphStatus;
  hits: SymbolHit[];
  analyzed_sha?: string;
  reason?: string;
  scope?: string;
}

type Graph = Parameters<typeof findSymbolQuery>[0];

type QueryAnswer<T> = Omit<T, "reason" | "status"> & {
  status: GraphStatus;
  reason?: string;
  analyzed_sha?: string;
  scope?: string;
};

interface Opened {
  ok: true;
  graph: Graph;
  partial: boolean;
  analyzedSha: string;
  root: string;
}

type Ready = { ok: false; report: FreshnessReport } | Opened;

export async function ensure_fresh(
  projectRoot: string,
  scope?: string,
  caller?: string,
): Promise<FreshnessReport> {
  return reconcileFresh(projectRoot, scope, caller);
}

export async function find_symbol(
  projectRoot: string,
  query: string,
  scope?: string,
): Promise<SymbolQuery> {
  const opened = await ready(projectRoot, scope);
  if (!opened.ok) return emptySymbols(opened.report);
  const prefix = normalizeScope(scope);
  const hits = findSymbolQuery(opened.graph, query).filter((hit) => hitInScope(hit.filePath, prefix));
  return {
    status: coverageStatus("AVAILABLE", opened.partial),
    hits,
    analyzed_sha: opened.analyzedSha,
    ...(prefix ? { scope: prefix } : {}),
  };
}

export async function related(
  projectRoot: string,
  target: string,
  depth?: number,
  scope?: string,
): Promise<QueryAnswer<Neighborhood>> {
  const opened = await ready(projectRoot, scope);
  if (!opened.ok) return emptyNeighborhood(depth ?? DEFAULT_RELATED_DEPTH, opened.report);
  const result = relatedQuery(graphForScope(opened.graph, scope), target, depth, { partial: opened.partial });
  return stamp(result, opened, scope);
}

export async function callers(
  projectRoot: string,
  target: string,
  depth?: number,
  scope?: string,
): Promise<QueryAnswer<Traversal>> {
  return walk(projectRoot, scope, depth, DEFAULT_CALLERS_DEPTH, (graph, partial) =>
    callersQuery(graph, target, depth, { partial }),
  );
}

export async function callees(
  projectRoot: string,
  target: string,
  depth?: number,
  scope?: string,
): Promise<QueryAnswer<Traversal>> {
  return walk(projectRoot, scope, depth, DEFAULT_CALLEES_DEPTH, (graph, partial) =>
    calleesQuery(graph, target, depth, { partial }),
  );
}

export async function dependencies(
  projectRoot: string,
  target: string,
  depth?: number,
  scope?: string,
): Promise<QueryAnswer<Traversal>> {
  return walk(projectRoot, scope, depth, DEFAULT_DEPENDENCIES_DEPTH, (graph, partial) =>
    dependenciesQuery(graph, target, depth, { partial }),
  );
}

export async function dependents(
  projectRoot: string,
  target: string,
  depth?: number,
  scope?: string,
): Promise<QueryAnswer<Traversal>> {
  return walk(projectRoot, scope, depth, DEFAULT_DEPENDENTS_DEPTH, (graph, partial) =>
    dependentsQuery(graph, target, depth, { partial }),
  );
}

export async function paths(
  projectRoot: string,
  from: string,
  to: string,
  maxDepth?: number,
  scope?: string,
): Promise<QueryAnswer<PathQuery>> {
  const opened = await ready(projectRoot, scope);
  if (!opened.ok) return emptyPaths(maxDepth ?? DEFAULT_PATH_DEPTH, opened.report);
  const result = pathsQuery(graphForScope(opened.graph, scope), from, to, maxDepth, { partial: opened.partial });
  return stamp(result, opened, scope);
}

export async function component(
  projectRoot: string,
  target: string,
  scope?: string,
): Promise<QueryAnswer<ComponentSlice>> {
  const opened = await ready(projectRoot, scope);
  if (!opened.ok) return emptyComponent(opened.report);
  const result = componentQuery(graphForScope(opened.graph, scope), target, { partial: opened.partial });
  return stamp(result, opened, scope);
}

export async function architecture_overview(
  projectRoot: string,
  scope?: string,
): Promise<QueryAnswer<ArchitectureSummary>> {
  const opened = await ready(projectRoot, scope);
  if (!opened.ok) return emptyArchitecture(opened.report);
  return stamp(architectureQuery(opened.graph, scope), opened, scope);
}

export async function impact_of_diff(
  projectRoot: string,
  source: ImpactSource,
  scope?: string,
  depth?: number,
): Promise<QueryAnswer<ImpactReport>> {
  const uncommitted = source.form === "worktree" || source.form === "staged";
  if (uncommitted) {
    const cached = await readFreshGraph(projectRoot);
    if (cached) return runImpact(cached, source, scope, depth);
  }
  const opened = await ready(projectRoot, scope);
  if (!opened.ok) return emptyImpact(opened.report, source, depth);
  return runImpact(opened, source, scope, depth);
}

async function walk(
  projectRoot: string,
  scope: string | undefined,
  depth: number | undefined,
  fallback: number,
  query: (graph: Graph, partial: boolean) => Traversal,
): Promise<QueryAnswer<Traversal>> {
  const opened = await ready(projectRoot, scope);
  if (!opened.ok) return emptyTraversal(depth ?? fallback, opened.report);
  const result = query(graphForScope(opened.graph, scope), opened.partial);
  return stamp(result, opened, scope);
}

async function runImpact(
  opened: Opened,
  source: ImpactSource,
  scope: string | undefined,
  depth: number | undefined,
): Promise<QueryAnswer<ImpactReport>> {
  const bound = source.form === "paths" ? source : { ...source, projectRoot: opened.root };
  const result = await impactQuery(opened.graph, bound, scope, depth);
  return stamp(result, opened, scope);
}

async function ready(projectRoot: string, scope: string | undefined): Promise<Ready> {
  const report = await reconcileFresh(projectRoot, scope);
  const denial = blocked(report);
  if (denial) return { ok: false, report: denial };
  return openGraph(projectRoot, report);
}

function blocked(report: FreshnessReport): FreshnessReport | null {
  const matches = shaMatches(report);
  if ((report.status === "AVAILABLE" || report.status === "PARTIAL") && matches) return null;
  if (report.status === "STALE_RECOVERABLE" && report.rebuilt === true && matches) return null;
  if (report.status === "UNAVAILABLE" || report.status === "STALE_RECOVERABLE") return report;
  return { status: "STALE_RECOVERABLE", reason: "analyzed-sha-mismatch", scope: report.scope };
}

function shaMatches(report: FreshnessReport): boolean {
  return typeof report.analyzed_sha === "string"
    && report.analyzed_sha.length > 0
    && report.analyzed_sha === report.head;
}

async function openGraph(projectRoot: string, report: FreshnessReport): Promise<Ready> {
  const loaded = loadAt(projectRoot);
  if (!loaded || loaded.problem === "missing") {
    return { ok: false, report: { status: "UNAVAILABLE", reason: "missing-graph", scope: report.scope } };
  }
  if (loaded.problem || !loaded.store.graph || !loaded.store.meta) {
    return {
      ok: false,
      report: {
        status: "STALE_RECOVERABLE",
        reason: loaded.problem ?? "missing-graph",
        scope: report.scope,
      },
    };
  }
  const analyzedSha = loaded.store.meta.analyzed_sha;
  if (analyzedSha !== report.analyzed_sha || loaded.store.graph.project.gitCommitHash !== analyzedSha) {
    return {
      ok: false,
      report: { status: "STALE_RECOVERABLE", reason: "analyzed-sha-mismatch", scope: report.scope },
    };
  }
  return {
    ok: true,
    graph: loaded.store.graph,
    partial: report.status === "PARTIAL" || loaded.store.meta.partial,
    analyzedSha,
    root: loaded.root,
  };
}

async function readFreshGraph(projectRoot: string): Promise<Opened | null> {
  const loaded = loadAt(projectRoot);
  if (!loaded || loaded.problem || !loaded.store.graph || !loaded.store.meta) return null;
  let headSha: string;
  try {
    headSha = await head(loaded.root);
  } catch {
    return null;
  }
  if (headSha.length === 0 || loaded.store.meta.analyzed_sha !== headSha) return null;
  if (loaded.store.graph.project.gitCommitHash !== headSha) return null;
  return {
    ok: true,
    graph: loaded.store.graph,
    partial: loaded.store.meta.partial,
    analyzedSha: headSha,
    root: loaded.root,
  };
}

function loadAt(projectRoot: string): { root: string; store: ReturnType<typeof loadStore>; problem: string | null } | null {
  let root: string;
  try {
    root = realpathSync(projectRoot);
  } catch {
    return null;
  }
  const store = loadStore(root, ASSEMBLER_VERSION);
  return { root, store, problem: problemKind(store.problem) };
}

function problemKind(problem: ReturnType<typeof loadStore>["problem"]): string | null {
  return problem == null ? null : problem.kind;
}

function graphForScope(graph: Graph, scope: string | undefined): Graph {
  const prefix = normalizeScope(scope);
  if (prefix == null) return graph;
  const nodes = graph.nodes.filter((node) => hitInScope(node.filePath, prefix));
  const ids = new Set(nodes.map((node) => node.id));
  return {
    ...graph,
    nodes,
    edges: graph.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)),
  };
}

function hitInScope(filePath: string | undefined, scope: string | undefined): boolean {
  if (scope == null) return true;
  return typeof filePath === "string" && pathInScope(filePath, scope);
}

function stamp<T extends { status: GraphStatus }>(
  result: T,
  opened: Opened,
  scope: string | undefined,
): QueryAnswer<T> {
  const prefix = normalizeScope(scope);
  return {
    ...result,
    status: coverageStatus(result.status, opened.partial),
    analyzed_sha: opened.analyzedSha,
    ...(prefix ? { scope: prefix } : {}),
  };
}

function failureStatus(report: FreshnessReport): "UNAVAILABLE" | "STALE_RECOVERABLE" {
  return report.status === "UNAVAILABLE" ? "UNAVAILABLE" : "STALE_RECOVERABLE";
}

function refusalFields(report: FreshnessReport): { reason?: string; scope?: string } {
  return {
    ...(report.reason ? { reason: report.reason } : {}),
    ...(report.scope != null ? { scope: report.scope } : {}),
  };
}

function emptySymbols(report: FreshnessReport): SymbolQuery {
  return { status: failureStatus(report), hits: [], ...refusalFields(report) };
}

function emptyNeighborhood(depth: number, report: FreshnessReport): QueryAnswer<Neighborhood> {
  return {
    status: failureStatus(report),
    projectName: "",
    target: null,
    depth,
    nodes: [],
    edges: [],
    visited: [],
    depthCapped: false,
    layer: null,
    ...refusalFields(report),
  };
}

function emptyTraversal(depth: number, report: FreshnessReport): QueryAnswer<Traversal> {
  return {
    status: failureStatus(report),
    originId: null,
    depth,
    nodes: [],
    edges: [],
    visited: [],
    depthCapped: false,
    ...refusalFields(report),
  };
}

function emptyPaths(maxDepth: number, report: FreshnessReport): QueryAnswer<PathQuery> {
  return {
    status: failureStatus(report),
    from: null,
    to: null,
    maxDepth,
    paths: [],
    visited: [],
    depthCapped: false,
    ...refusalFields(report),
  };
}

function emptyComponent(report: FreshnessReport): QueryAnswer<ComponentSlice> {
  return {
    status: failureStatus(report),
    file: null,
    children: [],
    layer: null,
    ...refusalFields(report),
  };
}

function emptyArchitecture(report: FreshnessReport): QueryAnswer<ArchitectureSummary> {
  return {
    status: failureStatus(report),
    layers: [],
    topImports: [],
    languages: [],
    frameworks: [],
    services: [],
    endpoints: [],
    tables: [],
    pipelines: [],
    schemas: [],
    resources: [],
    fileCount: 0,
    unlayeredFiles: 0,
    ...refusalFields(report),
  };
}

function emptyImpact(
  report: FreshnessReport,
  source: ImpactSource,
  depth: number | undefined,
): QueryAnswer<ImpactReport> {
  return {
    status: failureStatus(report),
    form: source.form,
    changedPaths: [],
    untrackedPaths: [],
    unmappedPaths: [],
    hits: [],
    depth: depth ?? DEFAULT_IMPACT_DEPTH,
    depthCapped: false,
    ...refusalFields(report),
  };
}
