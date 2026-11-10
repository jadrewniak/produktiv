# Commands

The single onboarding/help catalog. Show brief purposes on first setup; do not start a command automatically. Follow the earliest unresolved responsibility, in this conversation or a separate one using canonical artifacts.

## Implemented entrypoints

- `/pk-setup` — inspect/configure an existing project or establish a greenfield foundation; onboard communication preferences.
- `/pk-discover` — settle product behavior, UX, scope and acceptance into a product Issue (GitHub or local Markdown).
- `/pk-research` — answer a bounded external/contextual question with evidence.
- `/pk-prototype` — try one unresolved behavior or interaction in a disposable experiment.
- `/pk-design` — propose coherent visual rules and relevant views/flows; preserve accepted durable visual references.
- `/pk-diagram` — visualize one relationship, flow, state or structural question.
- `/pk-to-spec` — translate an Issue into the relevant technical/system contract when needed.
- `/pk-to-plan` — map decided behavior and any Spec onto an executable route in the repo.
- `/pk-review-plan` — challenge the route and the assumptions/contracts it relies on, before execution.
- `/pk-decompose` — optionally carve useful execution boundaries into linked Tickets.
- `/pk-implement` — execute a whole Plan, selected unit/task or Ticket and prove that boundary; a small, fully stated change without a Plan takes a gated fast path.
- `/pk-code-review` — review correctness/compliance of a code range; verify findings before safe remediation.
- `/pk-simplicity-review` — challenge complexity in implemented code while preserving governing behavior/contracts.
- `/pk-debug` — reproduce, diagnose and fix an observed failure.
- `/pk-closeout` — assess the whole feature, including integration and reused evidence; early runs identify readiness blockers.
- `/pk-handoff` — write durable decisions first, then preserve only otherwise lost transient state; verify freshness before resuming.
- `/pk-explain` — explain current source, structure, changes or artifact meaning at the requested depth without editing the project.

## Release boundary

The v1 package contains these 17 public entrypoints. `/ship` remains a post-v1 release/deploy responsibility. `/help` may render this catalog when provided by the host; it is not an additional delivered skill. Acceptance status and platform evidence belong to the versioned release receipts, not this runtime catalog.
