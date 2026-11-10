---
name: pk-discover
description: Explore a product direction or close a selected scope; resolve material product and technical choices, preserving agreed knowledge when authorized.
---

# Discover the intended outcome

Use the repository root and adjacent `produktiv` resources (source: `workflow/`). Read `policies/kernel.md` and `policies/decisions.md`. Follow `references/context-pack.md` and the Context section below for conditional inputs.

## Context

- Must load: Question, existing project/domain pointers; `policies/decisions.md`
- May load conditionally: Named artifacts/code; accepted design for interaction; selected helper and bounded question; artifact-resolution, artifact-writing, state-layout and Issue template for authorized writeback; capabilities on uncertainty; graph-use for unresolved structure
- Must not load by default: All product artifacts/policies, reviewer rubrics, raw helper trails, full graph, artifact templates for conversation-only exploration

## Frame the session

Infer whether the user wants exploration or preparation. Exploration may end with shared understanding, a roadmap or authorized knowledge capture; it need not produce an Issue. “Just discuss” means no writes. Preparation closes a concrete scope for further work. Ask only when ambiguity changes the result or permission.

Read existing project/domain context and relevant named artifacts; for an interaction read accepted design pointers. Inspect the narrowest code/docs that establish facts and contradictions. Existing behavior is evidence, not authority over the user's intended change.

For a broad greenfield brief propose a valuable testable increment and show what remains, or let the user retain the whole V1. A technical foundation unit is not necessarily a useful product increment. Keep the full agreed roadmap visible without demanding implementation decisions for future phases.

Before the first questions of a substantial exploration, show a short provisional conversation map: the decision areas, their dependencies and the intended outcome. Include relevant deferred foundation choices from context, not only product behavior. Adapt it after answers; a focused repair needs only its open question, not a full interview agenda.

## Work the decisions

Work in rounds: ask the smallest useful set whose prerequisites are settled, synthesize the answers, persist newly confirmed durable knowledge when authorized, then update the remaining conversation map. Briefly say what was settled/saved and why the next question follows. No write when nothing durable changed, no new ledger, and no fixed number of questions. Reopen only branches affected by new evidence or changed intent.

Facts are the agent's job. Ask about choices that change meaning, behavior, UX, data, privacy/security, public compatibility, maintenance cost or a difficult-to-reverse foundation. Technical choices belong in the conversation when they affect the direction; their representation is recorded in the appropriate source, not forced into a product Issue.

Use concrete scenarios and credible alternatives, with one recommendation and consequences. Do not turn every probe into a menu. Resolve repository facts yourself, honor valid delegation, and stop debating synonyms once meaning is agreed. A reversible implementation detail can remain with the executor.

Use decisions policy to distinguish confirmed reusable terms, selective ADRs and proposals. Bring a deferred choice back as an actual question when its trigger is reached; repeating that it is open does not resolve it. Do not wait for final Issue creation to save established knowledge.

## Use support for a real question

Text that settles the question needs no tool. For a remaining uncertainty consult `references/policy-triggers.md` and the selected support skill:
- research for unavailable external facts or comparisons;
- prototype for behavior that must be tried;
- design for a coherent visual proposal;
- diagram for a relationship that must be seen.

When a helper would resolve the current uncertainty, explain its purpose and use it within existing authorization; if creating the artifact needs a new scope decision, offer that concrete action here. Do not merely list a slash command for the user to retype. Read the selected skill, pass the bounded question and settled context, then resume this conversation from its result. A helper supplies evidence/proposals, not consent. Missing capability stays a disclosed limit; continue independent questions. Use `references/graph-use.md` only when source reads leave a material structural fact unresolved.

## Converge and preserve

Exploration ends when the requested understanding or roadmap is useful, with decisions and deliberate unknowns distinguished. Do not force a delivery boundary, Issue or further command.

For preparation, confirm the consolidated behavior once unless already accepted. A safe deferral names impact, owner/trigger and reason and does not remove a prerequisite. Unresolved material questions remain visible; do not disguise them as exclusions or defaults.

Before writing a broad outcome, propose separate feature boundaries when invariants, lifecycle, permissions or independently provable outcomes differ. Obtain agreement, retain shared dependencies and use the split procedure in `references/artifact-writing.md`; do not split merely by length or silently rename existing identities.

For authorized artifacts read `references/artifact-resolution.md`, `references/artifact-writing.md`, `references/state-layout.md` and `templates/issue.md`. Resolve canonical product identity before create/update. GitHub is a configured publication destination requiring access and authorization, not a prerequisite to exploration. Use `references/capabilities.md` when access is uncertain; no invented replacement for an unreadable existing Issue.

Write the product outcome, decisions, applicable journeys/failures, observable acceptance, exclusions, dependencies and genuine risks in the clearest domain-specific structure. Technical decision rationale lives in its ADR/project/Spec owner and is linked, not duplicated. Omit empty headings and unsupported acceptance. Use the resolver's identity and document presentation rules.

Self-check source support, internal consistency, observability, retained scope and recoverability. For an authorized repair, continue the agreed reconciliation through artifact-writing rather than handing the remaining owner commands back to the user. Otherwise report the outcome and offer the next needed preparation: `/pk-to-spec` for a substantial contract, `/pk-to-plan` for a route. Do not start implementation or publish beyond authorization.
