# Decisions and durable knowledge

Load when an author encounters a material choice, records agreed knowledge, or changes a governing decision. A reviewer identifies the owner but remains read-only. Artifact ownership does not restrict which question may be discussed in the current conversation.

## Decide at the point of need

Resolve facts from the repository or verified sources, not by asking the user to investigate. A material choice changes user behavior, UX, data meaning, security/privacy, public compatibility, cost/maintenance or a hard-to-reverse foundation. Present the recommendation, a credible alternative and their consequences, then obtain the owner's choice or use still-valid explicit delegation. Reversible private implementation choices need no checkpoint. A new interdependent auth/persistence/storage foundation needs that choice before dependent design and a separate plan review before code; review never supplies consent.

Use concrete scenarios to expose differences. Once meaning is settled, do not reopen a choice over synonyms. A cheap label can be chosen within delegated scope. Reopen only decisions affected by new evidence or changed intent.

Before shaping dependent contracts or a route, revisit relevant open decisions in project context and owning sources. When a deferral's trigger is reached, ask the owner with a recommendation and real alternatives, or apply their still-valid delegation. “Decide in Plan” names the stage, not permission for the agent to choose. An installed runtime is not a product-stack choice, and silence or “object before coding” is not acceptance.

For a new material decision, record the owner's choice or delegated boundary and its source/date briefly in the owning artifact; no separate consent registry or full transcript. An author's rationale, a Spec-decision label or an ADR's accepted badge cannot supply missing consent. Without it, retain a proposal and pause dependent work. Existing supported choices are reused, not re-approved routinely. In particular, absence of a product rule does not authorize adding a user-visible restriction or changing data protection as a technical default. Carrying existing behavior into a contract is also a choice: when it can destroy or overwrite user data on a path the new scope reaches, ask the owner explicitly. Current code is not consent, and a sentence inside a document put up for acceptance is not asking.

An unresolved choice pauses dependent work, not independent safe work. The active author may resolve it and update its owner within the authorized assignment; the user need not invoke another command just to repair a prerequisite. A wider product choice, an unverified required fact, missing write authorization or an unsafe contradiction stays explicit rather than becoming an assumption. Research and prototypes provide evidence, not consent.

## Permission and writeback

Distinguish conversation only, authorized knowledge capture, artifact preparation, and execution. “Just discuss” permits no writes. Permission to capture decisions covers confirmed updates during that session, not implementation or external publication. Read-only reviews do not mutate sources. A task-local proposal never silently overrides an accepted ADR or design.

Write each accepted decision once, in its owner:
- reusable domain meaning: existing project glossary, or `.workflow/context/domain.md` if no glossary exists;
- project foundation and durable pointers: `.workflow/context/project.md`;
- product outcome/acceptance: canonical Issue;
- binding system guarantee: canonical Spec;
- allocation/order/integration: Plan and affected Tickets;
- presentation: accepted design and its context index;
- private reversible detail: code, without a new document.

With authorized capture, persist newly confirmed reusable terms and decisions after each substantive question round, before moving to another area; briefly identify the delta to the user. If nothing durable changed, do not write. Definitions describe meaning; context is not a second PRD or conversation log. Preserve unrelated content and prior delegation.

A durable architectural choice merits an ADR only when it is costly to reverse, surprising without context, and a real trade-off. Use the project's format and configured `artifacts.adrs` (default `docs/adr/`). If no convention exists, a short title, Date/Updated, decision status (proposed, accepted, superseded), context, decision/reason and material consequences suffice. Link superseded and replacement decisions; do not rewrite history as if the old choice never existed. No ADR for every library or private helper.

## Repair without scope expansion

Use `references/artifact-resolution.md` for identity and `references/artifact-writing.md` for targeted owner updates. A route repair is not permission to invent a system/product contract. Obtain missing owner decisions before dependent code. Material route changes receive the active plan review again; local corrections do not.

A Plan's Source brief is frozen requested behavior, not a writable escape hatch. If the accepted destination materially changes or needs a new binding system contract, establish a canonical Issue (and Spec when needed), update the Plan link and remove the obsolete Source brief. Do not create a second authority for an existing Issue.

Report an unresolved next action with its owner, cause and resume condition. “Needs human decision” and “executable after producer X” are assessments of current evidence, not status fields proving completion.
