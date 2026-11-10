# Verification

Select the cheapest meaningful evidence that can show the slice behaves as the requirements cited by the Plan require. A test is evidence. It is not the only evidence, and a green test is not completion by itself.

Project conventions and `quality.md` choose the command. This policy chooses how strong the check must be. Do not invent a second test framework, a coverage threshold, or a suite the repository does not already run.

## Command source

A typecheck, lint, test, or CI command comes from the matching row in `.workflow/context/quality.md`. When that row is absent, a bounded lookup may confirm it: read the manifest, task runner, build config, or CI definition that defines that command, then stop. A lockfile may confirm the package manager or a version. It does not define a test, lint, typecheck, or CI command. Use the command only after that confirmation. A `package.json` script is invoked as `<package-manager> run <name>`, the same canonical form `/pk-setup` records. Do not invent a command. Do not shorten a package script to `<package-manager> <name>`.

A narrower check the Plan already names, such as one test file, stays that check. When it is a package script plus arguments, the script invocation still comes from the matching row.

## Planned definitions for new checks

A greenfield/new check may be designed before it exists, separately from existing command provenance. The Plan must name its producing unit, intended defining manifest/script/config and invocation, prerequisites (including manager/runtime where needed), and expected contract-exact observable. The producer creates the actual definition and evidence seam before a consumer treats it as confirmed. Planned command, planned coverage and planned readiness are neither an existing command nor a PASS; a guessed missing existing script is not this branch.

During execution read the actual producer definition and confirm prerequisites before running; if it differs from the route, reconcile the affected Plan/dependencies rather than executing a guessed invocation. Once a new definition exists, refresh the actual definition row in quality context where appropriate, with its source; never write run results there. Report BLOCKED for a required consumer check whose producer is absent. An intentional runtime/manual check still needs its actual observable and capability, rather than a fabricated script.

## What to run

| Changed behavior | Default evidence |
|---|---|
| Isolated stable logic | The project's focused test at that seam |
| Storage, module, process, or service boundary | The project's integration or contract check at that boundary |
| A critical user journey that this slice owns | The smallest runtime path that covers it |
| Layout or trivial wiring | Typecheck, build, an existing check, or a manual look, whichever can actually show the change |
| A bug with a stable reproduction | A regression test at that seam |
| A behavior-preserving refactor | The same check, before and after |

Run the focused check during implementation. A broader feature suite belongs to `/pk-closeout` when `verification.full_suite` is `closeout`. Do not run it per slice for reassurance.

Test-first is optional. Use it when a failing check is the cheapest way to pin a stable contract. It is not required before an edit.

Prefer a result that is still current. Reuse it only when the tree matches the run. After a fix, rerun the checks that the fix can change. Do not rerun an unchanged check to feel sure. A gate receipt (`adapters/host/gate.mjs`) binds a quality row's result to the working-tree hash and the command text, and stays current only while both match. It covers the quality rows, not runtime or real-boundary requirements.

Match evidence to the actual boundary, not to a convenient helper. Persistence requires a real application-boundary write/read and, when durability is claimed, survival across the relevant restart plus isolation between required contexts. Authentication requires the real session/identity boundary and foreign-access refusal. Object storage requires the actual object boundary and required recovery. Separate producer/consumer checks do not replace integration evidence. A build, helper test or in-memory demonstration cannot prove a durable backend.

Do not weaken a test, a threshold, a checker, or a suppression to manufacture a pass.

## Results

Keep these results distinct:

- PASS — the check ran and showed the required behavior
- FAIL — the check ran and did not
- UNAVAILABLE — the check is the right one, and evidence does not exist yet. It stays UNAVAILABLE until sufficient evidence exists. User-supplied evidence can satisfy it afterward; cite that source. Citing it does not claim the agent ran the check.
- BLOCKED — the check cannot be run until something named is resolved

Cite the command and the result in the session. Do not claim a check that did not run. Do not write that result into `quality.md`. A user-supplied runtime result is cited as user-supplied, not as a check the agent ran. Evidence sufficiency ends checking for that result; it does not end a wider selected execution boundary.

## Browser and runtime

Use a browser or other runtime only when the behavior is user-visible or otherwise not provable more cheaply, and at least one of these is true:

- the Plan requires it
- this slice's acceptance is that runtime behavior
- integration or a runtime-only failure is a material risk for this slice
- a critical user journey belongs to this slice
- the user explicitly asks

`verification.browser: conditional` means that rule. It does not mean every slice, every frontend edit, or every unit that already has a test.

The capability must exist in this session before the agent runs the flow. When the behavior needs a runtime and this session cannot run it, write the smallest manual checklist and mark the result UNAVAILABLE until evidence exists. Do not claim the flow was personally verified. If the user runs that checklist and supplies sufficient evidence, the requirement can pass on that evidence. Cite it as user-supplied. That citation is not a claim that the agent verified the runtime.

`/pk-implement` runs that runtime once when the slice's own acceptance needs it. `/pk-closeout` repeats it only when later integration makes the earlier result stale. An isolated function proved by the project's test does not use a browser.
