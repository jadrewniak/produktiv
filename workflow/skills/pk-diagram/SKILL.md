---
name: pk-diagram
description: Answer one structural question with a typed diagram. The caller keeps the decision. A missing runtime returns structured unavailable.
---

# Diagram one question

Use the repository root as the project root. This command answers one question with a typed diagram. Read the package's `policies/kernel.md` and `references/context-pack.md` through the adjacent `produktiv` package link; in a source checkout they are under `workflow/`. Read `references/capabilities.md` and `templates/diagram-envelope.md` the same way.

The reply is the filled envelope and, when the runtime renders, the HTML path. When the runtime is missing or broken, the reply is the structured unavailable result below. A PROPOSED IR that carries repository evidence is rejected before a renderer call. The caller owns any decision. This command does not write an Issue, Spec, Plan, or ADR, and it does not keep a diagram database.

## Context

- Must load: Question/relationship, current bounded evidence; `references/capabilities.md`, `templates/diagram-envelope.md`
- May load conditionally: Available runtime: selected semantic schema and common schema only when referenced; graph-use for selected unresolved relationship
- Must not load by default: Other semantic schemas, renderer source/viewer docs, whole graph, whole Spec rendered as a picture, reviewer rubrics

## When this command runs

Run only when seeing a relationship, sequence, flow, or legal state would answer the question better than reading it.

Do not run this command because it exists. A three-step list that prose already states is not a diagram. A lifecycle that must be driven is `/pk-prototype`. A fact about the world or about software outside this repository is `/pk-research`.

Another skill may route here only for that representation. `/pk-discover` routes here for a relationship, sequence, or state that must be seen. `/pk-review-plan` may request an architecture compare when a plan change is structural. `/pk-explain` may suggest this command with a question and a type. Those callers keep the decision.

```text
Is this a fact about the world or about software outside this repository?
  yes -> /pk-research
Does the behavior have to be driven?
  yes -> /pk-prototype
Is a static map of structure, sequence, flow, or legal states enough?
  no  -> stop; text is enough
  yes -> select type, status, and lifetime, then continue
```

## Before any renderer

Do these four things before any renderer call, including when the later result is unavailable or rejected:

1. Select one semantic type from the five names below.
2. Mark `CURRENT` or `PROPOSED`.
3. Choose a lifetime: `ephemeral`, `attached`, or `persistent`.
4. Read diagram availability from the host session, using `references/capabilities.md`.

Then author the IR and apply the PROPOSED guard. Only then call a renderer, and only when this flow says the runtime is available.

```text
select one semantic type
→ mark CURRENT or PROPOSED
→ choose lifetime
→ read diagram.available
→ author IR
→ PROPOSED guard

diagram.available is false
→ structured unavailable result
→ do not resolve the adapter path
→ the adapter file is not required to exist
→ caller continues

diagram.available is true
→ resolve the adapter path
→ path absent
  → structured unavailable result
  → reason adapter-absent
  → do not import it
  → caller continues
→ path exists
  → call workflow/adapters/diagram
  → validate, then render
  → compare only when a later compare is expected

runtime returns diagram/unavailable
→ structured unavailable result
→ no kept artifact
→ caller continues
```

## Load

Read the question and the narrowest evidence that can answer it: the repo slice, Issue, Spec, Plan, ADR, or domain note the user or the caller already points at. Read the schema for the chosen type only: `vendor/archify/schemas/<type>.schema.json`, and `common.schema.json` only when that schema references it. Paths are under `produktiv/vendor/archify/schemas/` when installed, and `workflow/vendor/archify/schemas/` in this checkout.

Stop reading once the question, the type, and the evidence for this diagram are clear. Do not load the other four schemas, renderer source, viewer docs, the whole graph, or a Spec written out as a diagram.

Use the graph only when the unresolved fact is structural and the files already selected do not answer it. The graph section below is that path. A missing graph is not a missing diagram runtime.

## Types

v1 has these five semantic types. The skill offers this set and no other. `supports` is called only with one of these names.

| Type | Use |
|---|---|
| `architecture` | Components, ownership, dependency direction, integrations. |
| `workflow` | Process stages, decisions, actors or systems, transitions. |
| `sequence` | Ordered interactions, requests, events, responses, and failures that matter. |
| `dataflow` | Sources, transforms, persistence, movement across a boundary, sinks. |
| `lifecycle` | States, legal transitions, triggers, terminals, invariants. |

A Mermaid `flowchart` maps to `workflow` or `architecture`. A `sequenceDiagram` maps to `sequence`. A `stateDiagram` maps to `lifecycle`. Those are import hints. The artifact is the typed IR.

Infrastructure or cloud topology is `architecture` when that is the question.

Delta is `compare_architecture` on two architecture documents. It is an operation on this same type. It is not a `diagram_type`.

New `workflow` IR uses `schema_version` 2. `architecture`, `sequence`, `dataflow`, and `lifecycle` use `schema_version` 1.

Prefer 6–12 primary nodes and one main path. When the diagram grows past that, raise the abstraction or split it by question before calling the renderer. The renderer does not drop nodes. Do not draw the whole graph. Do not diagram a trivial linear checklist.

## Status and evidence

Every diagram has a status when a plan could be mistaken for the system that exists.

| Status | Meaning |
|---|---|
| `CURRENT` | The system as it exists. Evidence is the repo, a committed graph fact, config, or a Spec, ADR, or doc about current reality. |
| `PROPOSED` | The designed target from an Issue, Spec, Plan, ADR, or a decision the user already made. |

`CURRENT` and `PROPOSED` live on the envelope. They are not Archify fields. Do not put them inside the IR.

For `CURRENT`, each material node or edge has enough provenance to justify it: a repo path with an optional line range, or a deterministic structural graph fact at the analyzed SHA. Put that citation on the envelope. An analyzed SHA on the envelope says which revision was read. It does not mean proposed code exists. When the evidence is the working tree or a direct read, set `analyzed_sha` to `uncommitted-direct`. Do not present an inference as a fact. If evidence is missing, mark the inference on the envelope or drop the node.

`CURRENT` architecture may also carry real `meta.repository` (`url` and a 40-character `revision`) and `components[].sources` (`path`, optional `line` / `end_line`). Do not invent them. Other types cite evidence on the envelope only. Do not claim a repository-blob verify ran. This command does not set `ARCHIFY_REPO_ROOT`.

For `PROPOSED`, authority is the Issue, Spec, Plan, ADR, or the stated decision, on the envelope. Omit `analyzed_sha`. If the caller supplied a SHA, leave it off the envelope.

## Lifetime

Choose one.

| Lifetime | When |
|---|---|
| `ephemeral` | Conversation or decision only. No maintenance. The reply holds the envelope. A render uses a temporary `.html` path and is disposable. |
| `attached` | Evidence for one Issue, Spec, Plan, or ADR. The caller names the parent. This command does not edit that parent. |
| `persistent` | The user named a documentation path. Regenerate it because the docs are maintained, not because HEAD moved. |

Do not commit every diagram. Do not create a diagram directory, index, or database. When the diagram disagrees with the Issue, Spec, or other approved artifact, that artifact wins. Mark the diagram stale or revise the diagram. Do not revise the approved artifact from this command.

## Author the IR

Fill `templates/diagram-envelope.md`. Delete every instructional comment. Omit an empty key.

The JSON block is the Archify document. `diagram_type` matches the chosen type. Ids match `^[a-zA-Z][a-zA-Z0-9_-]*$`. Relationship endpoints exist. `additionalProperties` is false: do not invent schema fields, and do not put `question`, `status`, `lifetime`, `analyzed_sha`, authority, or the render path inside the JSON.

When the chosen schema has `col`, `y`, `row`, or `pos`, author those properties under those names. Do not rename them into a second layout language.

Omit `meta.quality_profile` unless the user asked for a presentation artifact. The default is the smallest valid diagram that answers the question. Omit `meta.output`. The HTML destination is the argument to `render_ir`, outside `workflow/vendor/archify/` (or `produktiv/vendor/archify/` when installed).

When a later compare is expected, give every architecture connection an `id` before validate. The id is stable across the two documents. Do not invent a rename map.

Hand-placed SVG is not a result of this command. The adapter writes the HTML.

## PROPOSED guard

Apply this before calling the adapter, the renderer, or compare. It does not need the diagram runtime. If diagram capability is false, this guard still runs when the IR is PROPOSED and carries the fields below.

Reject when `status` is `PROPOSED` and either of these is set (`!= null`):

- `ir.meta.repository`
- `ir.components[].sources` on any component

Return this and stop. Do not import the adapter to perform the check.

```text
ok: false
result: rejected
code: diagram/proposed-evidence
severity: error
message: PROPOSED IR must not carry repository evidence. Remove meta.repository and sources; authority stays on the workflow envelope.
subject.status: PROPOSED
subject.paths: the JSON paths that were set, such as /meta/repository and /components/0/sources
artifact: null
renderer: not called
```

`CURRENT` may keep real repository evidence. This guard does not strip it.

## Availability

Read `diagram` from the host session as `references/capabilities.md` defines it. Do not keep a second registry. Do not shell out to Node to discover that it is absent. When Node is present and the major is unknown, follow that file's bounded probe. Unconfirmed stays unconfirmed: do not call the adapter, and do not report `node-floor` or Node absent in its place.

`diagram.available` is true only when the major for this run is `>= 18` and the renderer marker exists: `vendor/archify/renderers/architecture/render-architecture.mjs` under the package root. Otherwise diagram is unavailable. A known major below 18 is reason `node-floor`. A missing renderer is reason `missing-runtime`. Node absent is reason `node-absent`. An unconfirmed major stays unconfirmed. A missing or broken `produktiv` package link is reason `missing-package`.

The adapter path is `adapters/diagram/index.mjs` under that same package root (`workflow/adapters/diagram/index.mjs` in this checkout). Resolve it only after `diagram.available` is true and the IR has been authored.

```text
capability false
→ structured unavailable
→ do not stat or import the adapter
→ the adapter file is not required to exist

capability true and the adapter path is absent
→ structured unavailable
→ reason adapter-absent
→ do not import it

capability true and the adapter path exists
→ call that module only
→ do not import vendor/archify
```

A missing graph does not take this branch. Author from the source the caller already selected.

## Validate and render

Call the adapter with the IR only and the status already chosen. Do not pass the envelope.

```text
validate_ir(type, ir, status)
ok → render_ir(type, ir, outputPath, status)
not ok → correct the diagnosed subject, or stop with the diagnostics
```

`outputPath` is an `.html` file outside the vendored Archify tree. For `ephemeral`, a temporary path is enough. For `attached` or `persistent`, use the path the caller or the user named. When the host cannot write that file, say it was not written and still return the envelope in the reply.

A failed validate or render is not a successful diagram. Do not describe it as one. The renderer does not repair semantics into something plausible. Change only the subject the diagnostic names. If the adapter returns `diagram/unavailable`, or the call breaks before a diagram exists, use the structured unavailable result. Keep no artifact.

On success, set `rendered_artifact` on the envelope to the returned path. `verify_artifact` runs inside `render_ir`. Do not open a browser to produce the HTML.

## Compare

Compare only on the path that found the adapter. Do not compare after an unavailable result.

Run it when the user asks for a delta, or when a plan change is structural: a new subsystem or layer, a dependency-direction change, an ownership move, or a persistence or integration boundary change. Skip it when prose already shows the change.

Call `compare_architecture(currentIr, proposedIr)` with two architecture documents. Both have already passed the PROPOSED guard. Connection ids are present. The base is `CURRENT`. The head is `PROPOSED`.

Report the adapter's `semantic` receipt. It omits a pure move, a reroute, and a geometry-only change. Say that a box that only moved is not an architectural change. `proofLevel` declares how the inputs were authored. It is not blast radius, not a claim that something will break, and not a claim that the change is safe to merge.

## Graph

Only for a structural relationship the selected picture must show; `related` or `architecture_overview`, conditionally read `references/graph-use.md`. Follow its availability, freshness, scoped-query and source fallback rules.

## Unavailable result

Use this shape when capability is false, the adapter path is absent, or the runtime returns `diagram/unavailable`. Include the type, status, and lifetime already chosen. `artifact` is null. Do not write a diagram file.

```text
ok: false
result: unavailable
reason: node-absent | node-floor | missing-runtime | missing-package | adapter-absent | runtime-broken
question: the question
semantic_type: the chosen type
status: CURRENT | PROPOSED
lifetime: ephemeral | attached | persistent
artifact: null
diagnostics:
  - code: diagram/unavailable
    severity: error
    message: why the runtime was not used
    supportedFixes: [continue without a diagram]
caller: continue
```

`caller: continue` means the caller keeps going in text. `/pk-discover` keeps its frontier. `/pk-review-plan` returns text findings. This command does not start either one. Do not install Node, Git, or a separate Archify package.

## Authority

The diagram is a representation. It is not the system contract and not product authority.

Leave the owning Issue, Spec, Plan, and ADR unchanged. After the user accepts an attached diagram, the caller may add a pointer. This command does not apply that edit.

## Stop

Stop when one question has a rendered envelope, a PROPOSED rejection, or a structured unavailable result.

Report the question, the type, the status, the lifetime, and either the HTML path or the unavailable or rejected result. Say that the owning artifact was left unchanged.

After an internal route, return the result to the caller so it can resume the authorized objective. For a standalone request, offer only a genuinely unresolved next action; do not start an unrelated stage.
