---
name: pk-simplicity-review
description: Review implemented code for accidental complexity, using relevant Plan/Spec as context. Apply verified refactorings when requested; route contract conflicts to their owner.
---

# Review and optionally simplify a bounded change

For review reports, read `references/review-presentation.md` through the same package. Pass it and the user's language/depth/detail to attached reviewers; apply it to their replies and the caller's summary without changing rubric criteria.

Use the repository root. Read `policies/kernel.md`, `references/capabilities.md`, `references/context-pack.md`, and `references/artifact-resolution.md` through the adjacent `produktiv` link, or `workflow/` in a source checkout.

The primary target is implemented code. Plan and Spec supply context and preservation boundaries, not a second review target. The reviewer is read-only; the orchestrator may apply verified changes when requested. Faithful implementation of a Plan does not justify needless code structure. This command does not design a replacement contract, decide readiness, or publish.

## Context

- Must load: Implemented code/diff, preservation requirements, governing contract slices and actual seam; `references/capabilities.md`, `references/artifact-resolution.md`, `references/review-presentation.md`, `agents/simplicity-review/v4.md`
- May load conditionally: Relevant product/ADR/design; decisions/execution for authorized material repair; verification and quality before code edits; cost settings before widening; `references/artifact-writing.md` for an authorized artifact repair; `references/visual-handoff.md` for a UI simplification
- Must not load by default: Graph, other reviewer rubrics, whole repo, all policies, raw session history, scorecard, preferred cut in reviewer payload

## Scope and context

Pin the user's diff, commit range, named source files, or implemented Ticket/Plan slice. An artifact may locate the implemented files; it does not make unimplemented work this command's target. A request to review only a pre-code Plan belongs to `/pk-review-plan`; a Spec-only contract question belongs to `/pk-to-spec`. Invalid refs stop with the missing ref. An empty diff permits review of explicitly named existing code, not a whole-repository audit.

Read that code first, then the relevant current Plan and canonical Spec sections when they govern it, using `references/artifact-resolution.md`. Read only product-source lines and ADR/external commitments needed to establish preservation. For a Ticket read its assigned units and boundary. Source brief is product authority only on the no-Issue path. Standalone code review does not require creating Plan/Spec. Missing evidence limits the recommendation; it does not license invented behavior.

Judge the implemented concepts even when the Plan prescribed them. Open a nearby file only for a concrete deletion, reuse, file-organization, or preservation hypothesis. Approval, self-review, and executor reasoning are not evidence. A visible upstream defect is a finding with an owner, not permission for a full Plan/Spec audit.

Do not load the whole repository, all policies, other reviewer rubrics for the simplicity pass, raw session history, or a scorecard. The graph is not needed for this review. A visible defect outside the surface is reported with evidence and its owner; it does not start a broad audit.

## Review

Apply `agents/simplicity-review/v4.md` as the fixed criteria. Prefer one fresh reviewer when delegation is available and authorized. Otherwise apply the same file here and disclose weaker independence. Pass only the code target, relevant diff, governing Plan/Spec sections, preservation sources, and nearby evidence actually read. Do not pass a preferred cut or rewrite the criteria.

Read project `cost.profile` and local `cost_override` before widening context. `lean`, `balanced`, and `high-assurance` change optional lookup cost, not the preservation standard. A narrowly scoped source read needed to prove equivalence cannot be skipped and replaced by a claim. No profile authorizes a whole-repository audit without the user requesting it.

The reviewer separates code opportunities, uncertainty, and directly evidenced defects or contract conflicts. Name the owner using `references/artifact-resolution.md`. Keep a conflict between a proposed cut and a binding Spec separate from a code refactoring whose equivalence is established. Do not assume the Spec is wrong because the cut is smaller.

## Applying requested changes

Without an explicit request to apply changes, report and stop. With that request, verify each finding against current sources before editing. Prefer a cut that removes concepts over relocating them.

Classify a verified cut using the artifact-change rules in `references/artifact-resolution.md`:

- A local refactoring preserving the contract and Plan route changes code and affected evidence only.
- A material route change is reconciled in the affected Plan section by the orchestrator in the Plan-author role, with affected Ticket references, before applying the cut. Preserve unrelated sections and stable unit identities. Return a material revised route to the caller for `/pk-review-plan` responsibility before execution, using that role's current criteria; that reviewer does not edit. An unresolved finding blocks only the affected cut.
- A binding contract or product conflict returns the affected cut to `/pk-to-spec` or `/pk-discover`. Do not apply it or rewrite Spec to justify it here. The caller can continue after the owning decision, current artifacts, and downstream route have been reconciled. Continue independent safe work.

Record a material change's reason and evidence pointer in its owning artifact when useful. Implementation notes are history, not overrides of canonical decisions. Do not update documents for every private implementation detail.

A necessary, directly evidenced defect outside the pinned surface may receive a narrow repair under the user’s request to apply fixes only when the same preservation conditions hold. Name the extra path and the reason. An optional out-of-scope improvement is reported, not applied. A change in product behavior, compatibility promises, security policy, or an irreversible decision requires the unresolved decision from its owner before the affected edit. Continue independent safe work.

Read `policies/verification.md` and the matching quality command source before code edits. Run only the evidence affected by the change, including material inverse/recovery behavior. Apply the same reviewer criteria again to changed concepts; a correctness uncertainty must be resolved before claiming a successful repair. Do not silently remove tests or weaken checks.

Preserve the relevant accepted visual behavior/views/states when judging a UI simplification. Select only necessary design refs. A visual or contract collision is reported with evidence and its owner; smaller code is not authorization to replace the product or accepted design.

## Result

Report the pinned target, review independence, verified opportunities, changes actually applied and their artifact owners, verification results, and remaining uncertainty. No score, quota, or ship verdict. Readiness remains `/pk-closeout`.

Do not create a review archive, status field, or debt ledger. Do not commit, push, merge, deploy, or start another public command just because this review finished. An explicit delivery goal remains the caller’s goal; this review does not cancel it.
