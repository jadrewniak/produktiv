---
name: pk-setup
description: Map an existing project or establish a greenfield foundation, configure workflow, and onboard the user.
---

# Set up the project

Use the repository root, or the selected empty directory before Git exists. Read the package's `policies/kernel.md`, `references/context-pack.md`, `references/capabilities.md`, `references/state-layout.md`, and the templates needed below. Installed resources are under the adjacent `produktiv` link; source resources are under `workflow/`.

## Context

- Must load: Current repository/conventions or confirmed greenfield foundation; communication preferences; `references/capabilities.md`, `references/state-layout.md`; templates needed for actual setup outputs
- May load conditionally: Accepted design/canonical docs and bounded source checks; graph-use only for permitted structural baseline; decisions for material foundation choices
- Must not load by default: Product-wide Issue/Spec/Plan bodies, all templates, reviewers, full graph, prior context snapshots as current evidence

## Refresh and detect

Every invocation inspects current root/nested instructions, README, manifests, lockfiles, workspace boundaries, entry points, CI, verification configuration, Git/remotes, and canonical architecture/domain/design docs. Read narrowly; do not copy whole documents. Detect Git repository, remote identity and `HEAD` independently: a repository with a remote but no first commit is still a Git/GitHub repository; only history and graph work that requires `HEAD` is unavailable. Existing `.workflow/context/project.md` and `quality.md` are previous snapshots, not evidence of current mechanics. Refresh their repository facts and pointers. Preserve confirmed durable decisions in `domain.md` and `design.md` unless authoritative evidence contradicts them or the user changes them; failure to rediscover a source does not erase a decision.

Preserve shared policy and local preferences. Availability is observed afresh in this session using `capabilities.md`; never persist it as project policy. Missing Node, Git, graph, browser or Issues access does not block core setup. When host facts omit Node/Git and shell exists, use the bounded discovery in that reference. For Issues, follow its connector-first and exact-repository `gh` fallback. Report tool/auth/permission/network/remote failures separately; never create a commit, install/login a CLI or change policy as a probe.

Source, manifests, or documentation describing a working system select **existing** mode. An empty directory or a product brief without an implemented system selects **greenfield**. Do not invent a stack from the brief. If a previous greenfield foundation now has application source, refresh to existing mode while preserving confirmed foundation decisions.

## Onboard on every invocation

Always ask the user's technical level, including repeat setup. Offer `non-technical` (product outcomes), `product-technical` (components and flow), and `engineer` (symbols, contracts, evidence); show the saved value when present and let the user confirm or change it. Do not silently accept a saved value or a template default. Continue independent inspection while waiting, but do not claim onboarding complete before the answer.

On first setup, also ask preferred response detail (`concise`, `balanced`, `detailed`), unless already explicitly supplied. Preserve it on later runs unless changed. These values affect presentation, never the assurance floor.

Do not ask for a token/cost profile. Keep `cost.profile` and local `cost_override` manually editable, preserving existing values and using the template when absent. A null override inherits project policy.

## Existing project

Summarize purpose, actual stack, application boundaries, source entry points, canonical documentation, confirmed domain terms, and existing design conventions. Executable configuration defines mechanics; project docs/ADRs define intent. Report conflicting sources instead of merging them. Do not redesign the application or its design system.

Confirm quality invocations from current repository definitions without running them. For package scripts, confirm the manager from `packageManager`, a single lockfile, or documented CI/instructions. Conflicting or absent manager evidence leaves the invocation unconfirmed. Use `<manager> run <script>` even when shorthand works; cite `<package>/package.json#scripts.<script>`. Other task runners retain their defined invocation and source key/job. A lockfile defines no command.

Write `quality.md` using `templates/quality.md`: Purpose, Command, Source. Include defined test subsets, lint, typecheck and aggregate CI; omit missing purposes and unconfirmed rows. Rewrite stale rows. Keep dev/start/build definitions as relevant run/build pointers in `project.md`, separate from quality results. Include a Definition of Done only if the repo defines it. Setup records definitions, not PASS/FAIL, and runs no application checks.

## Greenfield foundation

Use the brief and settled conversation first, then ask only unresolved foundation choices:

- target users, problem, intended outcome and core flows;
- high-level domain terms, constraints, integrations and non-goals;
- roadmap/backlog themes, without discovering every feature;
- chosen stack, or an explicitly deferred stack choice; give bounded alternatives when a choice is needed;
- brand/design direction when user-facing work makes it relevant;
- Git/repository intent, artifact storage and working conventions not already determined.

Questions follow the actual gaps, not a fixed questionnaire. Summarize resolved foundation for confirmation; correct only the disputed points. Write confirmed foundation into `project.md` (purpose, users, flows, constraints/non-goals, opportunity/increment map, stack decisions/deferred choices and pointers). Reusable confirmed terms/design decisions belong in their context owners. A deferred stack/foundation choice names its owner and the latest safe trigger: before the first dependent Spec or Plan. “Later in discovery or planning” without that closure condition is not enough. Unanswered questions remain a compact frontier in the reply; do not write guesses or pretend a stack/check exists. A meaningful incomplete foundation may be saved, but report it as incomplete.

Distinguish a focused first feature from a first coherent product version. Preserve a compact map of product opportunities, not a single hidden first choice. Assess first-use journeys and material states, data/privacy and integrations alongside the foundation choices above; do not reduce a broad brief to an arbitrary isolated screen. Foundation records broad accepted choices and pointers, not a product-wide PRD. When a material foundation uncertainty needs evidence, use a bounded research, prototype, design or diagram helper selected by the unknown; no tool quota. Engineer presentation explains technical tradeoffs without assigning implementation contracts during onboarding. Later discovery updates only changed choices and pointers, so the saved baseline remains recoverable rather than frozen at first setup.

Set `project.mode: greenfield`. Do not scaffold the application, initialize Git, create a remote, install dependencies, or produce a product-wide Issue, Spec or Plan. Foundation stops before feature discovery. Recommend the earliest unresolved responsibility for the first feature, normally `/pk-discover`; a fully decided small change can go to `/pk-to-plan`. If ending mid-foundation, summarize the unresolved frontier in the reply. Recommend `/pk-handoff` only when material transient state would otherwise be lost; it writes confirmed decisions to their owners first and may correctly create no file. Do not write a handoff automatically from setup.

## Configure and write

Use `templates/config.yaml` and `templates/preferences.yaml`. Existing choices persist. For missing Git/artifact policy, use unambiguous documented conventions; otherwise ask a focused working-choice question, with a safe recommendation (`git.workflow: none` when Git is absent or the user wants manual Git). Explain that `current-branch` authorizes a verified implementation commit, not push/merge. GitHub storage requires an unambiguous intended repository and successful current read capability; write capability is not inferred. Local Markdown is the operation fallback, not a reason to rewrite `artifacts.issues`. Ordinary `docs/*` paths are appropriate when no convention exists. Missing optional choices may retain a disclosed safe default; technical-level confirmation is mandatory.

When this session permits `fileWrite`:

1. Add absent rules from `templates/gitignore-workflow.txt`, preserving existing rules. Shared config/context remain shareable; local preferences, graph, cache and handoff are ignored.
2. Write `.workflow/config.yaml`, `context/project.md`, `context/quality.md` and `local/preferences.yaml` under `.workflow/`. Use templates; remove instructional comments and omit unsupported optional sections. An empty greenfield quality Commands table reports no confirmed commands. Keep technical level/detail/cost override out of shared config, and host availability out of all these files.
3. Reconcile `context/domain.md` and `context/design.md` with the preservation rule above. Omit/remove a file only when neither confirmed facts nor preserved decisions remain.
4. In an existing Git project only, when graph availability, policy and local preference allow it, call `adapters/graph/index.js` `ensure_fresh(projectRoot, undefined, "/pk-setup")` once for committed HEAD. Failure falls back to files. Greenfield without source/HEAD does not build a graph. Never infer domain meaning from graph structure or invoke the diagram renderer during setup.

Without file-write capability, report the intended files and limitations; do not claim initialization. Do not modify agent instruction files or install Node/Git.

## Finish

Self-check mode, source provenance, preserved decisions, required onboarding answer, and shared/local separation. Report mode, stack or deferred choices, working conventions, written files, quality/run pointers, unresolved questions and unavailable optional capabilities. On first setup, show the delivered command map from `references/commands.md` with brief purposes; later setup reports changes without repeating the whole map.

Recommend one next command and why. Explain that commands can run separately or in the same conversation; the sequence is guidance. Do not start the next command or create a status ledger.
