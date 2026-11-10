---
name: pk-explain
description: Explain code, a flow, architecture, a diff, a decision or an artifact from current evidence at the requested depth, without editing the project or performing a review.
---

# Explain the selected question

Use the selected repository/project directory. Read `policies/kernel.md` and `references/context-pack.md` through the adjacent `produktiv` package link (source checkout: `workflow/`). The output is an answer in the conversation, not a document or a change to the project.

## Context

- Must load: Question/selected target, existing depth/detail preferences, current source/diff or requested artifact sections
- May load conditionally: artifact-resolution for actual artifact reads; relevant domain/ADR/design pointers; graph-use only for unresolved structure, capabilities only for uncertainty; selected adapter signature for chosen query
- Must not load by default: Full docs/graph/repository, review rubrics, implementation/repair instructions, raw session history, unrelated policies, tests/build execution merely to explain

## Question and presentation

Start from the user's question and named file, symbol, range, artifact or area. Resolve a small ambiguity from nearby source first; ask only when competing targets would materially change the answer. With no target, offer a bounded mental model or clarify the area, not an exhaustive repository tour.

Read `technical_depth` and `detail` from `.workflow/local/preferences.yaml` when present. The current request overrides saved values independently. Use the kernel defaults for missing/invalid values: product-technical and concise. Do not create, repair or save preferences, run onboarding, or ask technical depth on every explanation.

- Non-technical: user outcomes and plain-language flow, few code terms.
- Product-technical: components, interactions and key constraints.
- Engineer: exact symbols, contracts, state/error paths and evidence.

Detail controls length, not evidence strength. Begin with the direct answer, then the supporting flow and precise references the question needs. When the user is confused, supply the missing premise and rephrase more clearly using project vocabulary; do not merely shorten the same answer.

## Select evidence

Read relevant repository instructions and the smallest evidence set:

- **Code or flow:** actual implementation, entry point and the necessary caller/contract/test; trace inputs, state, outputs/failures only as far as the question needs.
- **Architecture or project:** relevant project-context pointers, canonical docs/ADRs and source entry points. Context is orientation, not proof of current implementation. Follow only the boundary or relationship still unexplained.
- **Diff:** establish the requested base/range or staged/worktree selection, read the actual diff and affected source. Explain before/after behavior and relevant relationships; do not assume `HEAD` represents dirty or untracked code.
- **Decision/why:** the owning Issue, Spec, Plan or ADR and its current code consequence. Structure alone cannot establish historical intent.
- **Plan/Spec:** selected sections and authority links. Describe intended behavior or execution route without implying it is implemented; inspect code only when mapping to current reality is part of the question.

For actual artifact reads, use `references/artifact-resolution.md` and configured stores, including current hidden-comment and legacy identity. Remain a reader: its author/writeback paths do not authorize edits. Read domain/design context only when its terms or accepted visual scope are needed. Read existing verification evidence when relevant; a test definition is not a test execution or PASS. Do not run application tests/builds, install dependencies or start services merely to explain source.

For dirty projects preserve all pre-existing work. Use current source/diff for implementation facts; canonical artifacts own product/system decisions. Describe contradictions and unsupported intent rather than repairing or silently choosing a new authority. No Git, setup, graph or optional artifact is required for a file-based answer. Missing essential source is an explicit limitation, not permission to invent the answer.

## Optional structural graph

Only when source/diff leaves a concrete structural question, read `references/graph-use.md`. It owns availability, policy, local opt-out, coverage and freshness. Use `references/capabilities.md` for uncertain host facts; do not load the entire graph or probe unrelated tools.

Use the package adapter `adapters/graph/index.js`. Call `ensure_fresh(projectRoot, scope, "/pk-explain")`, then the smallest useful query: `related` for a known target, `architecture_overview` for the selected structural area, or `impact_of_diff` for a selected change. Read only the chosen export's signature before calling it; symbol lookup is allowed when the target is not yet resolved. Queries also enforce freshness. Never impersonate `/pk-setup` or `eval`, initialize a missing graph, call vendor APIs, request a full rebuild, or implement a second freshness policy.

The shared adapter may maintain existing generated graph/cache state; this is the frozen read-only contract's sole generated-state exception, not permission to edit project files. If the user requires zero filesystem writes, skip graph calls and use source/diff. A missing graph, unavailable runtime or failed stale recovery uses the same source fallback. Do not repair installation/setup or change graph policy. Disclose a failed selected query and its limit; an unused graph needs no warning.

Use only current deterministic structure at the returned analyzed SHA. Partial coverage or an absent edge cannot prove absence of a relationship. Verify behavior in current source and inspect relevant uncommitted changes separately. No semantic enrichment, complexity-as-risk, tour prose, dashboard or overlay output.

## Answer and stop

Distinguish **fact**, **inference** and **uncertainty** at the claim that needs the distinction, in the user's language. Facts cite actual files/symbols/sections or fresh deterministic graph edges; inferred rationale is labelled as such. Say when intent or a transition is not established. Natural wording is sufficient; do not mechanically prefix every sentence or invent an inference to fill a format. Depth never hides a material caveat.

Explain rather than judge: no review severities, merge/safety verdict, unsolicited repair plan or hidden code review. Do not edit code, tests, config/preferences, context, canonical artifacts or agent instructions; do not save summaries, handoffs, architecture docs or onboarding files. Missing setup stays missing. Do not commit or otherwise deliver repository changes.

Suggest `/pk-diagram` only when a particular relationship would be clearer visually, naming the question. Do not invoke it unless the user asks. A request to decide or change behavior is a separate scope; do not start discovery, implementation or repair from an explanation request.

Self-check that the answer addresses the selected question, fits depth/detail, cites sufficient current evidence, separates intended from implemented behavior and reports real uncertainty. Stop once that understanding is supported. No artifact or next lifecycle command is required.
