# Artifact presentation and compatibility

**Status:** regression contract; not a behavioral PASS.
**Templates:** `workflow/templates/{issue,spec,plan,ticket}.md`
**Resolver:** `workflow/references/artifact-resolution.md`

Artifacts read as product documents, not serialized workflow state. Issue owns product behavior, Spec owns binding system contract, Plan owns route, and Ticket owns one execution boundary. Required content is judged by meaning and retrieval, not a fixed heading order, English heading name, H4 ban, empty `None` section or exact bold-label sequence.

## Identity

New artifacts begin with one hidden raw-Markdown comment:

```text
<!-- produktiv: {"version":1,"feature":"saved-label"} -->
```

The JSON must be valid, `version` must be `1`, and exactly one current comment may exist. Allowed semantic keys:

- Issue: `feature`
- Spec: `feature`, `issue`
- Plan: `feature`, optional `issue`, optional `spec`
- Ticket: `feature`, `slice`, `plan`, optional `issue`, optional `spec`

Status/runtime keys are invalid. `version` describes encoding only. `SKILL.md` YAML frontmatter is out of scope and unchanged.

Readers also accept the legacy leading YAML encoding. Matching current+legacy values resolve as one identity during migration. A conflicting pair, invalid JSON/YAML, duplicate declaration, wrong kind or disallowed key is an explicit conflict; filename fallback is forbidden. Filename fallback applies only when the document genuinely has no declaration. Issue has no `slice`; Ticket has both `feature` and `slice`.

New writers emit only the comment. An authorized update converts the one touched legacy artifact while preserving path, slug, links and stable IDs. There is no mass migration or dual metadata store.

## Presentation

- one H1 after metadata;
- optional nonempty Date/Updated/Related/Superseded by navigation after H1, separate from hidden identity; no duplicated identity or runtime readiness badge;
- no empty heading or filler `None` section;
- subsections, tables, examples and compact type/code fragments are allowed when useful;
- language follows project/user; stable technical IDs remain stable;
- Issue is organized by problem/journey/rules, Spec by domain contracts, Plan by outcomes/wiring/evidence, Ticket by execution boundary;
- provenance points to a precise source for each coherent material rule group and directly beside an exception when needed; it is not a label after every sentence.

## Retrieval checks

For a small change, complex increment and whole V1, a cold reader must locate an outcome, material decision/source, unsupported case, implementation owner and sufficient proof without conversation history. Existing fixtures with YAML remain reader-compatibility inputs and are not rewritten. Current-comment specimens live beside them with `-v1` names.
