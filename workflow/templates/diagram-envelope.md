---
question: <!-- The one question this diagram answers. -->
semantic_type: <!-- architecture, workflow, sequence, dataflow, or lifecycle. Exactly one. -->
status: <!-- CURRENT or PROPOSED. This key stays on the envelope. -->
lifetime: <!-- ephemeral, attached, or persistent. -->
authority_refs: <!-- Issue, Spec, Plan, ADR, or repo paths that justify the diagram. Remove this key when none apply. -->
analyzed_sha: <!-- CURRENT only. A 40-character SHA of the revision that was read, or uncommitted-direct. Remove this key for PROPOSED. A SHA here is evidence of what was read. It is not a claim that proposed code exists. -->
parent: <!-- Attached only. The Issue, Spec, Plan, or ADR this diagram supports. Remove this key otherwise. -->
persistent_path: <!-- Persistent only. The documentation path the user named. Remove this key otherwise. -->
rendered_artifact: <!-- HTML path after a successful render. Remove this key when the diagram was not rendered. -->
---

# <!-- Same words as meta.title -->

<!-- The keys above and the sections below are the envelope. They are not Archify fields. -->

## Evidence or authority

<!-- CURRENT: a repo path with an optional line range, a direct read, or a deterministic structural graph fact at analyzed_sha. Name an inference as an inference. PROPOSED: the Issue, Spec, Plan, ADR, or decision. Do not attach repository blob links that imply the proposed node already exists. -->

## IR

<!-- The Archify document for semantic_type. diagram_type matches semantic_type. Use the schema's own layout names when that schema has them: col, y, row, pos. Do not rename those fields. Do not put question, status, lifetime, analyzed_sha, authority, parent, persistent_path, or rendered_artifact inside this JSON. PROPOSED JSON omits meta.repository and components[].sources. Omit meta.quality_profile unless the user asked for a presentation artifact. Omit meta.output. -->

```json
{}
```
