# Design practice for working interfaces

Load for a missing visual direction or information hierarchy in a working interface/data screen. This is advice, not product authority or a compulsory style catalogue. Reuse an accepted system first. Visual acceptance, assets and actual checks remain in `policies/design.md`.

## Start from the work

Identify who is using the view, the decision/action it supports, frequency, information volume and consequence of mistakes. Choose a hierarchy that makes the next useful action and current state apparent. A dashboard for daily reconciliation needs scanning/comparison; a first-use flow needs orientation and fewer simultaneous choices. Do not apply a landing-page composition to a workbench.

Describe one direction with a reason tied to the task, then show it on a representative composition. “Modern and clean” is not enough: say what is prominent, what is dense, how risk/status is signalled and where editing happens. Compare alternatives only for a real unresolved choice.

## Information and navigation

Separate navigation (where am I?), scope/filter (which records?), status (what is true?) and action (what can I do?). Keep location and selection stable across list/detail/edit when the task requires comparison. A summary earns its space by helping decide, not by making a row of decorative cards.

Good: overdue records and their total share the same filter and language; opening one keeps list context. Weak: a large global total above an unrelated filtered list, with the primary action hidden in navigation.

## Density and visual language

Set density from reading and manipulation needs, not an arbitrary style preset. Align comparable values and units; distinguish labels from primary values; accommodate long names, large amounts, missing data and narrow screens. A table is useful for column comparison, a list for sequential reading, cards for heterogeneous content; no form wins universally.

Choose a small, coherent palette and type hierarchy with explicit roles. Reserve emphasis for hierarchy and meaningful states. Use the product's tone: a financial workbench may prioritize calm numerical clarity; a creative board may give the canvas more space. These are rationales to adapt, not fixed industry themes.

Good: amount columns align, tabular figures aid comparison, status has text as well as color. Weak: every row has equal accent saturation, the same large padding and a status visible only through hue.

## Build a representative whole

Demonstrate the actual shell/navigation, primary data surface, editing or detail pattern and the components/states used there. A style guide showing only buttons does not explain a screen composed of filters, rows, badges, menus and validation.

Derive shared specimens from that composition: tokens/type roles, spacing rhythm and relevant component states. Keep names/values identical in specimens and the view. Do not create a complete library, token package or new component architecture unless requested.

Good: the rendered table row, filter and error field can be located in the accepted guide. Weak: polished specimens use one radius/type scale while the composed view silently invents another.

## Interaction and recovery

Show feedback at the action's location and preserve useful input after recoverable errors. Clarify destructive consequences before action; confirmation should explain affected data, not merely ask “are you sure?”. Empty, loading, error and success states are chosen for the actual journey.

Use motion to show cause or preserve orientation, not to delay frequent work. Keep controls keyboard-reachable and focus movement intentional. Responsive changes preserve the action and meaning: hiding a material column without another route to it is not a mobile solution.

## Implementation fit

For a direction that affects delivery, inspect the platform and existing component/style conventions. Explain whether reuse, a suitable library or custom components best serve the actual interaction, including token/style ownership, accessibility and meaningful motion where relevant. Keep recommendations proportional: a single existing control needs no stack discussion. With an unresolved platform, make options conditional and close a due material choice through decisions policy; do not select a web library for an unsettled native product. An HTML showcase can illustrate a candidate's conventions without installing it. Visual acceptance does not approve a dependency or technical stack.

## Use evidence selectively

Inspect existing design, actual data shapes and a small relevant source slice before adding rules. If a material design question remains, a bounded reference lookup or experiment may help. An available external UI corpus is optional: query one intent, inspect fit and provenance, and reject irrelevant results. Never load the entire corpus, install it as an assumed dependency, copy unlicensed assets or persist recommendations as accepted decisions.

Missing corpus/browser does not erase possible HTML/CSS/SVG work; disclose limits. End with a rationale that the owner can judge on the representative view, not a claim that generic guidance guarantees quality.
