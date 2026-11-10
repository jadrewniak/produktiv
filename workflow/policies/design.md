# Visual quality

Load for `/pk-design` and a UI/visual or interaction/flow `/pk-prototype`; a logic/state experiment skips it. This is shared visual guidance, not product authority or a routing engine.

## Accepted sources and scope

`.workflow/context/design.md` is a compact index of accepted principles and canonical design artifacts, exact view/fragment anchors, fonts/assets, components/states and accepted scope. Follow the relevant referenced slice; it is not the entire gallery or a separate feature specification. Existing accepted design and real UI conventions win over exploration. Reuse their palette, type, spacing, icons, vocabulary and interaction patterns. Do not silently replace an existing system. An inspiration supplies qualities, not product scope; drafts cannot change Issue/Spec authority.

Greenfield permits proposing visual direction and only the foundations/components/states/views the request needs. General brand qualities are inputs, not an already chosen presentation. `/pk-design` can create a coherent style guide; `/pk-prototype` still tests a named uncertainty and may be equally polished. Neither creates a production token package incidentally. Only explicit acceptance authorizes baseline writeback under `references/visual-handoff.md`. A material delta to accepted shell, navigation or components is named with reason/impact and remains proposed until resolved; later chronology does not override acceptance.

## Quality and assets

For practical composition guidance on working interfaces and data screens, load `references/design-practice.md` only when proposing missing visual direction or information hierarchy. It is advice, not acceptance. An available external UI source may answer a bounded question; verify relevance/provenance and never load a whole corpus or require its installation.

Start with user task, information architecture, flow and feedback, then accessibility, consistency, responsive behavior, hierarchy and visual language. Use polish/motion when they help that task. Include meaningful loading/empty/error/success states for the asked journey, rather than a compulsory catalogue. Experiment controls look like experiment chrome. A purely visual view need not invent navigation; a requested flow needs connected usable states.

Keep mock totals, entities, labels and transitions internally consistent. Related views use one state model: an operation updates the list and any summary the experiment is meant to connect. A control outside the experiment is honestly marked inactive; a success toast cannot stand in for an unimplemented mutation. Use product vocabulary, without exposing internal data representation in UI. Primary actions are labeled and keyboard-reachable; state is not conveyed by color alone. Check legibility, contrast, overflow and relevant responsive behavior. A full accessibility audit is conditional on the task, not the universal exit.

Keyboard checks include experiment controls, secondary actions and the initial focus order, not only the main product flow. Opening an artifact must not unexpectedly move focus past its entry controls; deliberate focus movement after a user action should support that action and recovery.

Reuse existing icons/components or SVG for UI symbols. Use raster assets only when they add useful imagery; never flatten readable UI or interactions into a bitmap. Record necessary asset origins/usage constraints and loading assumptions. Declare typography, verify actual font loading or disclose the observed system fallback. No image/Figma account or external corpus is required.

## Actual visual and flow checks

When a browser is available, render before claiming visual verification. Inspect task-relevant mobile/desktop widths, key states, overflow and font/asset loading. Drive the requested critical path, including material failure/recovery where requested, and verify coherent data after transitions. Correct obvious errors before a confident result. The artifact path, widths, interactions and observations are evidence; generation alone is not.

When browser or requested operations are unavailable, provide the usable artifact, static checks and exact remaining manual checklist. Mark visual/runtime checks UNAVAILABLE, never PASS from source inspection. User-supplied results remain explicitly user-supplied. Mock behavior does not prove production behavior. Stop when the requested scope is sufficiently inspected; do not launch the product suite for a design proposal.

Accepted/referenced artifacts and required assets must remain portable at durable project-owned paths; cache is not their only copy. Recheck relative links after moving them. Compact context points to precise accepted fragments so a new executor loads only its relevant views and states. Acceptance provenance, partial scope, dynamic-state retrieval and missing/conflicting-reference handling follow `references/visual-handoff.md` when persisting or consuming an implementation reference.
