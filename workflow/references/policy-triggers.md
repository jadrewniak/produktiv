# Policy triggers

This file is not the kernel. Do not load it with `policies/kernel.md`. Load it only when the active task might call a specialist or an expensive tool. A command that forbids the operation stays forbidden. Matching a row is a check the skill performs. There is no rules engine, and there is no always-on security, dependency, or performance review.

Read `policies/cost.md` before a load this file allows. Follow that policy for the baseline and for a required spend. The row, the owning artifact, and the evidence standard stay the same.

For `/pk-review-plan`, a named track matches when that track in `agents/plan-review/v8.md` matches. This file does not restate that rubric. A command without that criteria file uses the trigger column below.

A matched row permits that load. When two rows match, load both. A match does not authorize a row that did not match.

## Loads

| Trigger | Load | Fallback |
|---|---|---|
| A current external fact would change the answer, and the repository, docs, and existing artifacts cannot supply it. Source verification is this row: correctness depends on current platform, library, or framework behavior, or model memory may be stale. | `/pk-research`, or one bounded source check inside the command that is already writing. That command then reads `policies/source-verification.md`. | Web unavailable, or the check did not run: say the live fact was not verified. Do not fill it from memory. |
| Behavior that must be felt or driven, including a user-facing screen, flow, navigation, component behavior, responsive behavior, or visual state when the open question is how it behaves. | `/pk-prototype`, passing that question. Do not pass a filled uncertainty, hypothesis, and decision-change packet. The passed question is the experiment anchor. Conversation context may clarify it, but must not replace it with another open topic. When the mode is UI/visual or interaction/flow, also read `policies/design.md` and `.workflow/context/design.md` if that context exists. | Text, and the question stays open. With no image generation, HTML or text still answers. If no artifact can be built, return the open question. Do not invent the decision. |
| A coherent visual proposal, style guide or coordinated screens/flows are required by the current authorized request. | `/pk-design`, the requested scope, `policies/design.md` and relevant accepted design pointers. | Portable HTML/CSS/SVG; disclose unavailable rendering/format operations. No false visual PASS or draft authority. |
| UI/UX. Implementation changes a user-facing screen, interaction flow, navigation, component behavior, responsive behavior, or visual state. | Relevant accepted design pointers and selected views/states. For authorized new working-interface direction or information hierarchy, `references/design-practice.md`; external guidance only for a bounded verified question, never a whole corpus. | Continue from repo and product source; missing material visual authority stays a proposed choice, not silent replacement. |
| A relationship, sequence, dataflow, or lifecycle is clearer as a picture than as prose. | `/pk-diagram`. One semantic type. | Text explanation, or a structured unavailable result. The caller continues. |
| The plan is costly to reverse. The architecture-delta track or the adversarial track matches, or the user asked. A local edit in an existing function does not. | Architecture delta may load one diagram. The adversarial trigger may load one isolated challenger. Security, dependency, and performance have their own specialist triggers. Not a panel. | Text findings. A missing diagram or challenger does not stop the command. Do not claim blast radius from a diagram that was not rendered. No subagent: apply the same criteria in the current context and say independence was weaker. |
| Security. Authentication, authorization, secrets, sensitive data, untrusted input, uploads, webhooks, permissions, or an externally exposed endpoint. | `agents/specialists/security/v2.md`. Criteria for this question. Not a scanner. | No fresh context: run that file in the current context and say so. A skip is disclosed in the same reply. If the file is absent, do not create it; judge the concern in the current context and say the specialist prompt was absent. |
| Dependencies. Adding a dependency, materially upgrading one, or changing package execution or install behavior. | `agents/specialists/dependencies/v2.md`. Cover necessity, transitive impact, scripts, health or advisories, and alternatives. | No fresh context: run that file in the current context and say so. A skip is disclosed. If the file is absent, do not create it. Do not invent an advisory. |
| Performance. A measured problem, a hard performance requirement, or a known hot path. A vague instinct does not match. | `agents/specialists/performance/v2.md`. | No fresh context: run that file in the current context and say so. A skip is disclosed. If the file is absent, do not create it. Do not optimize from vague instinct. |
| Accessibility. A user-facing UI change where accessibility behavior can be affected. | The accessibility step in `policies/design.md` when that policy is already loaded. No specialist file in v1. | The owning skill names the gap in text. A UI change does not start an audit. |
| Migration. Schema, data, or API compatibility; a framework, runtime, or dependency migration; or mixed-version behavior and rollback. | The migration track in the command's own criteria. No specialist file in v1. | Text. Do not open a migration program from this row. |

## Other expensive mechanisms

The profile changes the spend, not the meaning. The fallback is what the command reports when the load does not happen.

| Trigger | Load | Fallback |
|---|---|---|
| Acceptance or the bug is visible only at runtime, or closeout needs a critical flow. | Browser, when the host has it and the command's verification policy already asks. | Manual checklist and user evidence. Do not claim the path was verified. |
| Isolation or independence is worth the tokens. | One fresh subagent. | Current context, same criteria. Disclose weaker independence. |
| High-assurance, an explicit request, or a real specialist trigger, and a combined pass would miss a separate axis. | One extra reviewer. | One combined reviewer. |
| Closeout finds an integration gap, or project policy requires the full suite. | That broader suite. | Focused tests that are still fresh. |
| A structural question the local file read does not answer. | One scoped graph query. | Direct source and diff. |
| The owning file or convention is not yet known. | A search wide enough to find the owner. | Stop at the narrower search once the owner is found. |
