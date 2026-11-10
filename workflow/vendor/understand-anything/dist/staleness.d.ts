/**
 * ADAPT of Understand Anything 6df3065f1d8ddc2ce3615314d1d493f36d6b1c80.
 * Frozen reason: a swallowed Git error must not look fresh, and committed
 * paths are exposed separately from dirty paths. Dirty paths do not enter
 * mergeGraphUpdate.
 */
import type { KnowledgeGraph, GraphNode, GraphEdge } from "./types.js";
export interface StalenessResult {
    stale: boolean;
    changedFiles: string[];
}
export type GraphFreshnessRelation = "behind" | "ahead" | "diverged";
export type GraphFreshnessUnknownReason = "missing-graph-commit" | "git-head-unavailable" | "graph-commit-unavailable" | "git-command-timeout" | "freshness-request-failed";
export type GraphFreshnessResult = {
    status: "fresh";
    graphCommitHash: string;
    headCommitHash: string;
    changedFileCount: 0;
    changedFiles: [];
    committedFiles: [];
    dirtyFiles: [];
    commitsBehind: 0;
    commitsAhead: 0;
    lastAnalyzedAt?: string;
} | {
    status: "dirty";
    graphCommitHash: string;
    headCommitHash: string;
    changedFileCount: 0;
    changedFiles: [];
    committedFiles: [];
    dirtyFiles: string[];
    commitsBehind: 0;
    commitsAhead: 0;
    lastAnalyzedAt?: string;
} | {
    status: "stale";
    relation: GraphFreshnessRelation;
    graphCommitHash: string;
    headCommitHash: string;
    changedFileCount: number;
    changedFiles: string[];
    committedFiles: string[];
    dirtyFiles: string[];
    commitsBehind: number;
    commitsAhead: number;
    lastAnalyzedAt?: string;
} | {
    status: "unknown";
    reason: GraphFreshnessUnknownReason;
    graphCommitHash?: string;
    headCommitHash?: string;
    lastAnalyzedAt?: string;
};
export interface GraphFreshnessInput {
    graphCommitHash?: string | null;
    lastAnalyzedAt?: string;
}
/**
 * Committed paths that differ between `lastCommitHash` and HEAD.
 * An empty array means Git succeeded and printed no names.
 * A Git failure throws. It must not look like a clean tree.
 */
export declare function getChangedFiles(projectDir: string, lastCommitHash: string): string[];
/**
 * Check whether the knowledge graph is stale relative to the current HEAD.
 */
export declare function isStale(projectDir: string, lastCommitHash: string): StalenessResult;
/**
 * Describe the freshness of multiple persisted graphs against one Git snapshot.
 */
export declare function getGraphFreshnessBatch<T extends string>(projectDir: string, inputs: Record<T, GraphFreshnessInput>): Promise<Record<T, GraphFreshnessResult>>;
/**
 * Describe whether a persisted graph can still be trusted for the project.
 *
 * Unknown is intentionally distinct from fresh: if Git metadata cannot be
 * read, callers should warn softly rather than imply the graph is current.
 */
export declare function getGraphFreshness(projectDir: string, input: GraphFreshnessInput): Promise<GraphFreshnessResult>;
/**
 * Merge new analysis results into an existing knowledge graph.
 *
 * 1. Remove old nodes belonging to changed files (matched by filePath).
 * 2. Remove old edges where the SOURCE or TARGET node belongs to a changed file.
 * 3. Add new nodes and edges.
 * 4. Update project.gitCommitHash and project.analyzedAt.
 * 5. Return the merged graph.
 *
 * `changedFilePaths` is the committed set. `dirtyFilePaths` lists worktree
 * paths that must not enter the persistent graph. A path in both lists is a
 * committed change that is also dirty: the replacement nodes stay, and the
 * caller must have built them from HEAD bytes. A dirty path that is not in
 * the committed set is dropped from both the splice and the replacement nodes.
 */
export declare function mergeGraphUpdate(existingGraph: KnowledgeGraph, changedFilePaths: string[], newNodes: GraphNode[], newEdges: GraphEdge[], newCommitHash: string, dirtyFilePaths?: readonly string[]): KnowledgeGraph;
//# sourceMappingURL=staleness.d.ts.map