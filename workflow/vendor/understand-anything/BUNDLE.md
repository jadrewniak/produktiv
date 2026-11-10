# Understand Anything structural bundle

Bundle root: the directory that contains this file, `workflow/vendor/understand-anything/`.

Grammar WASM resolves by package name from this root's `node_modules` (`require.resolve("<package>/<wasm file>")`). Runtime code does not write into `vendor/`. Graph output and scratch writes belong under the project's `.workflow/` tree.

## Installed bundle list

Included when this package is installed:

- `dist/` — `tsc` output of the structural subset
- `wasm/tree-sitter-dart-wasm/`
- `wasm/tree-sitter-swift-wasm/`
- `scripts/extract-structure-result.mjs`
- `scripts/extract-structure.mjs`
- `scripts/extract-import-map.mjs`
- `scripts/scan-project.mjs`
- `scripts/prepare-incremental.mjs`
- `scripts/finalize-incremental.mjs`
- `scripts/validate-incremental-symbols.mjs`
- `scripts/head-source.mjs` — local helper for HEAD blob reads and `.workflow/` paths
- `LICENSE` — upstream root MIT notice
- `THIRD-PARTY`
- `BUNDLE.md`

Omitted from that list:

- `core/src/**/__tests__/`
- `core/src/**/*.test.ts`

Those tests may stay in this repository for CI. They are not part of the user-facing bundle.

`typescript` and `@types/node` are devDependencies. They are not part of the published runtime set. `fuse.js` is not installed.

## Exact copies that are not patches

`core/src/persistence/index.ts` is an unmodified copy of the pin. `ignore-filter.ts` imports `resolveUaDir` from it, so the file has to be present for `tsc`. This unit does not change it. The graph store is `workflow/graph/store.ts`. Runtime code must not use this module as the persistent graph store.

`core/src/fingerprint.ts` is an unmodified copy. Persistent fingerprints use `extractFileFingerprint` on `HEAD` blob text. `buildFingerprintStore` reads the worktree and is not that path. The call-site rule is later work, not a patch in this file.

`core/src/analyzer/layer-detector.ts` still contains `buildLayerDetectionPrompt` and `applyLLMLayers`. The structural barrel in `core/src/index.ts` does not export them.

`core/src/analyzer/graph-builder.ts`, `core/src/staleness.ts`, and `core/src/index.ts` are adapted. Each file header names the upstream SHA and the frozen reason. The scripts under `scripts/` other than `extract-structure-result.mjs` are adapted the same way. Persistent inventory and bytes come from `HEAD`. Scratch writes go to `.workflow/cache/graph/`. Published graph, fingerprints, and meta go to `.workflow/graph/`.

## Not in this tree

`search.ts`, `llm-analyzer.ts`, `tour-generator.ts`, `language-lesson.ts`, `embedding-search.ts`, `figma/`, `plugins/discovery.ts`, dashboard, viewer, hooks, and skill markdown.
