---
name: pk-prototype
description: Test one unresolved behavior, interaction or visual question in a small inspectable experiment; the caller keeps the decision.
---

# Prototype one question

Use adjacent `produktiv` resources (source: `workflow/`). Read `policies/kernel.md`; use `references/context-pack.md` and the Context section below for relevant inputs.

## Context

- Must load: Active question, settled dependencies and relevant slices; `references/capabilities.md` for observation
- May load conditionally: UI/flow: design policy and exact accepted views/assets; design-practice for missing direction/hierarchy; cost for optional expensive check; `references/visual-handoff.md` for persisting accepted HTML/assets
- Must not load by default: Full product document pack, production scaffolding context, all visual references for logic-only work, review rubrics, full graph

## Select the experiment

The explicit user target or caller's bounded question is the anchor. Use nearby conversation only to resolve a clear reference and recover settled context, not to switch to another open topic. Ask one clarifying question without writing HTML only when competing interpretations would produce materially different experiments. Never ask the user to supply a hypothesis already inferable from the question.

If the request is a coherent visual proposal/style guide/coordinated screens rather than a named uncertainty, route once to design within the authorized request and explain why. A narrow experiment may be equally polished. A current external fact belongs to research; a static relationship map may need only diagram; text that settles the question needs no experiment.

State a compact packet before building: uncertainty, hypothesis, and what observation would select/reject/defer it. Do not wait for confirmation of this inference when the target is clear.

## Load and choose fidelity

Read only the question, settled dependencies and explicitly relevant artifact slices. No Issue/Spec/Plan is required. For UI/flow, read design context and `policies/design.md`, following exact accepted views/components/assets. When proposing missing visual direction or selecting information hierarchy for a working interface, read `references/design-practice.md`. Logic/state work skips design resources.

Choose functional and visual fidelity independently:
- navigation/IA needs a walkable path, not necessarily polished visuals;
- visual hierarchy needs a judgeable composition, not a backend;
- behavior in an established UI needs matching presentation;
- logic/state needs a clear harness showing transitions.

One concept is enough unless the question genuinely compares alternatives; variants then differ in structure or affordance, not only color. Optional external UI guidance is bounded and verified under design practice, not a required corpus or whole gallery.

## Build the smallest honest representation

Prefer one standalone HTML file with inline CSS/JavaScript and fake data, openable without a build. Use the caller's path or a reported disposable non-source path. Do not scaffold an app, package, server, production auth or backend. If something cannot be simulated, disclose the boundary rather than implying production proof.

Related views share one mock model: mutations update every relevant list/summary. Out-of-scope controls are visibly inactive. A toast cannot substitute for a mutation. Persistence is included only if it is the question.

Make the question visible and experiment controls distinct from product navigation. A static visual request needs no invented journey; a flow needs its critical transitions and relevant recovery. A logic experiment separates its model from DOM, shows state after actions and offers an awkward scenario where useful.

Reuse accepted shell/navigation/components. A material departure is a proposed delta with reason/impact; it does not replace the baseline. Follow design policy for meaningful states, labels, keyboard access, responsive behavior and font/asset loading.

## Observe, repair and conclude

Use session capability facts from `references/capabilities.md`; consult cost policy before an optional expensive check. Generating HTML is not verifying it. When a browser is available, drive the smallest decision-relevant path: visible view/variants, critical interaction/recovery, or state transition. Fix failures and rerun that path; unresolved failures make the experiment inconclusive.

Without a browser, check file openability, visible question and relevant controls/state statically, then provide an ordered manual checklist naming the actual controls and expected outcomes. Runtime is UNAVAILABLE until driven; sufficient user-supplied evidence is cited as such. Do not infer a confident verdict from an unopened file.

Report observations, whether the hypothesis held on that path and unknowns. The caller/user owns the decision; silence is not acceptance. Leave the governing Issue/Spec/Plan unchanged. After acceptance, the authorized caller writes the decision to its owner and retains referenced HTML/assets at durable project paths using `references/visual-handoff.md`. A cache copy is insufficient for an implementation reference.

Report packet, path, relevant fidelity, lifetime (disposable by default; attached/persistent when retained), checks and verdict. Stop at the requested experiment; do not promote it into application code, commit it or start implementation.
