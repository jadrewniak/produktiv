---
name: pk-to-spec
description: Close binding system guarantees for an agreed scope; resolve its Issue or persist confirmed product scope first within authorized preparation.
---

# Specify the system contract

Use the repository root. Read `policies/kernel.md`, `policies/decisions.md`, `references/artifact-resolution.md`, `references/artifact-writing.md` and `templates/spec.md` through adjacent `produktiv` (source: `workflow/`). Use `references/context-pack.md` and the Context section below for relevant inputs.

## Context

- Must load: Canonical Issue or agreed scope to persist first; relevant baseline; `policies/decisions.md`, `references/artifact-resolution.md`, `references/artifact-writing.md`, `templates/spec.md`
- May load conditionally: Domain/project/ADR/code and accepted design/evidence; bounded support for material uncertainty; Issue template only when source needs creation
- Must not load by default: Whole-repo, Plan/Ticket packs, all policies/reviewers, full graph, Source brief as Spec authority

## Establish scope and authority

A Spec closes a binding, durable, shared, compatibility-relevant or costly-to-reverse contract. A private reversible change usually needs only a Plan. An explicitly requested useful technical specification may document an already settled substantial contract without inventing a new one.

Resolve the existing canonical product Issue in the configured store; a Ticket is not that Issue. When access/store facts are unclear, use `references/capabilities.md` and `references/state-layout.md`. An unreadable Issue is not permission to invent another source.

When no Issue exists and the user requests specification after exploration, persist the confirmed product scope first using the Issue template and resolver, then write the Spec in the same authorized preparation. Do not require another command solely for this step. Missing product decisions use a targeted owner checkpoint; if authority or write permission remains missing, report the gap and do not write a dependent Spec. Publication needs its own authorization; local fallback follows the resolver. A Plan's Source brief alone is not the Spec's durable product source.

Before synthesis, propose multiple feature boundaries if user outcomes, identity, lifecycle, permissions or independent proof differ. Shared infrastructure is a dependency, not a reason to merge unrelated contracts. Agree the split and preserve existing identities/all accepted scope under the split procedure in `references/artifact-writing.md`.

Read relevant current code, domain/project context, ADRs and accepted design/evidence pointers. Stop when the baseline and necessary boundaries are established; no whole-repo, Plan or ticket pack by default.

## Close decisions at the point of need

Revisit relevant open decisions before dependent guarantees. Discuss due technical and product choices under decisions policy, regardless of stage, and record actual owner choice/delegation. A confirmed product change updates its Issue first; architecture rationale may receive a selective ADR. Calling a restriction or privacy choice a Spec decision does not make it an authorized technical representation.

A non-material technical representation within the agreed behavior can be a Spec decision: state the rationale. Distinguish current repository fact from the target requirement; existing implementation does not itself mandate preservation.

For a real technical uncertainty, use bounded research/prototype/diagram through `references/policy-triggers.md`, following the selected skill. A current external fact uses `policies/source-verification.md`; unverified required facts stay a gap, not a binding source. Helpers cannot choose for the owner.

## Write an executable contract, not a checklist

Organize by actual domain/system responsibility. Close applicable:
- entities, relationships, invariants and state transitions;
- each operation's inputs, required metadata and concrete bounds, outputs, invalid cases and caller-observable errors;
- interfaces, ownership and dependency direction;
- storage, compatibility, trust boundaries and integrations;
- technical UI states, with exact accepted visual references when relevant.

Use examples to expose overlapping states, such as partial payment after a due date. Configuration names its owner, scope and resolution mechanism; “appropriate limit/format” is not a contract. Cross-system promises need feasible semantics: revocation vs active downloads, transactions vs object storage, retries vs duplicates, restore vs changed relations. Define compensation/recovery where relevant rather than leaving it to the Plan.

Close idempotency when repeated delivery or concurrency makes it material; do not require it for every state change. Preserve every required inverse, recovery and non-interference direction. A deferral is safe only when this contract does not depend on it.

Give each coherent rule group a resolvable Issue section, ADR, verified external source or explicit Spec-decision rationale; put exceptional provenance beside the rule. An explanatory note is not a requirement. Link product stories rather than duplicating them. Compact types/state examples are welcome when clearer than prose. Name files/functions only when their identity is itself a shared/public contract; implementation allocation, commands and order belong to Plan.

## Check and finish

Ask: could two materially different behaviors satisfy this wording? If so, close the ambiguity or name its owner. Ensure relevant surfaces are complete and consistent, guarantees feasible, names/bounds concrete, non-goals authority-backed and sources recoverable. No required surface may disappear behind an empty heading, placeholder or deferral. Perform this self-check inline, not as an extra reviewer ceremony.

Only write a Spec whose required surfaces are closed. Agreed knowledge may already have been saved even if a dependent Spec remains blocked; report that distinction. Use identity rules in artifact-resolution and header and targeted-update rules in artifact-writing, with one canonical local Spec per agreed feature. Do not mass-migrate artifacts or create a status ledger.

Report sources, written paths and unresolved conditions. When asking the owner to accept a Spec, name every guarantee that destroys or overwrites user data; acceptance does not cover what the summary left out. In an authorized cross-document repair, return to the caller for dependent updates under artifact-writing. Otherwise offer `/pk-to-plan` when the contract is closed; if not, name the responsible decision/check, not an executable route. Specification alone does not authorize planning or implementation.
