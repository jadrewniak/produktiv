<!-- produktiv: {"version":1,"feature":"<kebab-case-feature>"} -->

<!-- Add `issue` and `spec` to the same JSON object only when they apply. One H1. Organize the route for comprehension: stable unit H3s remain required, while H4/H5 maps/steps/integration/proof, tables, examples and snippets are allowed. Labels below are prompts for required content, not a fixed order. Delete comments, unused labels and empty sections. -->

# <!-- Feature name -->

<!-- Show date/freshness and readable document state under artifact-writing's presentation rules; acceptance needs owner provenance and is not execution status. Related / Superseded by only when useful. Keep these separate from identity and execution evidence. Lead with the intended result and context; adapt headings to the actual route. -->

<!-- No TBD, no unresolved placeholder, and no product or system-contract decision the authority does not already contain. The authority is the Issue when `issue` is set, otherwise the frozen Source brief. Do not promote an inference or a Note into a requirement. Delete this comment. -->

## Goal

<!-- The route in one or two sentences. Point at the authority: the Issue when one exists, otherwise Source brief. No new product or system-contract decision. -->

## Source brief

<!-- Only on the no-Issue path, and only when this Plan is written. Frozen: quote or tightly restate what the user already said. Observable acceptance may be the same sentence as requested behavior when that sentence is already observable. Remove the non-goals bullet when the user stated none. Do not add an outcome, an edge, or a non-goal they did not state. Invocation restrictions such as “plan only, do not implement now” are not product non-goals. Remove this whole heading when `issue` is set. -->

- **Requested behavior:** <!-- user's requested behavior -->
- **Observable acceptance:** <!-- only what the user already made observable -->
- **Relevant non-goals:** <!-- only non-goals the user already stated -->

## Current state

<!-- Verified paths/symbols/behavior and source facts that change this route, including current uncommitted relevant deltas. Confirm baseline before execution; a changed file map requires a scoped refresh. -->

## Target

<!-- Implementation target derived from the authority. Map the Issue, the Spec, or the Source brief. Do not add a behavior, edge, failure, bound, or guarantee the authority does not state. This is not a second behavior contract. -->

## Route and readiness

<!-- Optional when material: allocation/rationale; responsibility map for state, IO, domain, UI, migration and config (existing modify vs intentional create); caller→application boundary→authorization/domain→write→read→UI wiring; environment producers; dependency frontier; stage conditions. Apply project rules, no universal file/line budget. Accepted design refs point to exact views/anchors/states/assets. No second specification. -->

## Units

<!-- One H3 per coherent, verifiable part of the route. A unit may be a seam, a vertical capability, or a migration phase, and it may name several touchpoints. Use the fields below as readiness content, not a fixed label order. A complex unit may have file/responsibility maps, ordered Steps, Integration and Verification subsections; a short unit needs no added ceremony. Preserve stable unit and established boundary IDs. A goal sentence is not a unit. -->

### U1 — <!-- Unit name -->

**Requirements**

<!-- Issue, Spec, or Source brief lines this unit implements. When `issue` is set, cite that Issue or the Spec, not a Source brief. References only. No new acceptance. No inference and no Note. -->

**Change**

<!-- The delta at the verified seams: create, modify, migrate, delete, or verify. A non-trivial unit names each integration seam the files confirmed: the caller, the boundary, or the neighboring behavior the change must meet. A unit is non-trivial when the change is more than an edit inside one symbol the file has already confirmed. Paths, symbols, signatures, or a short snippet only when they carry reasoning a fresh executor would otherwise redo. Mark a new path as new. No TBD and no placeholder. -->

#### Steps

<!-- Optional ordered internal actions for a complex unit, grouped by responsibility. Include caller/boundary/write/read/UI, exports/config/test discovery where material. These steps are not standalone Tickets or /pk-implement targets. An established executable sub-boundary needs its own stable ID, result, inputs/dependencies and sufficient proof in this Plan. Omit hierarchy for a tiny unit. -->

**Depends on**

<!-- Real blockers, or none. -->

**Consumes / produces**

<!-- Remove this label unless another unit consumes a name, signature, or shape this unit produces. -->

**Verification**

<!-- Planned coverage, never an executed PASS. Behavior proved, seam, cheapest sufficient evidence, and what that evidence must show. Name the command's provenance: the quality.md row, or the confirmed manifest, task runner, build config, or CI definition. A lockfile does not define the command. Do not guess an existing command. For a genuinely new check, explicitly mark Planned definition with producer unit, intended manifest/script/config, prerequisite and expected observable; consumer depends on producer confirmation before running. No planned check or coverage row is PASS. The observable matches Change and the authority, and is not tightened. A non-interference, inverse, or recovery requirement names every material direction. The check is not a new acceptance criterion. -->

## Order

<!-- Real blockers only. Remove this heading when no unit depends on another. -->

## Verification

<!-- Remove this heading when each unit already names its evidence and there is no cross-unit checkpoint. A checkpoint command has the same provenance rule. -->

## Risks

<!-- Rollback/compatibility only when triggered; protect real data, never reset/delete user data as an assumed recovery. Omit otherwise. -->

## Coverage

| Requirement | Unit | Consequence | Evidence | Coverage |
|---|---|---|---|---|
| <!-- Issue acceptance, Spec contract, or Source brief line. --> | <!-- U1 --> | <!-- authority outcome --> | <!-- check/seam and provenance --> | <!-- covered or existing authorized deferral --> |

## Self-review

<!-- Name Authority, Per-unit readiness, and Cross-unit consistency. Ask what material structure/integration/behavior/proof a fresh executor would still have to design. Labels are insufficient. Each gate is pass only after that check. Implementation-ready follows those passes. Planned verification definitions are still planned, not actual results. A gap is not written here. The command stops and reports the gap and its owner instead of writing the Plan. -->
