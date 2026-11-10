# Cost

Cost is context, tool use, and output. The profile is a baseline for optional spend. It is not a ceiling, and `lean` is not a lower evidence standard.

Read `cost.profile` from `.workflow/config.yaml`. A missing profile, or a value other than the three names below, is `balanced`. Read `cost_override` from `.workflow/local/preferences.yaml` when that file exists. When the override is `lean`, `balanced`, or `high-assurance`, that value is this user's personal baseline and it replaces `cost.profile` for this user. It is not a maximum allowed assurance. `null` or any other override leaves the project profile as the baseline.

Required assurance beats the baseline. When the active command cannot meet its contract without a spend, do that spend on every profile, including `lean`. Optional assurance follows the baseline. A required spend does not rewrite `cost.profile` or `cost_override`.

A required spend is one the active command's own contract names. A specialist belongs to `/pk-code-review`, `/pk-review-plan`, or `/pk-closeout` when that command's trigger says a security, dependency, or performance boundary is real. One bounded lookup belongs to the command whose contract says correctness depends on a current external fact. A browser belongs to the command whose verification requires runtime acceptance. A broader suite belongs to `/pk-closeout` when that command has a real integration gap. This policy does not give `/pk-implement` a specialist or `/pk-research`.

The baseline changes willingness to spend on optional work. It does not change what a command means, which artifact owns a decision, or what counts as evidence.

This file is not the kernel. Load it when a command is about to spend. A justification allows an optional spend. It does not override a command that forbids the operation. It does not block a spend that command's contract requires.

## Profiles

### lean

Skip an optional subagent, browser, external research, specialist, or broader suite. Prefer the narrowest local check.

### balanced

Default. Do not browse, spawn a researcher, or widen a search because the tool exists. An optional expensive operation runs only when a justification below holds.

### high-assurance

Lower the threshold for an optional independent specialist, a runtime check, a broader suite, or a deeper review. Name the justification anyway. Do not run every expensive operation on every command.

## Expensive operations

Web research, browser automation, a broad suite, a fresh subagent, parallel research, multiple independent reviews, full end-to-end, and a deep repository audit.

An optional one of these needs a justification. A required spend from the rule above does not wait for this list. At least one of these must be true for the optional spend:

- a material uncertainty that the repository, docs, and existing artifacts cannot close
- a wrong or missing answer can change product behavior, architecture, integration, security or privacy, acceptance, or a choice that is costly to reverse
- a close call between options that are expensive to undo
- closeout needs confidence the existing slice evidence does not give
- the user explicitly asked for this spend

One current external fact that would change the answer justifies one bounded lookup. It does not justify a landscape, a second profile, or a parallel set of researchers.

Parallel researchers are a high-cost pass: several independent axes, each material, and one justification above. Related questions stay in one pass. `high-assurance` lowers the threshold for that pass. It does not make parallel research the default.

## Missing web

When web is unavailable, say that the live fact was not verified. Do not supply it from memory. The question stands. The evidence is the gap.
