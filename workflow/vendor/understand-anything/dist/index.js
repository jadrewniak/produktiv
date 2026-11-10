/**
 * ADAPT of Understand Anything 6df3065f1d8ddc2ce3615314d1d493f36d6b1c80.
 * Frozen reason: the barrel exports the structural surface only.
 * LLM prompts, tours, search, embeddings, Figma, and plugin discovery stay out.
 * `buildFingerprintStore` reads the worktree and is not exported here.
 */
export * from "./types.js";
export { KnowledgeGraphSchema, validateGraph, sanitizeGraph, autoFixGraph, COMPLEXITY_ALIASES, DIRECTION_ALIASES, } from "./schema.js";
export { TreeSitterPlugin } from "./plugins/tree-sitter-plugin.js";
export { builtinExtractors } from "./plugins/extractors/index.js";
export { GraphBuilder } from "./analyzer/graph-builder.js";
export { normalizeNodeId, normalizeComplexity, normalizeBatchOutput, } from "./analyzer/normalize-graph.js";
export { detectLayers } from "./analyzer/layer-detector.js";
export { PluginRegistry } from "./plugins/registry.js";
export { LanguageRegistry, FrameworkRegistry, builtinLanguageConfigs, builtinFrameworkConfigs, LanguageConfigSchema, FrameworkConfigSchema, } from "./languages/index.js";
export { MarkdownParser, YAMLConfigParser, JSONConfigParser, TOMLParser, EnvParser, DockerfileParser, SQLParser, GraphQLParser, ProtobufParser, TerraformParser, MakefileParser, ShellParser, registerAllParsers, } from "./plugins/parsers/index.js";
export { extractFileFingerprint, compareFingerprints, analyzeChanges, contentHash, } from "./fingerprint.js";
export { classifyUpdate, } from "./change-classifier.js";
export { getChangedFiles, getGraphFreshness, getGraphFreshnessBatch, isStale, mergeGraphUpdate, } from "./staleness.js";
export { createIgnoreFilter, DEFAULT_IGNORE_PATTERNS, } from "./ignore-filter.js";
//# sourceMappingURL=index.js.map