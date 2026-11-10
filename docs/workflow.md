# The workflow

Produktiv splits a product change into stages. Each stage is a skill you call by name. A skill does its own job, writes its result into a durable artifact and recommends the next command. It never starts that command itself.

## Stages

| Stage | Command | Result |
|---|---|---|
| Set up | `/pk-setup` | `.workflow/` config and project context, refreshed on every run |
| Decide the product | `/pk-discover` | An Issue: behavior, UX, scope and acceptance |
| Close the system contract | `/pk-to-spec` | A Spec, when the change needs binding technical guarantees |
| Plan the route | `/pk-to-plan` | A Plan: units of work mapped onto the repository |
| Challenge the route | `/pk-review-plan` | Findings and a gate verdict, before any code |
| Slice, optionally | `/pk-decompose` | Tickets, when a Plan needs separate execution boundaries |
| Build | `/pk-implement` | Code, focused checks and the quality gate for one boundary |
| Review | `/pk-code-review`, `/pk-simplicity-review` | Findings on a diff, checked before any fix |
| Finish | `/pk-closeout` | A readiness report for the whole feature |

Helpers answer one question and leave the decision with the caller: `/pk-research` (sourced evidence), `/pk-prototype` (a disposable experiment), `/pk-design` (visual rules and screens), `/pk-diagram` (a typed diagram), `/pk-explain` (an explanation without edits) and `/pk-debug` (one observed failure, fixed at the root). `/pk-handoff` saves unfinished state for a fresh session.

Start at the earliest stage that is still open. A decided small request can go straight to `/pk-to-plan`, and a small change you can state fully can go straight to `/pk-implement`, which then takes the fast path.

## Artifacts

| Artifact | Owns | Default store |
|---|---|---|
| Issue | What the product does and how it is accepted | GitHub Issues when configured and readable, otherwise `docs/issues/` |
| Spec | System guarantees: data, compatibility, boundaries | `docs/specs/` |
| Plan | The implementation route, in units | `docs/plans/` |
| Ticket | An execution boundary carved from a Plan | GitHub Issues or `docs/tickets/` |
| ADR | A lasting architecture decision | `docs/adr/` |

Each decision has one owner. A later stage that finds a gap in an earlier artifact routes it back to that artifact's command instead of overriding it. The stores are set in `.workflow/config.yaml`.

`.workflow/context/` holds team-shared context: `project.md` and `quality.md` (refreshed from the repository), and `domain.md` and `design.md` (confirmed terms and visual decisions). Your own technical level and detail live in `.workflow/local/`, which is gitignored, together with the graph, caches and a handoff file.

## Checks along the way

- **Quality gate.** `/pk-implement` runs the test, lint and typecheck commands from `quality.md` through `adapters/host/gate.mjs` and keeps a receipt for the exact working tree. It installs nothing and runs only commands your repository defines.
- **Fast path.** A small, fully stated change without a Plan skips the Plan and the separate review. The gate still runs, and a change over 3 files or 60 changed lines stops and goes to planning.
- **Reviews.** `/pk-review-plan` and `/pk-code-review` use fixed, versioned criteria. Findings are hypotheses until checked. Material ones are reproduced before anything is fixed.
- **Commit trailers.** With Git, commits can carry `Produktiv-Feature`, `Produktiv-Unit` and `Produktiv-Ticket` trailers that link them back to the Plan. They are pointers, not proof.
- **Closeout.** `/pk-closeout` looks at the whole feature, including integration, and reuses evidence that is still current.

## Optional capabilities

The skills run in the host agent without Node or Git. When they are available, these add to it:

- a structural code graph (Node 22, Git);
- offline diagram rendering (Node 18);
- the quality gate (Node 18), with receipts and the fast path needing Git;
- an external reviewer for `/pk-code-review`, off by default. It sends the reviewed code to another tool only after you see a preview and agree for that run.

A missing capability turns off only the path that depends on it, and the skill says so.

## Cost profile

`cost.profile` in `.workflow/config.yaml` sets how willing commands are to spend on optional work: `lean`, `balanced` (default) or `high-assurance`. It does not lower the evidence a command must produce. See [costs and when not to use Produktiv](costs.md).
