# Project state layout

Paths below are the v1 encoding from the implementation plan, section 2. Classes are the 2A state table. This reference does not create `.workflow/` and it does not validate a schema. `/pk-setup` initializes shared/local setup state. `/pk-handoff` writes only its temporary transfer after authorized durable writeback; `references/handoff-resume.md` governs consumption and expiry. This reference itself writes nothing.

Runtime facts are not written into config. Git, remote/HEAD state, Issue read/write access, Node, graph availability, diagram availability, browser, web, and subagents are observed from the host for the session (`capabilities.md`). They are not fields of `.workflow/config.yaml` or `.workflow/local/preferences.yaml`. `artifacts.issues` records intended storage policy, not the last probe result; `git.workflow` records commit policy, not GitHub availability.

## Classes

| Class | Contents | Paths |
|---|---|---|
| Durable shared | Team config, and the configured Issue, Spec, Plan, and ADR stores. `.workflow/context/` is team-shared, and it is not one kind of data. The two kinds are below. | `.workflow/config.yaml`, `.workflow/context/`, configured artifact stores |
| Local durable | `technical_depth`, `detail`, personal cost override, local capability preference | `.workflow/local/preferences.yaml` |
| Generated | Graph, fingerprints, caches, analyzed SHA, gate receipts. Rebuildable | `.workflow/graph/`, `.workflow/cache/graph/`, `.workflow/cache/evidence/` |
| Temporary | Handoff. Raw review, raw research, and an unfinished greenfield frontier are temporary too and are not given a second store here | `.workflow/handoff.md` |
| Runtime fact | Host availability only | Not stored. See `capabilities.md` |

`graph.enabled` in `.workflow/config.yaml` is project policy. It is not availability. A local opt-out is a preference under `.workflow/local/`. It is not availability. None of these files stores host availability.

## Context files

`.workflow/context/` holds two kinds. Both stay team-shared and are not gitignored.

| Files | Kind | What `/pk-setup` does |
|---|---|---|
| `project.md`, `quality.md` | Repo-derived snapshot; confirmed product foundation in greenfield | Refresh repo facts; preserve confirmed foundation until authoritative evidence or the user changes it. A previous command definition is not current evidence. |
| `domain.md`, `design.md` | Durable context | May hold repository-derived facts and confirmed durable decisions. Reconciles the facts. Preserves a confirmed decision unless current authoritative evidence contradicts it or the user changes it. Not finding that decision's source again is not that contradiction. |

`/pk-discover` writes a cross-feature term into `domain.md` only after the user confirms it. A lasting visual decision is written into `design.md` only after the user accepts it. `/pk-setup` does not delete either decision because this run did not find it in the repository again. A repository-derived fact is removed when current authoritative evidence shows it is gone. Omit either file only when it would contain neither a confirmed fact nor a preserved decision.

## Paths

| Path | Class | Git |
|---|---|---|
| `.workflow/` | Project-local state root | Created by `/pk-setup` in a project repository, not by this package |
| `.workflow/config.yaml` | Durable shared | Shared config. Not gitignored |
| `.workflow/context/project.md` | Repo snapshot. Team-shared | Not gitignored |
| `.workflow/context/domain.md` | Durable context. Team-shared | Not gitignored |
| `.workflow/context/quality.md` | Repo snapshot. Team-shared | Not gitignored |
| `.workflow/context/design.md` | Durable context. Team-shared | Not gitignored |
| `.workflow/local/preferences.yaml` | Local durable | Gitignored with `.workflow/local/` |
| `.workflow/graph/` | Generated | Gitignored |
| `.workflow/cache/graph/` | Generated | Scratch. Gitignored with `.workflow/cache/` |
| `.workflow/cache/evidence/` | Generated. Gate receipts keyed by working-tree hash | Gitignored with `.workflow/cache/` and by its own `.gitignore` |
| `.workflow/handoff.md` | Temporary | Gitignored. Replaced, never appended. Not project status |
| `docs/issues/*.md` | Durable shared | Default Issue store when GitHub is absent. Separate from tickets |
| `docs/tickets/*.md` | Durable shared | Default Ticket store when GitHub is absent. Separate from issues |
| `docs/specs/` | Durable shared | Default Spec store |
| `docs/plans/` | Durable shared | Default Plan store |
| `docs/adr/` | Durable shared | Default ADR store |

Issue, ticket, session, commit, and PR stay distinct. `docs/issues/` and `docs/tickets/` are ordinary markdown, not a tracker.

New Issue/Spec/Plan/Ticket Markdown carries its identity in the hidden `produktiv` JSON comment defined by `artifact-resolution.md`. Existing YAML identity remains readable during migration. This encoding change does not apply to `SKILL.md` frontmatter and does not create a second state store.

A project may keep workflow context local instead of shared. That choice has to be explicit. Shared config and private preferences do not mix in one file.

## Gitignore

`workflow/templates/gitignore-workflow.txt` is the snippet a project adds to its ignore rules. It ignores:

- `.workflow/graph/`
- `.workflow/cache/`
- `.workflow/local/`
- `.workflow/handoff.md`

It does not ignore `.workflow/config.yaml` or `.workflow/context/`.
