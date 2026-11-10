# Resolve current artifacts

Read this reference when a skill reads or writes an Issue, Plan, Spec or execution Ticket. Apply the same identity and fallback before planning, review, slicing, execution, and closeout, and again on resume.

Before creating or updating an Issue, Spec, Plan or Ticket, also read `references/artifact-writing.md`; an authorized repair after review uses it too. When the boundary references accepted design, `.workflow/context/design.md`, HTML or design assets, or design is accepted or handed off, also read `references/visual-handoff.md`.

## Identity and store

Use the feature slug from the selected Ticket, Plan, or product Issue. Their `feature` values must agree. Do not infer identity from the newest timestamp, a similar title, or a nearby file. A GitHub reference is a locator, not a feature slug.

Artifact Markdown supports two identity encodings during migration:

- current: exactly one hidden first-line comment `<!-- produktiv: {"version":1,"feature":"slug",...} -->` containing one valid JSON object;
- legacy: the existing leading YAML frontmatter with the same semantic keys.

`version` is metadata-encoding version, never feature readiness. Allowed semantic keys are: Issue `feature`; Spec `feature, issue`; Plan `feature` plus applicable `issue, spec`; Ticket `feature, slice, plan` plus applicable `issue, spec`. Status/runtime keys are invalid. This rule does not apply to `SKILL.md`; skill YAML frontmatter is unchanged.

Parse the raw Markdown, not rendered text. Duplicate current comments, malformed JSON, unsupported version, duplicate legacy declarations or disallowed keys are declaration errors, not absence. When both encodings exist, normalize them and accept them as one identity only when the semantic key set and every value agree and neither contains an error. Any conflict stops the affected work. Never fall back by filename after an invalid, duplicate or conflicting declaration.

Search only the configured store for the artifact: `artifacts.issues`, `artifacts.plans` or `artifacts.specs` in `.workflow/config.yaml`, otherwise `docs/plans/` or `docs/specs/`. Exactly one file declaring the requested identity is canonical. More than one is a conflict: name candidates and stop. Do not select the newest.

Only when a file genuinely has no identity declaration may `<store>/<slug>.md` be used as legacy filename fallback. A linked or explicitly named file with the correct identity may be read when the store has no candidate. Never silently adopt a file for another feature.

Product Issues have `feature` and **no `slice`**. Execution Issues/Tickets have both `feature` and `slice`; never select one as the product source merely because the feature matches. For local product Issues, exclude slice-bearing candidates before exactly-one/legacy resolution. For GitHub, use an explicitly named Issue or feature/no-slice matching in the configured repository, reporting duplicates instead of choosing arbitrarily. An explicit execution Issue resolves through its parent/Plan, not as a substitute PRD. If GitHub is unavailable, a single matching local fallback may recover product authority; report that recovery rather than claiming the remote was read. No unreadable linked Issue is replaced by a newly invented Source brief.

Ticket identity is `(feature, slice)` in GitHub or `docs/tickets/`, with the same duplicate guard. Reader/reviewer fallback does not authorize metadata changes.

An unreadable or conflicting Issue cannot be replaced by a new local brief.

## Missing or stale link

A link is a locator, not the authority. Resolve the physical canonical file even when the link is absent or broken. Read a still-existing different linked file as a reference only. The canonical file supplies the contract; do not merge two competing versions.

Report a recovered path and the stale reference. Read-only review does not rewrite the link. An authorized writer repairs it as part of the owning artifact update; execution and closeout can continue from an unambiguous recovered file without editing the parent just to repair metadata.

If a Ticket loses its `plan` link, resolve its Plan by `feature` in the Plan store and validate the Ticket's unit/boundary references against that Plan. Missing or conflicting Plan means `/pk-to-plan`, not a guessed scope. Scope removed or changed by the current Plan requires re-slicing before execution.

## Optional Spec versus missing contract

On the Issue path, always resolve the canonical Spec, even when no artifact links it or it was added after the Plan. A canonical Spec must use the same feature and product Issue. A disagreement on product meaning stays a discovery gap; a route contradicting the current contract goes to `/pk-to-plan` before code.

No Spec, no declared Spec pointer, and no new binding system contract is a valid light path. A broken declared pointer with no recoverable file is missing evidence, not proof that Spec was optional: name `/pk-to-spec` when an Issue exists. Do not execute or mark READY past that gap.

On the no-Issue path, Source brief remains the product source. Do not promote a stray Spec into authority. A required binding contract routes to `/pk-to-spec` preparation, which may first persist the confirmed canonical Issue in the same authorized request; an irrelevant Spec key is a Plan inconsistency for `/pk-to-plan`.

## Refresh and authority

On resume and after an upstream artifact changes, re-read the affected current artifacts and reconcile the slice before editing. Issue owns product behavior; Spec owns the system contract; Plan owns the route; Ticket owns its execution boundary. A later modification date never lets one responsibility override another.

Discovery, Spec, and Plan may be improved after review or approval. An improvement lands in its owner and affected downstream artifacts before the changed code is accepted. Previous review and verification prove only the artifact/code version they examined.

## Visual and project ownership

Feature behavior stays in the Issue, system guarantees in Spec, visual presentation in accepted design, implementation allocation/order in Plan, execution boundary in Ticket. A draft or inspiration supplies evidence, not authority. A material divergence is a proposed delta with reason and impact until explicitly resolved; chronology does not choose between conflicting accepted artifacts.

Missing optional visual context for a change that can reuse established UI is not a requirement to invoke design.

## Reviewer and repair caller

Completion review during implementation uses the single-assessment exception in `references/execution.md`: verified repairs close through targeted tests/inspection, not repeated review.

A reviewer returns hypotheses, evidence and owners while preserving artifacts. Review-only authorization permits no artifact repair. Validate findings against original source, reject false positives and present one concrete grouped repair proposal before requesting any missing authorization. Never infer repair authorization merely from a review request. Ask only for unresolved material decisions or missing action authorization; do not repeat authorization already given.

The grouped proposal names affected sources, dependent artifacts and the return review.

## Changes discovered during implementation or review

Classify by consequence, not file count or the name of the command that found it:

- **Local implementation detail:** behavior, binding contracts, and Plan route remain valid. Change code and affected evidence. No Plan/Spec edit or durable note is required for every private refactoring.
- **Material route change:** units, dependencies, touchpoints, execution boundaries, or a prescribed technical route change. The Plan author or authorized orchestrator updates only affected Plan sections and reconciles Ticket references before execution. Preserve unrelated content and stable unit identities when their responsibilities remain valid. Re-slice a boundary that changed. Apply `/pk-review-plan` responsibility to a material revised route; refresh the evidence it changes.
- **System contract change or defect:** the owning responsibility is `/pk-to-spec`, first persisting confirmed product authority when there is no Issue. Resolve the decision and update affected Spec sections before applying code that depends on the changed contract; then reconcile Plan/Tickets and required evidence. A simplification finding cannot silently waive the existing contract.
- **Product, UX, or domain change:** `/pk-discover` owns it. Do not rewrite acceptance or a Source brief to rationalize implementation.

Reviewers report evidence and owners; they do not edit artifacts. The authorized author/orchestrator performs the owning responsibility in the current session through `policies/decisions.md`; an owner label does not require a new command round-trip. A confirmed safe route correction needs no new user configuration or ceremony; an unresolved material product/contract or irreversible decision pauses the affected work for its owner. Approval is not immunity from a directly evidenced defect.

Keep canonical documents current through targeted edits. When a material change needs explanation, keep a short reason and evidence pointer in the owning artifact; Git preserves the earlier version. A finding, implementation note, or log may describe history or a proposal, but never overrides an unchanged canonical decision. Do not create a parallel decision ledger or rewrite unrelated sections. Closeout must not mark READY while required documents and code disagree.

## Document presentation

Formatting improves navigation but never supplies acceptance evidence or changes machine identity.

Optional nonempty Date, Updated, Related and Superseded by lines may follow the H1 using project conventions. Date is first publication; Updated changes only with a material edit. These body fields do not participate in identity or prove implementation readiness.

Author self-review is not owner acceptance. Keep document acceptance/freshness separate from review verdict and execution progress; none implies the others. Read-only review reports stale state without editing it; do not mass-update historical documents.

Decision status in an ADR (proposed, accepted, superseded) describes that decision, never code completion. A next-action assessment names owner, reason and unmet dependency; a ready-for-agent/human label alone is not proof.

## Progress presentation

Stable Plan/boundary IDs survive targeted changes. Session tracking and resume follow `references/execution.md` only for multi-stage/dependent work, resume or finding repair. An optional host task view is rebuildable from current artifacts/evidence, never a second authority or new progress database. No mandatory `STATUS.md`.
