---
name: pk-decompose
description: Carve a plan the user wants sliced into execution tickets. Units stay the route. A ticket is a useful execution boundary, not a unit copy.
---

# Carve a plan into tickets

Use the repository root as the project root. This command writes execution tickets for a Plan the user wants sliced. Read the package's `policies/kernel.md` and `references/context-pack.md` through the adjacent `produktiv` package link; in a source checkout they are under `workflow/`. Read `references/capabilities.md` and `references/state-layout.md` the same way. Read `templates/ticket.md` from that same package root (`produktiv/templates/` or `workflow/templates/`). Read `references/artifact-resolution.md` from the same package for Plan/Spec identity, physical-file fallback, conflicts, and refresh on resume. Read `references/artifact-writing.md` the same way before writing Tickets.

Plan units describe the implementation route. Tickets carve that route into useful execution boundaries. They are allowed to coincide, but never by definition.

A ticket is one execution slice of that Plan. It is demonstrable on its own and readable in a fresh context. It is not a product decision, a system contract, or a new architecture.

Ticket, Plan unit, session, commit, and pull request stay distinct. They may coincide. This command never equates them.

## Context

- Must load: Current ready Plan and established boundaries, product acceptance, named source/check definitions; `templates/ticket.md`, `references/capabilities.md`, `references/state-layout.md`, `references/artifact-resolution.md`, `references/artifact-writing.md`
- May load conditionally: Canonical Spec on Issue path; explicit Spec pointer checked for inconsistency on no-Issue path; configured store capability
- Must not load by default: Graph/adapter/build, browsing, all Issues/policies, handoff/status ledger, invented Spec on Source brief path, reviewer rubrics

## When this command runs

Run only when the user wants an approved Plan sliced into execution tickets or slices.

The Plan has no runtime-status identity field. Its readable document state does not authorize slicing or prove execution readiness. Approved here means the user wants this Plan sliced. `/pk-review-plan` is optional for slicing; do not require it solely for decomposition. Required foundation review before code still applies.

Do not run this command because a Plan exists. A Plan may go straight to `/pk-implement`. Decomposition is never mandatory.

Write no ticket when the Slices section finds nothing to carve. Recommend `/pk-implement`. Do not restate that Plan as a ticket, a file checklist, a test run, or a commit.

A lightweight confirmation is allowed only when two slice boundaries are both real and the Plan does not decide between them. Do not quiz the user to re-approve the Plan.

## Load

Read the Plan the user named. The store is `artifacts.plans` in `.workflow/config.yaml` when that file exists, otherwise `docs/plans/` (`references/state-layout.md`). If no Plan exists, stop and name `/pk-to-plan`.

From the Plan's resolved identity metadata (current hidden comment or legacy YAML):

- `issue` set: that Issue is the product source. Read it. A GitHub number or URL is read when this session reports `issues` available (`references/capabilities.md`). A repository path is read as a file. If the Issue cannot be read, stop and name the missing reference. Do not invent an Issue, and do not switch to Source brief.
- `issue` absent: the product source is the Plan's Source brief. Read that section. If it is missing, stop. The Plan has no product source. Do not invent a Source brief, and do not look for an Issue to attach. Do not look up a Spec by feature slug on this path.
- `spec` set: read that file. If the path cannot be read, use the physical-file fallback in `references/artifact-resolution.md`. Do not create a Spec. On the no-Issue path the read only shows whether the pointer is an inconsistency. The file is not authority.

On the Issue path, resolve the canonical Spec using `references/artifact-resolution.md`. Read it even when the Plan or Issue omits the link. A different linked file is reference only. Multiple candidates or a missing declared contract stop the affected work as that reference says.

On the no-Issue path, do not resolve a canonical Spec. The light path is Source brief, then Plan. A Spec takes an Issue as its product authority. `/pk-to-spec` does not read a Source brief.

When `spec` is set on that path, write no ticket. Do not cite the file as the contract a slice follows.

- The route requires a binding, durable, shared, compatibility-relevant, or costly-to-reverse system contract: name `/pk-discover`. The Spec does not close that contract here. `/pk-to-spec` is not the owner.
- Otherwise the `spec` key is a Plan inconsistency: name `/pk-to-plan`.

When both apply, `/pk-discover` wins.

When `issue` is set, ignore a Source brief if one is still in the Plan. The Issue is the product source. Do not inherit acceptance from that Source brief.

Read the narrow files the Plan units name, including the test command they cite. Stop once those files confirm the symbols and paths the Plan already uses. A path the Plan marks as new need not exist yet. Do not read the rest of the repository.

Do not load every policy, every Issue, a handoff, a status ledger, or the whole graph. Do not call the graph adapter. Do not build `.workflow/graph/`. Do not browse.

The Plan's self-review is text inside the Plan. It is not a status field, and it is not permission to invent a missing decision. A coverage row that says covered does not close a gap the authority leaves open.

## Steps and established boundaries

Plan → Unit → Steps is hierarchy, not a ticket/target generator. Select stable units or an already named verifiable sub-boundary with result, inputs/dependencies and sufficient proof. A checkbox or ordinary step such as adding an export cannot become its own execution target merely because it has a label. Preserve stable Plan IDs and accepted design fragment refs. Missing boundary/route returns to `/pk-to-plan`; never invent a module or scope to make a slice fit.

## Inherit

Acceptance and the system contract stay apart.

Each acceptance line on a ticket is a product line the covered units already reference, copied from the product source:

- the Issue, when `issue` is set;
- the Source brief, when the Plan has no Issue.

Quote the line. Name the section it came from. Do not add a criterion, an edge, or a non-goal the product source does not already state. Do not restate a line as a different outcome. A Spec contract, boundary, or schema line is not an acceptance line.

The canonical Spec, when one was resolved on the Issue path, is the contract reference. Point at the sections the slice uses. Do not quote them as acceptance. A linked Spec that is not the canonical file is not the contract the slice cites. A Spec on the no-Issue path is not a contract reference.

Scope is the responsibility of the units or the established boundary this ticket covers. Out of scope, when the slice could absorb an exclusion, restates only the exclusions the product source already states. Omit the heading when none apply.

The objective is the execution outcome of those units or that boundary, as the Plan states it. It may be a technical outcome. It must be traceable: a reader can point at the Plan text it came from. Literal product wording is optional. An outcome the Plan does not state is a new decision. Delete it.

Authoritative references point at every Plan unit this ticket covers, or at the established boundary inside a unit, and at the product-source sections that own the inherited acceptance. When a contract reference was resolved, point at the Spec sections the slice uses. Several Plan units are allowed. Do not paste the Issue, the Spec, the Source brief, or the Plan.

Verification expectation points at the evidence the Plan already names for that slice. The check is not a new acceptance line. Do not add a test framework, a browser pass, a coverage threshold, a failing-test-first script, a worktree, or a commit.

A ticket does not contain a new architectural decision. Every module, service, store, class, path, and boundary it names already appears in the Plan, the contract reference, or the files the Plan cites. Do not add a component so the slice is easier to describe.

## Gaps

A gap blocks its affected boundary and dependent tickets. Write independently ready tickets only when their authority, scope and verification are complete; report withheld boundaries and owners. A global product-source conflict or ambiguous feature identity blocks the whole set. Do not turn the gap into an assumption, a placeholder, a `TBD` line, or a local technical choice. Do not repair the Plan, the Issue, the Spec, or the Source brief.

Name one owner:

| Gap | Owner |
|---|---|
| A missing product, UX, domain, or policy decision | `/pk-discover` |
| A missing final system behavior, boundary, or contract, and the Plan has an Issue | `/pk-to-spec` |
| A missing final system behavior, boundary, or contract, and the Plan has no Issue | `/pk-discover`. `/pk-to-spec` reads an Issue. It is not the owner. |
| A missing implementation route, order, or cross-unit contract | `/pk-to-plan` |
| A local reversible choice of slice boundary | Decide it in the ticket set. It is not a gap. |

A unit needs a decision the Plan lacks when its change offers two outcomes the product source does not settle, when its requirement reference does not point at a product-source line, or when acceptance cannot be inherited without inventing a line. The Plan's self-review saying implementation-ready does not close that gap.

The route establishes a system contract the canonical Spec does not close when it adds a binding, durable, shared, compatibility-relevant, or costly-to-reverse behavior, store, or error the Spec does not already state. When no canonical Spec was resolved, that route is still this gap. A Spec file on the no-Issue path does not close it. A local reversible edit the Plan already states, with product acceptance inherited, is not this gap.

The product source and the Spec, when one binds the slice, may already settle the behavior while the Plan still omits the route: no touchpoint the executor can follow, or a dependency that names no output. That is a route gap. Do not pick the path in the ticket. Do not send a closed contract back to `/pk-to-spec` to rediscover it.

A candidate that is only a line edit, a test run, a commit, or another execution ceremony is not a ticket. Fold it into the slice it checks. When the whole Plan is only that ceremony, stop and name `/pk-to-plan`.

## Slices

Carve by execution value. Follow the Plan's route. Do not draw a new architecture.

One ticket covers one unit, several units, or one boundary the Plan already drew inside a unit.

Cover several units with one ticket when all of these hold:

- they produce one observable behavior or one necessary migration state;
- the Plan names one coherent verification responsibility for that outcome, the evidence set that proves it;
- no unit produces an output that a separate ticket must consume before the outcome exists.

Several checks belong to that set. A focused test and a runtime check of the same outcome are one ticket. A helper, the export that calls it, and those checks are one ticket.

Split one unit into several tickets only when the Plan already separates that many boundaries inside the unit. Each boundary has its own observable behavior or necessary migration state, its own verification responsibility, and a name in the Plan that is not a unit id. A second check of the same outcome is not a separate boundary. Do not add a boundary to make the unit smaller.

A ticket that covers exactly one unit is allowed when that unit is itself one useful execution boundary: its own outcome and its own evidence, separable from the rest of the route. The match is a result of the carve.

Prefer the vertical slice the Plan already drew. A horizontal layer batch, a file-count quota, or a time box is not a reason to cut a new ticket. Shared file paths are not, by themselves, a reason to chain tickets or to glue independent boundaries into one ticket.

When the Plan already uses expand, then migrate, then contract, each phase the Plan named is an established boundary. One ticket per named phase. Do not add a phase.

Nothing to carve: the only boundary is a single Plan unit that is already one demonstrable outcome with its own verification responsibility. Write no ticket. That unit is the execution slice. A ticket would restate the Plan.

Grouping several units into one boundary is a carve. Write that one ticket, including when those units are the whole Plan. Splitting a unit at boundaries the Plan already drew is a carve. Separating independent outcomes is a carve.

A fresh context must be able to execute the ticket from its objective, scope, acceptance, blockers, and verification expectation, plus the references. It must not need this conversation.

Use the boundary's stable identity, result, complete inputs/producer dependencies and sufficient proof regardless of whether the Plan uses a subsection or bold label. Ordinary ordered steps and checkbox fragments lack this identity by default. Preserve the owning unit structure and accepted design view/state pointers; link without copying the gallery or turning a draft into authority. A planned-check producer is a real dependency until the actual definition is confirmed.

## Dependencies

Use a blocked-by edge only when one ticket consumes an output, a shared contract or schema, a compatibility phase, a migration state, or a verification seam that the other ticket produces. Name that output or condition on the edge.

Tickets with no unmet blocker form the ready frontier. Independent tickets stay independent. Do not invent a chain to force a single order.

Two tickets that would change the same contract in parallel get a real edge, or they are one slice. A ceremonial order is not that edge. A Plan line that cites only a shared file is not that edge. Do not copy it.

## Identity

`slice` is this ticket's own identity. It is lowercase kebab-case.

Take the name in this order:

1. The Plan states one outcome or boundary name for this group, apart from a unit id. Use that name when it is unique among the tickets in this run.
2. The ticket covers one unit. Use that unit's title, without the unit id.
3. The ticket covers more than one unit and the Plan states no unique name for that group. Kebab-case each covered unit title in Plan order and join those slugs with hyphens.

Drop a leading unit id such as `U1 —` before kebab-case. Drop punctuation. Collapse spaces to hyphens. Lowercase the result. Do not use a unit id, the feature slug as a shared fallback, a session, a commit, or a pull request as `slice`.

Two groups in one Plan do not share a slice. A Plan that names `prepare snapshot` and `consume snapshot` yields `prepare-snapshot` and `consume-snapshot`. A Plan that names neither yields a slug from each group's unit titles. Deriving that slug is a local identity choice. It is not a product or system decision.

The same boundary keeps the same `slice` on a later run.

## Self-review

Before any ticket is written, check the draft inline. Do not spawn a reviewer.

- Every acceptance line traces to the Issue or the Source brief, and the ticket names which. No Spec line is acceptance.
- No acceptance line, objective, or exclusion adds an outcome the product source or the Plan lacks. The objective traces to the units or the boundary the ticket covers.
- No ticket names a module, service, store, class, path, or boundary the Plan, the contract reference, and the cited files do not already contain.
- `slice` is the identity rule above. It is not a Plan unit id.
- When the Plan has no Issue, no ticket has an `issue` key and no ticket has a `spec` key. When a canonical Spec was resolved on the Issue path, `spec` is that path.
- Every blocker names the output or condition that gates the ticket. The ready frontier is the tickets with no blocker.
- No `TBD`, placeholder, or unresolved choice is written as decided.
- No ticket equates itself with a unit, a session, a commit, or a pull request.
- A gap stops its affected draft and dependents. No ticket is written around an unresolved decision.

Fix a failed check in the draft. If the check is a gap, withhold affected tickets and name the owner; independent passing drafts may be written.

## Write

Use the host issue store the session already reports. Do not build a second ticket client. Do not read or write an `artifacts.tickets` key.

Fill `templates/ticket.md`. Delete every instructional comment. Keep Objective, Authoritative references, Scope, Acceptance, Dependencies, and Verification expectation. Keep Out of scope only when an inherited exclusion applies. Omit an empty heading. Do not add a status field, a session, a commit, a pull request, or a second copy of the Plan.

The written ticket has one H1, the slice name. Use subsections, examples or a compact table when they help a cold executor; content requirements matter, not fixed heading order.

Write one hidden identity comment before H1 containing `version:1`, Plan `feature`, ticket `slice`, and Plan path; add `issue` and canonical `spec` only when applicable. Example: `<!-- produktiv: {"version":1,"feature":"label","slice":"write-label","plan":"docs/plans/label.md"} -->`. Do not include a non-canonical/no-Issue-path Spec or YAML identity on a new file. Human navigation fields follow `references/artifact-resolution.md`; no identity/runtime status field proves completion.

Write GitHub execution Issues when `artifacts.issues` is `github` and this session reports `issues` available. A GitHub write uses `issues` and does not need `fileWrite`. Create or update the one issue whose body `feature` and `slice` match. A product Issue has no `slice`. Do not update it. When two host issues match the same `feature` and `slice`, stop and report the duplicate. Do not open a third. Do not also write `docs/tickets/` in that run.

When that host store is not written, write local markdown under `docs/tickets/` (`references/state-layout.md`). Create the directory if needed. Tickets stay out of `docs/issues/`. This is the project store when `artifacts.issues` is not `github`. It is the fallback when `artifacts.issues` is `github` and `issues` is not available: say that the host issue store was unavailable. The fallback does not run when Load stopped because the product Issue could not be read. A local write needs `fileWrite`. When `fileWrite` is unavailable, do not write the file and do not claim it was written.

One ticket per execution boundary. Locally, the file is the one whose resolved identity `(feature, slice)` matches, or `docs/tickets/<feature>-<slice>.md` when no declaration exists. When two files match, stop and report the duplicate. An authorized update converts legacy YAML identity in that ticket only while preserving its path and refs. Do not write a third or mass-migrate others.

If that ticket exists and the slice is already in progress — the user says so, or the working tree already contains the slice's change — leave it. Report the conflict. Do not overwrite it. If the ticket is only an earlier decomposition of the same boundary, replace it with the current text. Do not append a session log. Do not leave the previous body beside the new one.

Do not edit the Plan, the Issue, or the Spec. On GitHub, do not edit the parent Issue.

## Stop

Do not write a status field, a handoff, an ADR, or a pull request. Do not start another command.

Report the ticket paths or host issue references, the blocked-by edges with their reasons, and the ready frontier. When the host store was unavailable, say the local fallback was written. When the command stopped on a gap, report the gap and the one owner, and report which tickets were withheld and which were written. When the Plan was already one slice, report that no ticket was written.

Recommend one next command, and why:

- A gap: the owner from the table above.
- One coherent Plan and no tickets: `/pk-implement`.
- A ready frontier: `/pk-implement` on one unblocked ticket. Name any other unblocked ticket so the frontier is not turned into a queue.
- No unblocked ticket: the blocking ticket, and `/pk-implement` only after that output exists.
