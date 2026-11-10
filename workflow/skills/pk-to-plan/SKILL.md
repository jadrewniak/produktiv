---
name: pk-to-plan
description: Map an existing Issue, or a decided small request, onto a concrete implementation route with sufficient evidence and producer ownership.
---

# Plan a route a fresh executor can follow

Use the repository root. Read `policies/kernel.md`, `references/artifact-resolution.md`, `references/artifact-writing.md`, `policies/verification.md` and `templates/plan.md` through adjacent `produktiv` (source: `workflow/`). Consult `references/context-pack.md` and the Context section below for relevant inputs.

## Context

- Must load: Product source, canonical Spec on Issue path, selected source/diff and quality command authority; `templates/plan.md`, `references/artifact-resolution.md`, `references/artifact-writing.md`, `policies/verification.md`
- May load conditionally: Relevant project/domain/ADR/design; decisions for material gap/capture; capabilities/state-layout only for unresolved facts; bounded support under policy-triggers; graph-use for unresolved structure; `references/visual-handoff.md` for units with accepted design
- Must not load by default: All artifacts/policies, reviewer rubrics for ordinary inline self-review, whole graph, stale Plan links as canonical identity

## Resolve the destination

Use the canonical product Issue when one exists; never bypass it with a Source brief. Search the configured store and apply physical-file recovery/duplicate guards. An inaccessible GitHub store is not proof of absence. Resolve the canonical Spec on the Issue path even with a missing/broken link.

Without an Issue, a decided local request can use a frozen Source brief containing only requested behavior, observable acceptance and stated non-goals. Invocation limits such as “plan only” are not product non-goals. Freeze the brief only when writing a Plan; do not invent acceptance or expand it later. Repository-documented rules the request depends on and same-cause paths found while inspecting the seam belong to the requested behavior; they are not invented acceptance.

Determine whether a new binding durable/shared/compatibility/costly system contract is required before shaping units. Private reversible details do not need a Spec. If a required Spec is missing or incomplete, do not encode that contract in the route. Use decisions policy to resolve a bounded choice and authorized owner repair; a substantial missing contract requires `/pk-to-spec` preparation, which may first persist the agreed Issue. Do not force a discovery interview solely because no Issue file exists.

Before allocating dependent units, check relevant open decisions in project context and source artifacts. Use `policies/decisions.md` to close due choices with the owner or apply evidenced delegation, and update their source within authorization. A source assigning a choice to Plan is not owner consent. If it cannot be closed, report the affected gap instead of an executable Plan. A material change to Source brief becomes an Issue, not an edited fallback.

## Inspect the real seam

Read config stores, quality context, relevant project/domain/ADR/design pointers, selected source/tests and their uncommitted diff. Confirm existing paths/symbols; mark intentionally new paths as new and justify their ownership from repo conventions. A graph fact does not override dirty source. Use capabilities/state-layout references only for unresolved environment/store facts.

For a defect, the requested behavior is the broken rule, not only the reported example. Trace the cause, then look for other paths with the same cause or governed by the same documented rule. Cover each such path in a unit, or name it as an owner-visible exclusion with its reason; never mark it unchanged without saying that it stays broken. When same cause is unconfirmed or the fix would change decided behavior, use decisions policy. Report unrelated defects without adding them to the route.

Use bounded research, a visual helper or diagram only for a material route uncertainty under `references/policy-triggers.md`; current external facts follow source-verification policy. Use `references/graph-use.md` only when a structural question remains. Do not load every policy, artifact or the whole graph.

## Allocate the work

Explain current state, authority-derived target and concrete delta. A unit is a coherent verifiable result, not a file-count quota or checklist step. Preserve stable IDs for unchanged responsibilities. For each unit name:
- product/Spec/Source brief requirement references;
- verified or intentionally new touchpoints and concrete changes;
- real dependencies, consumed/produced contracts when shared;
- sufficient evidence and expected contract-exact observables.

For complex work settle material state, IO, domain, UI, migration and configuration ownership. Describe caller → application boundary → authorization/domain → write → read → UI wiring, including exports, config and test discovery. Ordered internal steps, signatures or pseudocode belong only where they prevent material rediscovery. Local private choices remain with the executor.

Link precise accepted design views/anchors/states/assets. Apply the accepted visual handoff checks in `references/visual-handoff.md` to required visual dependencies before marking their units ready, including dynamic-state entry paths and shared dependencies. Do not promote a draft or unresolved visual delta to required implementation.

Assign producers for new runtime/dependency definitions, service startup, non-secret fixture configuration, fixture-only reset and evidence capture. Planned commands are not confirmed invocations or PASS; consumers wait for their actual definition and prerequisites. Do not substitute a demo for unavailable required infrastructure.

A separately executable sub-boundary must already have a stable ID, result, inputs/dependencies and proof. Ordinary Steps do not become Tickets/commits/sessions. Prefer independent ready outcomes when possible; dependent chains stay explicit. One small change can remain one short unit.

## Verify the route

Use verification policy for command provenance and boundary strength. Quality context or the actual manifest/task runner/build/CI defines commands; a lockfile does not. New check definitions name their producer, defining file, invocation, prerequisites and observable. Plan evidence, never claim it ran.

Compare shared names/shapes/errors, lifecycle, write/read/migration, UI ownership and the integration between units. Change and Verification must prove the same behavior. Required preservation covers every non-interference direction; inverse/retry/recovery proof is distinct from forward success.

Include risk/rollback only when data, compatibility, security, irreversible side effects, high fan-out or operational cutover warrant it. Protect real user data; fixture reset is not production rollback. A coherent module split follows responsibility and coupling, not a universal size limit.

Self-review authority, per-unit readiness and cross-unit consistency. Ask what material decision a cold executor would still need to design. Check that the route does not leave a known same-cause path silently broken. Repair within authority or resolve with the owner; an unresolved required gap means no implementation-ready Plan. Coverage records requirement → unit → consequence → sufficient evidence, not runtime status.

## Persist and hand off

Use the Plan template as a starting shape, resolver identity/header rules and targeted updates. Keep stable units; no duplicate route, ticket list, session log or mandatory heading taxonomy.

Report the Plan and product source. Recommend implement for an ordinary executable route; a new complex auth/persistence/storage foundation requires `/pk-review-plan` before code, separately from owner consent. Recommend `/pk-decompose` only when useful established boundaries enable tracking/handoff or predictable execution; preserve direct whole-Plan choice. Do not start those commands or grant Git permissions.
