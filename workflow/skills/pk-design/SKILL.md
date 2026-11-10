---
name: pk-design
description: Create a coherent visual proposal, style guide or relevant screens and flows; reuse existing design and preserve accepted references. A named uncertainty experiment belongs to prototype.
---

# Design the requested visual scope

Read `policies/kernel.md`, `references/context-pack.md`, `references/capabilities.md` and `policies/design.md` through the adjacent `produktiv` link (source: `workflow/`). Read `references/artifact-resolution.md` when resolving governing artifacts, and `references/visual-handoff.md` when accepting, persisting or handing off design. No Issue, profile, Figma or image generator is required. This command produces inspectable design, not a production app or backend.

## Context

- Must load: Requested scope, relevant accepted design pointers/UI slices; `policies/design.md`, `references/capabilities.md`
- May load conditionally: design-practice for new direction/hierarchy; `references/artifact-resolution.md` for governing artifact reads; `references/visual-handoff.md` for acceptance/writeback; `references/artifact-writing.md` for Issue/Spec/Plan writeback; only needed Issue/Spec sections
- Must not load by default: Whole gallery/UI corpus, unrelated product features, all policies/reviewers, full graph, draft as accepted authority

## Frame and load

Use the user's visual/interaction objective. Read existing accepted design pointers, relevant UI/token/component slices and only needed Issue/Spec sections. An inspiration supplies desired qualities, never unrelated functionality. In brownfield reuse established vocabulary, information architecture and components; replacing them requires that request. In greenfield, broad brand qualities define a design space rather than a finished system: propose one coherent direction, rationale and representative components actually used by the requested screens/states. Ask only for material gaps not already settled; a draft does not require repeated approvals while rendering.

One strong direction is the default. Alternatives earn their place only when a real choice benefits from comparison. A tooltip may need one view; a coordinated product direction may need foundations, components and several screens. Do not require a complete library, token package or every product screen. A narrow uncertainty experiment belongs to `/pk-prototype`; do not bounce back recursively when that command routed a broad design request here.

Before building a new direction, briefly pitch the recommended hierarchy/interaction pattern, its task-specific rationale and any useful improvement to the brief. Make material delivery implications visible under design-practice; do not wait for the user to supply every design idea. Proposals remain proposals, not new product requirements.

## Build and check

For new visual direction or information hierarchy in a working interface/data screen, read `references/design-practice.md`. Tie the direction to the user's task and demonstrate the actual shell/data surface plus representative components and states. Existing accepted design remains the baseline; a logic-only question does not load this resource.

Default to portable inspectable HTML/CSS/SVG plus necessary assets, or the supported format explicitly requested. Cover the requested visual rules, meaningful states, relevant viewports and connected interactions. Use the shared design policy for visual quality and actual rendering checks. A visual-only request may use a static showcase; a requested flow must have a usable critical path with consistent mock data. State open product choices as proposals, and resolve necessary choices with the user in this conversation instead of silently adding behavior.

When a style guide is requested, show the relevant palette, type hierarchy, spacing and component states as rendered specimens using the proposed or accepted conventions. Prose explains their roles and values; it cannot be the sole demonstration. Keep the selection proportional to the requested scope, without inventing a full component library.

Use optional browser, image generation or design tools only when present and useful. SVG/existing icons suit interface symbols; raster generation may suit illustration or texture. Keep text and interactive UI as real elements. Missing optional tools do not remove requested coverage possible in HTML/CSS/SVG. Report actual format/capability limits, fonts/assets and observed fallback. A browser-unavailable output is usable creation evidence, not a visual/flow PASS. A mock flow proves no production backend.

## Accept and persist

Present the artifact and concise direction/rationale, checks and remaining choices. Viewing a draft is not acceptance. If the user already authorized accepting/applying a particular proposal, use that authorization; otherwise obtain the visual decision before changing the baseline. Existing product/system decisions remain binding.

On acceptance, retain HTML and required assets under the project's durable documentation/design convention (default `docs/design/` when absent). Apply the accepted visual handoff rules in `references/visual-handoff.md`: preserve the accepted revision/scope and decision source, stable fragment anchors and dynamic-state entry paths, and verify dependencies from the durable location. Cache cannot be the sole copy of anything referenced for implementation. Update `.workflow/context/design.md` as a compact index of the accepted artifact/scope, selected view/component/state refs, fonts/assets and exclusions; keep unaccepted revisions separate. Setup maps the baseline; design owns authorized visual baseline writeback.

Propagate accepted decisions to affected Issue/Spec/Plan sections under `references/artifact-writing.md` when this request authorizes that writeback: Issue retains behavior, Spec retains system guarantees, design retains presentation, and Plan points at exact accepted fragments. Visual acceptance never approves backend behavior. Update only affected owner sections; never turn a draft into a second PRD.

An implementation reference must identify whether the proposal is accepted or still draft. A fresh executor should retrieve the selected views/states and their assets from these pointers alone. When artifacts differ materially, chronology is not a tie-breaker: state the shell/navigation/component delta, reason, impact and proposed baseline, then obtain a concrete resolution before replacing pointers. Do not infer production implementation, Git commit, merge or deployment authorization.

## Finish

Self-review against the requested visual/flow scope, established design, actual checks and durable retrieval when accepted. Report artifact path, relevant scope, actual visual/interaction evidence, open choices and unavailable checks. When invoked as a helper, return to the caller's authorized objective; otherwise offer only a concrete unresolved next action. Production implementation and whole-feature closeout remain separate.
