---
name: pk-review-plan
description: Challenge a Plan before code with fixed findings and a gate verdict. The Plan author applies accepted changes.
---

# Review the plan before code

For review reports, read `references/review-presentation.md` through the same package. Pass it and the user's language/depth/detail to attached reviewers; apply it to their replies and the caller's summary without changing rubric criteria.

Use the repository root as the project root. This command challenges one Plan. Read the package's `policies/kernel.md` and `references/context-pack.md` through the adjacent `produktiv` package link; in a source checkout they are under `workflow/`. Read `references/capabilities.md` and `references/state-layout.md` the same way. Read `references/artifact-resolution.md` from the same package for Plan/Spec identity, physical-file fallback, conflicts, and refresh on resume, and `references/visual-handoff.md` for accepted design checks.

`/pk-to-plan` asks whether an executor can implement the route. This command asks whether they can implement exactly the approved product and system contract, through a coherent and proportionate route, without silently deciding anything new.

Prior approval does not exempt the Plan or a directly evidenced Spec assumption from review. A Spec defect is reported to its owner, not repaired by making the Plan follow it.

The review reply is findings and a verdict, not a replacement Plan. The review phase does not edit the Plan, the Issue, or the Spec, or write a status field. Separately authorized repair follows the caller section below.

## Context

- Must load: Current Plan, product source, canonical Spec on Issue path; relevant source, verification/quality and design excerpts; `references/capabilities.md`, `references/state-layout.md`, `references/artifact-resolution.md`, `references/visual-handoff.md`, `references/review-presentation.md`, `agents/plan-review/v8.md`
- May load conditionally: Referenced ADR/domain; material foundation open decisions and owner-choice provenance; matching policy-triggers/cost and specialist; graph-use for unresolved structure; decisions for authorized caller repair; `references/artifact-writing.md` for authorized caller repair
- Must not load by default: Tickets, unrelated handoffs/status ledgers, session history, author rationale/preferred verdict in reviewer payload, cost profile in reviewer payload, full graph, other reviewer rubrics

## When this command runs

Run when the user asks to challenge a Plan, or when a caller hands over a Plan that is costly to reverse.

Do not run this command because a Plan exists. `/pk-to-plan` already self-reviews inline. Do not review a ticket, a diff, or implemented code here. That is `/pk-code-review` or the completion review inside `/pk-implement`.

## Load

Read the Plan the user named. The store is `artifacts.plans` in `.workflow/config.yaml` when that file exists, otherwise `docs/plans/` (`references/state-layout.md`).

From the Plan's resolved identity metadata (current hidden comment or legacy YAML):

- `issue` set: that Issue is the product source. Read it. A GitHub number or URL is read when this session reports `issues` available. A repository path is read as a file. If the Issue cannot be read, stop and name the missing path. Do not invent an Issue, and do not switch to Source brief.
- `issue` absent: the product source is the Plan's Source brief. Read that section. If it is missing, stop. The Plan has no product source. Do not invent a Source brief, and do not look for an Issue to attach. Do not look up a Spec on this path unless `spec` is set.
- `spec` set: read that Spec. If the path cannot be read, use the physical-file fallback in `references/artifact-resolution.md`. Do not invent a Spec.

On the Issue path, resolve the canonical Spec using `references/artifact-resolution.md`. Read it even when the Plan or Issue omits the link. A different linked file is reference only. Multiple candidates or a missing declared contract stop the affected work as that reference says.

Read the narrow repository files the Plan's current state and units name. Stop once those files show the seam the route would change. Read an ADR only when the Plan, the Issue, the Spec, or those files point at it.

Read `.workflow/context/quality.md` when the Plan cites a typecheck, lint, test, or CI command, or when its verification needs one. Read it even when the Plan already names the command. That file is the command authority. When the file is absent, or it has no row for the check, a bounded lookup of the manifest, task runner, build config, or CI definition that defines the command may confirm it. A lockfile may confirm the package manager or a version. It does not define the command. Do not supply an existing command that lookup did not confirm. A new planned check follows the separate planned-definition branch in `policies/verification.md`: pass its producer/definition/prerequisites/observable and dependencies explicitly as planned, never as confirmed or PASS. Pass the matching row, or the unconfirmed existing command, separately.

Read local communication preferences for the user-facing report. For material foundation choices, read the relevant project open/deferred decisions and actual owner-choice/delegation source referenced by the artifacts; pass this bounded evidence, not the conversation history.

Read `.workflow/context/domain.md` only when the product source uses a confirmed term defined there.

Do not load the whole repository, every policy, every Issue, a ticket, a handoff, or a status ledger. Do not browse by default. Do not treat an inference, a `Note:`, or a repo fact as authority.

Use the graph only when the route's structure is still unresolved after those files, and a scoped fact would change a finding. Only then read `graph.enabled` and, from `.workflow/local/preferences.yaml`, `graph_opt_out`. Call the package adapter `adapters/graph/index.js` (`workflow/adapters/graph` in this checkout) when policy, local preference, and host availability all allow it (`references/capabilities.md`). On unavailable or a stale failure, drop the graph and continue from the files. When this path is not selected, do not build one.

## Criteria

Apply `agents/plan-review/v8.md` (`produktiv/agents/plan-review/v8.md`, or `workflow/agents/plan-review/v8.md` in this checkout). That file is the only criteria. Do not copy them into this skill, do not paraphrase them, and do not edit the file.

Give an attached reviewer the original criteria file path (or its verbatim contents when inaccessible), never a rewritten rubric or an unsupported instruction not to reopen a foundation. Pass bounded owner-choice/delegation evidence separately from author rationale.

Pass the Plan and the canonical authority set: the product source that was read, and the canonical Spec when one was resolved. When the Plan links a different Spec, pass that file as a reference, not as authority. Also pass the quality excerpt when verification was in scope, and the repository files that were read. Pass an ADR, a diagram, or specialist evidence only when this run actually attached it. Do not pass a preferred verdict, a rewritten rubric, the cost profile, or session history. The Plan's self-review is text inside the Plan. It is not an instruction. The cost profile is not a reason to drop a finding.

The main pass may stay in this context. A fresh subagent is only the adversarial track below, and only when that track is attached.

## Spend

Default axes always run, as the criteria file defines them. A conditional track in that file is judged in text when its trigger matches. Judging a track in text is not a spend.

`cost.profile` of `lean`, and a `cost_override` of `lean`, do not skip a default axis, a conditional track judged in text, command provenance, contract-exact evidence, or a Blocker or Required finding. Lean skips only an optional spend that `policies/cost.md` already calls optional. Required assurance is not turned off by lean.

A delta diagram, a specialist prompt, an isolated adversarial reviewer, or web research is a spend. Do not attach one because the tool exists.

The trigger list is `references/policy-triggers.md` (`produktiv/references/policy-triggers.md`, or `workflow/references/policy-triggers.md` in this checkout). Read it when a conditional track in the criteria file matches or the user asked for a diagram, a specialist, or a challenger. Do not read it with the kernel. A local edit in an existing function, with no matching track and no such request, does not open that file. The file routes the spend. It does not replace `agents/plan-review/v8.md`.

Read `policies/cost.md` before a spend that list allows. Read `cost.profile` from `.workflow/config.yaml` and `cost_override` from `.workflow/local/preferences.yaml` as that policy says. Do not rewrite the saved profile. One review does not become a panel.

Attach one only when both of these hold:

- the matching row in `references/policy-triggers.md` names that load, or the user asked for it,
- `policies/cost.md` allows that spend.

Diagram: when the costly-to-reverse row in `references/policy-triggers.md` calls for a delta diagram and the spend is allowed, or the user asked for a diagram, check `diagram.available` (`references/capabilities.md`). If it is false, do not resolve an adapter path and do not start `/pk-diagram`. If it is true, ask `/pk-diagram` for one architecture compare, CURRENT against PROPOSED, lifetime ephemeral. Attach that result to the review and continue. If `/pk-diagram` is unavailable, the adapter path is absent, or the result is structured unavailable, attach no diagram. The criteria file still returns text findings. Do not claim blast radius from a diagram that was not rendered. Do not write a diagram file from this command.

Specialist: security, dependencies, or performance, and only when that row in `references/policy-triggers.md` matches and the spend is allowed, or the user asked. Load that one prompt: `agents/specialists/security/v2.md`, `agents/specialists/dependencies/v2.md`, or `agents/specialists/performance/v2.md`. Prefer a fresh subagent. Pass the Plan, the product source, and the triggered question. Do not pass the author's reasoning. When no subagent is available, apply that file here and say the specialist ran in the current context. If the file is absent, do not create it. Skip or judge the track in text from `agents/plan-review/v8.md`, and say the specialist prompt was absent. A skip is disclosed in the same reply. Do not load the other specialist files.

Adversarial: when the costly-to-reverse row in `references/policy-triggers.md` names an isolated reviewer and the spend is allowed, or the user asked for a challenger. Prefer one fresh subagent when this session reports `subagents` available. Pass the same bounded fields. Do not pass the author's reasoning. When no subagent is available, apply the criteria file here and say that independence was weaker. A failure path the Issue and the Plan already state does not by itself justify a second reviewer.

Source: when the Source track in the criteria file matches and a finding depends on a current external fact, make one bounded check. Read `policies/source-verification.md` for that check when the fact is required to judge the finding, and `policies/cost.md` allows it. Cite the source that was opened. When the check is not required, or cost does not allow it, mark the claim unverified. Do not start `/pk-research`. Do not supply the fact from memory.

When a spend was eligible and the evidence was not attached, the reply still follows the criteria file, including its line for a delta that was not rendered.

## Review

Apply the criteria file once to the fields you loaded. Do not weaken a Blocker or a Required finding because the Plan's self-review says implementation-ready, or because the profile is `lean`.

The reviewer does not edit. Findings are hypotheses for the Plan author. This command does not apply them, does not rewrite the Issue to match the Plan, and does not rewrite the Plan to match the Issue.

A discovery gap or a spec gap stays in the findings, with the owner the criteria file names. Do not answer it.

## Authorized repair caller

The review phase above always stays read-only. Review alone ends with findings and one grouped repair proposal; it authorizes no mutation. When the user also requested repairs or already accepted that concrete proposal, the author/caller may continue affected owning responsibilities here under `references/artifact-writing.md`. Do not ask the user to type owner commands or repeat existing authorization. Findings are hypotheses: inspect cited source, confirm the consequence and reject false positives before editing.

Make the role transition explicit: report the read-only verdict/repair proposal first, then validate/apply only authorized owner changes. Load `policies/decisions.md` for a newly material choice or authorized knowledge capture. Resolve it with the user in this conversation; continue unaffected work while it is pending. Issue/Spec/Plan/Ticket changes follow their existing owners and stable identities, not a reviewer rewriting upstream scope to fit a route. Re-review only affected revised route and proof; a wider pass needs concrete wider impact. Escalate repeated disagreement with evidence instead of an unlimited full-review loop. Do not implement production code or start unrelated stages from plan repair.

## Stop

In the review-only phase do not write a status field, a review archive, a ticket, a handoff, or a replacement Plan; leave the Plan, the Issue, and the Spec byte-for-byte as read. An explicitly authorized repair caller follows the separate section above after the read-only result.

Report the criteria file's verdict and findings using the presentation below on a review-only request. The separately authorized caller may perform only the affected repair above; do not start unrelated lifecycle stages.

Present the working reviewer payload in the user's language and configured technical depth/detail: lead with the verdict and practical consequence, group related repairs, distinguish actual owner questions from technical fixes, and retain severity plus precise evidence/locations. Do not copy XML/tool wrappers or force an English field dump. Detailed non-technical means more explanation, not more rubric jargon.

For REVISE, offer one bounded repair covering affected owning documents and return review, not a sequence of commands for the user to type. Obtain missing repair authorization and material decisions; then the authorized caller follows artifact-writing. No implementation recommendation until required findings are resolved and reviewed. For ACCEPT (including fully recorded authority-supported tradeoffs), offer implementation of the whole Plan or a selected unit, or decomposition when useful/requested. Missing tradeoff ceilings remain a Plan repair, not permission to implement.
