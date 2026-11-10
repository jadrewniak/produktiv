---
name: pk-closeout
description: Check whole-feature completeness and integration, reuse current evidence, and report readiness before Issue closure and merge.
---

# Close out one whole feature

For review reports, read `references/review-presentation.md` through the same package. Pass it and the user's language/depth/detail to attached reviewers; apply it to their replies and the caller's summary without changing rubric criteria.

Read the package's `policies/kernel.md`, `policies/verification.md`, `references/context-pack.md`, `references/capabilities.md`, `references/state-layout.md` and `references/artifact-resolution.md`, and `references/visual-handoff.md` for user-facing acceptance. Installed resources are under the adjacent `produktiv` link; source resources are under `workflow/`.

This is the final confidence gate for the **whole feature**, not another code review or implementation pass. A Ticket/unit target locates its parent feature; it never narrows the verdict to that slice. Run even when implementation is unfinished: an early check normally returns **NOT READY** with actionable blockers. Do not require finished tickets, commits or a clean tree merely to begin.

## Context

- Must load: Whole feature product source/contract/Plan and assigned Tickets when present; current source/diff, all slice evidence and quality; `policies/verification.md`, `references/capabilities.md`, `references/state-layout.md`, `references/artifact-resolution.md`, `references/visual-handoff.md`, `references/review-presentation.md`
- May load conditionally: Integration/runtime evidence gaps; matched specialist via policy-triggers/cost; graph-use for unresolved coverage question; `references/artifact-writing.md` to record an authorized limitation
- Must not load by default: Executor narration, whole-repo packs, standalone review rubrics, all policies/specialists, assumed reruns, unrelated feature evidence, full graph

## Resolve and inspect

Use the named feature, Issue, Plan or Ticket and canonical identity rules. Without an explicit target, exactly one applicable Plan may identify it; multiple features require one clarification. Read `.workflow/config.yaml` for artifact stores, verification, cost and Git policy. Resolve current Plan and product Issue, or the Plan's Source brief on the light path; resolve canonical Spec even without a working link on the Issue path. Read all Plan units, relevant contract/acceptance sections, and execution tickets for that feature. A named Ticket is only an entry point. No tickets is valid.

Read relevant source/diff, current branch/HEAD and staged, unstaged and untracked feature paths. When `gate` is available, `gate.mjs trailers --feature <slug>` maps units and Tickets to commits. It locates implementation and proves nothing: a unit without a commit is a question for the diff, not a gap. A conflict or a unit or Ticket the Plan lacks is a consistency finding; a reverted commit's claim no longer counts. Read quality command definitions and governing documentation/ADRs through actual artifact, code or project-context pointers. Expand only for a concrete coverage or integration question. Do not load executor narration, whole-repo packs, review rubrics or every policy.

A missing Plan, unrecovered declared contract, unreadable product source, or authority conflict is a readiness blocker, not refusal to run. State what can be established, what cannot, and its owner. Do not invent acceptance, switch from a linked Issue to Source brief, or declare READY from partial authority. Product questions route to `/pk-discover`; missing Plan/route to `/pk-to-plan`; missing system contract to `/pk-to-spec` when an Issue exists, otherwise `/pk-discover`.

## Coverage before more tests

Map every material product acceptance, system contract and Plan outcome to implementation and evidence, including integration across units/Tickets. Classify each as covered, deferred, blocked or gap. A unit is a route, not new product scope. Deferral is valid only when the owning artifact already accepts the limitation and its impact/owner or revisit trigger. A completed Ticket marker is not proof of behavior.

Inspect repository sanity: intended scope, generated/debug leftovers, placeholders, weakened tests/suppressions and relevant documentation consistency. Report defects; do not fix source, implement missing work, or initiate code/simplicity reviews. Consume already supplied review findings only after checking their material claims against current code. An open verified BLOCKER/IMPORTANT prevents readiness; optional simplicity advice does not.

## Reuse and fill evidence gaps

Apply `policies/verification.md`. A reusable proof binds the command/flow, actual result and covered code/config/dependency bytes to the current requirement. Include imported producers/consumers, wiring, test configuration and dependency/lockfile changes that can affect the result, not only paths listed by the Plan. Same-session unchanged relevant files or matching revision/scoped digests can establish freshness. An unbound historical PASS cannot. Acceptance changes require reassessing whether the proof still covers the claim.

When `gate` is available, the package's `adapters/host/gate.mjs status` shows whether quality rows have a receipt for the current working tree and command. Such a row is **reused**; any other receipt is stale. Fill a missing floor with `gate.mjs run`, not by hand.

Cite still-current focused and runtime evidence once, marked **reused**; do not rerun identical checks. Never recreate slice evidence in a ledger. Mark stale, absent or unavailable proof honestly; cite fresh checks as **run now** with PASS, FAIL, UNAVAILABLE or BLOCKED.

Choose the cheapest missing proof:

1. An implemented behavior lacking required evidence needs focused verification; missing behavior goes to `/pk-implement`, not testing placeholders.
2. Working units with an unproved producer/consumer seam, combined journey, lifecycle or migration may receive one proportional integration check here.
3. A broader existing CI/test suite runs only when an integration gap remains and `verification.full_suite: closeout`. An already reused identical suite is sufficient.
4. A browser/runtime check runs for a remaining critical journey, runtime-only/visual acceptance, cross-ticket wiring, or explicit request. Reuse `/pk-implement` proof of the same flow when current. A unit test does not establish actual UI wiring when that is the claim. An isolated pure behavior already proved does not need browser use.
5. A specialist, bounded E2E check or bug bash requires a named remaining risk after cheaper evidence. Load `references/policy-triggers.md` and `policies/cost.md` only for such spend or a broader suite, then only the matching specialist file. Prefer an isolated specialist; absent capability/prompt means a disclosed skip or text assessment, never a fabricated pass.

Read cost profile/local override only when additional spend is considered. Lean keeps required evidence; high-assurance lowers the threshold for a justified extra check, not every track. Stop spending when confidence is sufficient or a known blocker makes the next check uninformative. Still report other cheaply established blockers; do not hide incomplete work behind the first failure.

If a needed tool/environment is unavailable, give the smallest runnable command/manual checklist, mark evidence UNAVAILABLE, and keep the required claim blocked until adequate evidence exists. User-supplied proof is identified as such. Do not loop tests or install a framework to close a gap.

For one unresolved structural coverage question, conditionally read `references/graph-use.md` and query scoped `impact_of_diff`. No graph falls back to source/diff; it does not stop this command.

For user-facing acceptance apply `references/visual-handoff.md`: recover the relevant accepted design views/states and durable required assets, compare implemented behavior against those refs, and assess current actual interaction/visual proof. A green logic suite plus missing/broken UI is NOT READY. A stale native todo/checklist is neither coverage nor evidence; choose the canonical execution proof, never a second completion authority. A missing visual decision belongs to /pk-design or /pk-discover as appropriate; missing behavior goes to /pk-implement. Proportional integration verification here may fill a proof gap, never implement a missing slice.

## Verdict and boundaries

- **READY:** every material requirement is covered by current passing evidence; integration, governing docs and repo state agree; no verified blocker remains.
- **READY WITH KNOWN LIMITATIONS:** the same, except explicitly accepted limitations that waive no required behavior or safety. Record an authorized limitation in its existing Issue/Spec/Plan/ADR owner, never a parallel debt file.
- **NOT READY:** material implementation, coverage, integration, evidence, authority, documentation or repository blockers remain. This is the expected useful result of early invocation.

Self-check that the verdict covers the entire feature and that every claimed proof actually exists. Report feature/revision, compact whole-feature coverage, reused/run-now evidence, skipped checks and exact remaining blockers with owners:

- missing Plan unit/Ticket implementation → `/pk-implement`;
- implemented behavior without proof → the named verification, or `/pk-implement` for its missing slice proof;
- missing integration proof → a proportional `/pk-closeout` check;
- observed bug needing diagnosis → `/pk-debug`;
- missing route → `/pk-to-plan`;
- missing system contract → `/pk-to-spec` on the Issue path;
- missing product decision → `/pk-discover`.

Recommend one next action for the earliest blocking responsibility; do not automatically launch another command. A failed planned verification can return to `/pk-implement`; an unexplained failure goes to `/pk-debug`.

Only after READY (or accepted, documented limitations), close the **parent product Issue** when the user requested closure or the established project policy authorizes it and the correct issue-store capability exists. Do not close execution Issues as substitutes. A readiness-only request does not authorize external closure. Report actual closure or its pending/unavailable state; local Markdown remains the canonical document, without invented status frontmatter or a new tracker.

Recommend merge for ready work; never perform merge, push, deploy, release, tags or changelog publication. Do not commit or open a PR as a side effect of this gate. `/ship` is post-v1 release/deployment work and is not delivered by this command. READY describes readiness, not an action that did not occur.
