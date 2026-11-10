# Provenance

Archify rows marked `VENDOR` are copied at `5289f6867f048a7450ec5718f58459613a84cf41`. The ADAPT files are `workflow/vendor/archify/renderers/shared/i18n.mjs` and `workflow/vendor/archify/assets/template.html`, with the patch named in each file header. `brand-marks.mjs` is a REWRITE stub; the brand catalog is not copied. Understand Anything rows marked `VENDOR` are copied at the pinned SHA. Its ADAPT rows are copied with the patch named in each file header. The graph ADAPT and REWRITE rows live under `workflow/graph/` with the patch named in each file header. Remaining ADAPT and REWRITE rows are still planned. The Dart WASM binary is in `workflow/vendor/understand-anything/wasm/tree-sitter-dart-wasm/` with `BUILD.md` and the grammar `LICENSE`.

Statuses:

- `VENDOR` — pinned snapshot copied into the destination, no intended behavior change
- `PLANNED_VENDOR` — pinned snapshot, not copied yet
- `ADAPT` — pinned snapshot copied with the local patch named in Notes and in the file header
- `PLANNED_ADAPT` — pinned snapshot plus a local patch described in the extraction notes
- `PLANNED_REWRITE` — behavior we implement ourselves; upstream path is a reference, not a file to copy

Upstream: `https://github.com/Egonex-AI/Understand-Anything`
Commit: `6df3065f1d8ddc2ce3615314d1d493f36d6b1c80`
Root license: MIT (`LICENSE`, Copyright 2026 Yuxiang Lin and Infinite Universe, Inc.). No `NOTICE` file in the pin.

The root `LICENSE`, `packages/tree-sitter-swift-wasm/LICENSE`, and `packages/tree-sitter-dart-wasm/BUILD.md` are in the vendor tree. The Dart grammar `LICENSE` from published `tree-sitter-dart@1.0.0` is stored beside the WASM. Package metadata and that file disagree; both facts are in the note after the Understand Anything table. Installed grammar and runtime package names, versions, and license files are recorded in `workflow/vendor/understand-anything/THIRD-PARTY`. `yaml` resolved as ISC, and that field matches its license file.

| Upstream | Source path | Commit | License | Classification | Planned local destination | Notes |
|---|---|---|---|---|---|---|
| `Egonex-AI/Understand-Anything` | `understand-anything-plugin/packages/core/src/types.ts` | `6df3065f1d8ddc2ce3615314d1d493f36d6b1c80` | MIT | VENDOR | `workflow/vendor/understand-anything/core/src/types.ts` | Graph schema types |
| `Egonex-AI/Understand-Anything` | `understand-anything-plugin/packages/core/src/schema.ts` | `6df3065f1d8ddc2ce3615314d1d493f36d6b1c80` | MIT | VENDOR | `workflow/vendor/understand-anything/core/src/schema.ts` | Zod validation |
| `Egonex-AI/Understand-Anything` | `understand-anything-plugin/packages/core/src/plugins/` | `6df3065f1d8ddc2ce3615314d1d493f36d6b1c80` | MIT | VENDOR | `workflow/vendor/understand-anything/core/src/plugins/` | Tree-sitter plugin, extractors, non-code parsers, symbol evidence. Tests stay in our CI tree, not the user bundle |
| `Egonex-AI/Understand-Anything` | `understand-anything-plugin/packages/core/src/languages/` | `6df3065f1d8ddc2ce3615314d1d493f36d6b1c80` | MIT | VENDOR | `workflow/vendor/understand-anything/core/src/languages/` | Language and framework configs |
| `Egonex-AI/Understand-Anything` | `understand-anything-plugin/packages/core/src/fingerprint.ts` | `6df3065f1d8ddc2ce3615314d1d493f36d6b1c80` | MIT | VENDOR | `workflow/vendor/understand-anything/core/src/fingerprint.ts` | Use `extractFileFingerprint` on `HEAD` blob text. Do not call `buildFingerprintStore` for the persistent graph |
| `Egonex-AI/Understand-Anything` | `understand-anything-plugin/packages/core/src/change-classifier.ts` | `6df3065f1d8ddc2ce3615314d1d493f36d6b1c80` | MIT | VENDOR | `workflow/vendor/understand-anything/core/src/change-classifier.ts` | SKIP / PARTIAL / ARCHITECTURE / FULL |
| `Egonex-AI/Understand-Anything` | `understand-anything-plugin/packages/core/src/ignore-filter.ts` | `6df3065f1d8ddc2ce3615314d1d493f36d6b1c80` | MIT | VENDOR | `workflow/vendor/understand-anything/core/src/ignore-filter.ts` | Default ignore list |
| `Egonex-AI/Understand-Anything` | `understand-anything-plugin/packages/core/src/analyzer/normalize-graph.ts` | `6df3065f1d8ddc2ce3615314d1d493f36d6b1c80` | MIT | VENDOR | `workflow/vendor/understand-anything/core/src/analyzer/normalize-graph.ts` | ID cleanup |
| `Egonex-AI/Understand-Anything` | `understand-anything-plugin/packages/core/src/analyzer/layer-detector.ts` | `6df3065f1d8ddc2ce3615314d1d493f36d6b1c80` | MIT | VENDOR | `workflow/vendor/understand-anything/core/src/analyzer/layer-detector.ts` | Call `detectLayers` only |
| `Egonex-AI/Understand-Anything` | `understand-anything-plugin/packages/tree-sitter-dart-wasm/` | `6df3065f1d8ddc2ce3615314d1d493f36d6b1c80` | See the `tree-sitter-dart@1.0.0` note after this table. Metadata and bundled `LICENSE` disagree | VENDOR | `workflow/vendor/understand-anything/wasm/tree-sitter-dart-wasm/` | `BUILD.md`, grammar `LICENSE`, `package.json`, and WASM binary copied. No second grammar |
| `Egonex-AI/Understand-Anything` | `understand-anything-plugin/packages/tree-sitter-swift-wasm/` | `6df3065f1d8ddc2ce3615314d1d493f36d6b1c80` | MIT, `LICENSE` in that directory (Copyright 2021 alex-pinkus) | VENDOR | `workflow/vendor/understand-anything/wasm/tree-sitter-swift-wasm/` | Includes `LICENSE` |
| `Egonex-AI/Understand-Anything` | `understand-anything-plugin/skills/understand/extract-structure.mjs` | `6df3065f1d8ddc2ce3615314d1d493f36d6b1c80` | MIT | ADAPT | `workflow/vendor/understand-anything/scripts/extract-structure.mjs` | Read `git show HEAD:path`; parse call unchanged |
| `Egonex-AI/Understand-Anything` | `understand-anything-plugin/skills/understand/extract-structure-result.mjs` | `6df3065f1d8ddc2ce3615314d1d493f36d6b1c80` | MIT | VENDOR | `workflow/vendor/understand-anything/scripts/extract-structure-result.mjs` | Result mapping; no disk reads |
| `Egonex-AI/Understand-Anything` | `understand-anything-plugin/skills/understand/extract-import-map.mjs` | `6df3065f1d8ddc2ce3615314d1d493f36d6b1c80` | MIT | ADAPT | `workflow/vendor/understand-anything/scripts/extract-import-map.mjs` | Blob reads; resolution rules unchanged |
| `Egonex-AI/Understand-Anything` | `understand-anything-plugin/packages/core/src/analyzer/graph-builder.ts` | `6df3065f1d8ddc2ce3615314d1d493f36d6b1c80` | MIT | ADAPT | `workflow/vendor/understand-anything/core/src/analyzer/graph-builder.ts` | Disambiguate duplicate function ids; structural placeholders |
| `Egonex-AI/Understand-Anything` | `understand-anything-plugin/packages/core/src/staleness.ts` | `6df3065f1d8ddc2ce3615314d1d493f36d6b1c80` | MIT | ADAPT | `workflow/vendor/understand-anything/core/src/staleness.ts` | Untracked and dirty paths stay out of the persistent graph; git errors are not fresh |
| `Egonex-AI/Understand-Anything` | `understand-anything-plugin/packages/core/src/persistence/index.ts` | `6df3065f1d8ddc2ce3615314d1d493f36d6b1c80` | MIT | PLANNED_ADAPT | `workflow/graph/store.ts` | Wrap path sanitizer; store under configurable `.workflow/graph/`. An unmodified pin copy is also at `workflow/vendor/understand-anything/core/src/persistence/index.ts` because `ignore-filter.ts` imports `resolveUaDir`. Produktiv does not adapt it |
| `Egonex-AI/Understand-Anything` | `understand-anything-plugin/packages/core/src/index.ts` | `6df3065f1d8ddc2ce3615314d1d493f36d6b1c80` | MIT | ADAPT | `workflow/vendor/understand-anything/core/src/index.ts` | Structural exports only |
| `Egonex-AI/Understand-Anything` | `understand-anything-plugin/skills/understand/scan-project.mjs` | `6df3065f1d8ddc2ce3615314d1d493f36d6b1c80` | MIT | ADAPT | `workflow/vendor/understand-anything/scripts/scan-project.mjs` | Persistent inventory is `git ls-tree HEAD`; untracked files stay out |
| `Egonex-AI/Understand-Anything` | `understand-anything-plugin/skills/understand/prepare-incremental.mjs` | `6df3065f1d8ddc2ce3615314d1d493f36d6b1c80` | MIT | ADAPT | `workflow/vendor/understand-anything/scripts/prepare-incremental.mjs` | `HEAD` blobs, importer closure, reconcile to `HEAD` before query |
| `Egonex-AI/Understand-Anything` | `understand-anything-plugin/skills/understand/finalize-incremental.mjs` | `6df3065f1d8ddc2ce3615314d1d493f36d6b1c80` | MIT | ADAPT | `workflow/vendor/understand-anything/scripts/finalize-incremental.mjs` | Publish assembler output |
| `Egonex-AI/Understand-Anything` | `understand-anything-plugin/skills/understand/validate-incremental-symbols.mjs` | `6df3065f1d8ddc2ce3615314d1d493f36d6b1c80` | MIT | ADAPT | `workflow/vendor/understand-anything/scripts/validate-incremental-symbols.mjs` | Path updates; deletion proof kept |
| `Egonex-AI/Understand-Anything` | `understand-anything-plugin/src/diff-analyzer.ts` | `6df3065f1d8ddc2ce3615314d1d493f36d6b1c80` | MIT | ADAPT | `workflow/graph/impact.ts` | Depth, structural edges, evidence classes |
| `Egonex-AI/Understand-Anything` | `understand-anything-plugin/src/explain-builder.ts` | `6df3065f1d8ddc2ce3615314d1d493f36d6b1c80` | MIT | ADAPT | `workflow/graph/neighborhood.ts` | Depth; prompt formatter dropped |
| `Egonex-AI/Understand-Anything` | `understand-anything-plugin/agents/file-analyzer.md` (behavior reference) | `6df3065f1d8ddc2ce3615314d1d493f36d6b1c80` | MIT | PLANNED_REWRITE | `workflow/graph/assemble.ts` | Not copied. Assembler replaces the agent’s node emission |
| `Egonex-AI/Understand-Anything` | `understand-anything-plugin/packages/core/src/staleness.ts` `getGraphFreshness` (behavior reference) | `6df3065f1d8ddc2ce3615314d1d493f36d6b1c80` | MIT | PLANNED_REWRITE | `workflow/graph/reconcile.ts` | Coordinator around the adapted helper; not a second copy of the file |
| `Egonex-AI/Understand-Anything` | `understand-anything-plugin/src/diff-analyzer.ts` (traversal gap) | `6df3065f1d8ddc2ce3615314d1d493f36d6b1c80` | MIT | REWRITE | `workflow/graph/queries.ts` | Depth-N traversals have no upstream function |
| — | — | — | — | PLANNED_REWRITE | `workflow/adapters/graph/index.ts` | Workflow-owned primitive facade |

### tree-sitter-dart@1.0.0

Published package metadata:

- `license`: ISC

Published package `LICENSE` file:

- MIT-form license text
- Copyright (c) 2020-2022 UserNobody14 and others

Pinned UA `BUILD.md`:

- declares MIT inherited from `tree-sitter-dart@1.0.0`

Vendoring basis:

- exact `LICENSE` text from the published 1.0.0 tarball
- tarball shasum: `c2e6f2fead28913714dd9a00bfea4b57c3c49f47`

Note: package metadata and bundled `LICENSE` text disagree; both facts are retained in provenance.

Upstream: `https://github.com/tt-a1i/archify`
Commit: `5289f6867f048a7450ec5718f58459613a84cf41`
Root license: MIT (`LICENSE` and `archify/LICENSE`, Copyright 2026 tt-a1i (Archify); Copyright 2025 Cocoon AI). No `NOTICE` file. The vendored notice is `workflow/vendor/archify/LICENSE`. Font license is SIL OFL 1.1 (`workflow/vendor/archify/assets/JetBrainsMono-OFL.txt`), shipped beside the template. The brand catalog is not copied.

| Upstream | Source path | Commit | License | Classification | Planned local destination | Notes |
|---|---|---|---|---|---|---|
| `tt-a1i/archify` | `archify/schemas/` | `5289f6867f048a7450ec5718f58459613a84cf41` | MIT | VENDOR | `workflow/vendor/archify/schemas/` | Five diagram schemas plus `common.schema.json` |
| `tt-a1i/archify` | `archify/renderers/shared/generated-validators.mjs` | `5289f6867f048a7450ec5718f58459613a84cf41` | MIT | VENDOR | `workflow/vendor/archify/renderers/shared/generated-validators.mjs` | Prebuilt Ajv validators. No runtime `ajv` install |
| `tt-a1i/archify` | `archify/renderers/shared/validator.mjs` | `5289f6867f048a7450ec5718f58459613a84cf41` | MIT | VENDOR | `workflow/vendor/archify/renderers/shared/validator.mjs` | Schema diagnostics |
| `tt-a1i/archify` | `archify/renderers/architecture/` | `5289f6867f048a7450ec5718f58459613a84cf41` | MIT | VENDOR | `workflow/vendor/archify/renderers/architecture/` | `render-architecture.mjs`, `grid.mjs` |
| `tt-a1i/archify` | `archify/renderers/workflow/render-workflow.mjs` | `5289f6867f048a7450ec5718f58459613a84cf41` | MIT | VENDOR | `workflow/vendor/archify/renderers/workflow/render-workflow.mjs` | Workflow entry |
| `tt-a1i/archify` | `archify/renderers/workflow/workflow-compiler.mjs` | `5289f6867f048a7450ec5718f58459613a84cf41` | MIT | VENDOR | `workflow/vendor/archify/renderers/workflow/workflow-compiler.mjs` | v1 fixed layout and v2 compiler |
| `tt-a1i/archify` | `archify/renderers/workflow/workflow-migration-geometry.mjs` | `5289f6867f048a7450ec5718f58459613a84cf41` | MIT | VENDOR | `workflow/vendor/archify/renderers/workflow/workflow-migration-geometry.mjs` | Imported by the compiler. The migrate CLI is not copied |
| `tt-a1i/archify` | `archify/renderers/sequence/render-sequence.mjs` | `5289f6867f048a7450ec5718f58459613a84cf41` | MIT | VENDOR | `workflow/vendor/archify/renderers/sequence/render-sequence.mjs` | Sequence entry |
| `tt-a1i/archify` | `archify/renderers/dataflow/render-dataflow.mjs` | `5289f6867f048a7450ec5718f58459613a84cf41` | MIT | VENDOR | `workflow/vendor/archify/renderers/dataflow/render-dataflow.mjs` | Dataflow entry |
| `tt-a1i/archify` | `archify/renderers/lifecycle/render-lifecycle.mjs` | `5289f6867f048a7450ec5718f58459613a84cf41` | MIT | VENDOR | `workflow/vendor/archify/renderers/lifecycle/render-lifecycle.mjs` | Lifecycle entry |
| `tt-a1i/archify` | `archify/renderers/shared/geometry.mjs` | `5289f6867f048a7450ec5718f58459613a84cf41` | MIT | VENDOR | `workflow/vendor/archify/renderers/shared/geometry.mjs` | Routing and composition checks |
| `tt-a1i/archify` | `archify/renderers/shared/cli.mjs` | `5289f6867f048a7450ec5718f58459613a84cf41` | MIT | VENDOR | `workflow/vendor/archify/renderers/shared/cli.mjs` | Load and write. Brand import hits the stub |
| `tt-a1i/archify` | `archify/renderers/shared/utils.mjs` | `5289f6867f048a7450ec5718f58459613a84cf41` | MIT | VENDOR | `workflow/vendor/archify/renderers/shared/utils.mjs` | Template fill |
| `tt-a1i/archify` | `archify/renderers/shared/diagnostics.mjs` | `5289f6867f048a7450ec5718f58459613a84cf41` | MIT | VENDOR | `workflow/vendor/archify/renderers/shared/diagnostics.mjs` | Fail-closed errors |
| `tt-a1i/archify` | `archify/renderers/shared/legend.mjs` | `5289f6867f048a7450ec5718f58459613a84cf41` | MIT | VENDOR | `workflow/vendor/archify/renderers/shared/legend.mjs` | Legend footprint |
| `tt-a1i/archify` | `archify/renderers/shared/text-fit.mjs` | `5289f6867f048a7450ec5718f58459613a84cf41` | MIT | VENDOR | `workflow/vendor/archify/renderers/shared/text-fit.mjs` | Label fit |
| `tt-a1i/archify` | `archify/renderers/shared/layout-report.mjs` | `5289f6867f048a7450ec5718f58459613a84cf41` | MIT | VENDOR | `workflow/vendor/archify/renderers/shared/layout-report.mjs` | Architecture boxes |
| `tt-a1i/archify` | `archify/renderers/shared/desktop-readability.mjs` | `5289f6867f048a7450ec5718f58459613a84cf41` | MIT | VENDOR | `workflow/vendor/archify/renderers/shared/desktop-readability.mjs` | Checker input |
| `tt-a1i/archify` | `archify/renderers/shared/output-path.mjs` | `5289f6867f048a7450ec5718f58459613a84cf41` | MIT | VENDOR | `workflow/vendor/archify/renderers/shared/output-path.mjs` | Destination safety |
| `tt-a1i/archify` | `archify/renderers/shared/repository-evidence.mjs` | `5289f6867f048a7450ec5718f58459613a84cf41` | MIT | VENDOR | `workflow/vendor/archify/renderers/shared/repository-evidence.mjs` | Optional git check. Adapter blocks this on PROPOSED |
| `tt-a1i/archify` | `archify/renderers/shared/repository-location.mjs` | `5289f6867f048a7450ec5718f58459613a84cf41` | MIT | VENDOR | `workflow/vendor/archify/renderers/shared/repository-location.mjs` | Compare URL normalize |
| `tt-a1i/archify` | `archify/renderers/shared/engineering-profiles.mjs` | `5289f6867f048a7450ec5718f58459613a84cf41` | MIT | VENDOR | `workflow/vendor/archify/renderers/shared/engineering-profiles.mjs` | No-op unless the field is set. v1 does not author it |
| `tt-a1i/archify` | `archify/renderers/shared/i18n.mjs` | `5289f6867f048a7450ec5718f58459613a84cf41` | MIT | ADAPT | `workflow/vendor/archify/renderers/shared/i18n.mjs` | Neutral `diagram.description.*` strings. Escape behavior unchanged |
| `tt-a1i/archify` | `archify/delta/architecture-delta.mjs` | `5289f6867f048a7450ec5718f58459613a84cf41` | MIT | VENDOR | `workflow/vendor/archify/delta/architecture-delta.mjs` | Call `compareArchitecture`. Visual HTML builders are not a v1 output |
| `tt-a1i/archify` | `archify/scripts/check-render-output.mjs` | `5289f6867f048a7450ec5718f58459613a84cf41` | MIT | VENDOR | `workflow/vendor/archify/scripts/check-render-output.mjs` | Post-render gate |
| `tt-a1i/archify` | `archify/assets/template.html` | `5289f6867f048a7450ec5718f58459613a84cf41` | MIT; embedded font SIL OFL 1.1 | ADAPT | `workflow/vendor/archify/assets/template.html` | Same file. Remove visible branding and chrome in place. Keep `applyTemplate` sentinels, SVG CSS, and the embedded font. Not a replacement shell |
| `tt-a1i/archify` | `archify/assets/JetBrainsMono-OFL.txt` | `5289f6867f048a7450ec5718f58459613a84cf41` | SIL OFL 1.1 | VENDOR | `workflow/vendor/archify/assets/JetBrainsMono-OFL.txt` | Ship with the template |
| `tt-a1i/archify` | `archify/LICENSE` | `5289f6867f048a7450ec5718f58459613a84cf41` | MIT | VENDOR | `workflow/vendor/archify/LICENSE` | Attribution |
| `tt-a1i/archify` | `archify/renderers/shared/brand-marks.mjs` (behavior reference) | `5289f6867f048a7450ec5718f58459613a84cf41` | MIT | REWRITE | `workflow/vendor/archify/renderers/shared/brand-marks.mjs` | Not a copy. Stub fails when `brand` is set. Catalog is not copied |
| `tt-a1i/archify` | `archify/delta/architecture-delta.mjs` `compareArchitecture` (filter reference) | `5289f6867f048a7450ec5718f58459613a84cf41` | MIT | REWRITE | `workflow/adapters/diagram/` | Facade. Semantic summary drops geometry statuses. Not a second copy of the delta file |
| — | — | — | — | REWRITE | `workflow/adapters/diagram/index.mjs` | `validate_ir`, `render_ir`, `compare_architecture`, `verify_artifact` |

## Prompt sources

Skills, policies, references, reviewer criteria and templates are written for Produktiv. They borrow mechanisms and ideas from the projects below, pinned in `UPSTREAMS.yaml`, but copy no prompt text: on 2026-11-07 no run of 10 words in those files matched the pinned upstream prompts, and the 7 matches at 7 words were common phrases. None of these projects is installed or run by Produktiv.

| Upstream | Commit | License | Copyright line in the pinned license | What Produktiv uses |
|---|---|---|---|---|
| [`mattpocock/skills`](https://github.com/mattpocock/skills) | `c55ee46` | MIT | Copyright (c) 2026 Matt Pocock | Discovery questioning, research and design command shapes |
| [`addyosmani/agent-skills`](https://github.com/addyosmani/agent-skills) | `dc27a9c` | MIT | Copyright (c) 2025 Addy Osmani | Source-driven research, small implementation slices, localized debugging |
| [`obra/superpowers`](https://github.com/obra/superpowers) | `5bf4e78` | MIT | Copyright (c) 2025 Jesse Vincent | Plan writing and execution, code review, the debugging loop |
| [`DietrichGebert/ponytail`](https://github.com/DietrichGebert/ponytail) | `e3ba2aa` | MIT | Copyright (c) 2026 DietrichGebert | Simplicity review |
| [`JuliusBrussee/caveman`](https://github.com/JuliusBrussee/caveman) | `ae26f3a` | MIT for skills and prompts; BSL-1.1 for the engine directories | Copyright (c) 2026 Julius Brussee | Surgical changes and verify-and-stop, from the MIT skills and prompts only; nothing from the BSL-1.1 engine |
| [`nextlevelbuilder/ui-ux-pro-max-skill`](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | `0d2b646` | MIT | Copyright (c) 2024 Next Level Builder | Query-first design lookups |
| [`Leonxlnx/taste-skill`](https://github.com/Leonxlnx/taste-skill) | `5217fb4` | MIT | Copyright (c) 2026 Leonxlnx | Visual design direction |

The graph and diagram runtimes are copied code, so their full licenses ship beside them in `workflow/vendor/`. The tables above this section list those files.
