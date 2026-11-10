# Capabilities for this session

Core workflow uses host tools; it requires no Node process. Evaluate capabilities afresh on every invocation. Never persist availability in config, preferences or context, and never infer it from an earlier setup.

Host/tool inventory supplies `web`, `browser`, `subagents`, `fileWrite`, `shell`, and `issues`. Available file-edit tools establish `fileWrite`; available shell tools establish `shell`. An absent or inaccessible tool is not available. GitHub access is a capability, not authorization to mutate an Issue. A local artifact write requires fileWrite; without it, report intended output without claiming it was saved. GitHub Issue/Ticket writes may use issues independently of fileWrite.

## Bounded runtime discovery

Use explicit host facts first. If the host reports Node/Git absent, do not probe that binary. If it reports a known version, use it. When a fact is missing and shell is available, a bounded binary lookup is allowed: `command -v node` / `command -v git` (Windows equivalent when appropriate), followed by `node --version` / `git --version` only for a found binary. Do not scan the filesystem for alternate runtimes, install software, or rewrite PATH. If discovery fails, disclose unconfirmed availability; unknown is neither absent nor a passing version floor.

Once Node presence is established, the optional `adapters/host/capabilities.mjs` `probe()` can refine version, Git and package-marker facts. It runs on Node; it cannot discover Node absence. In this source checkout it accepts a root containing `workflow/`; its default resolves the package's parent. It does not inspect project policy. Explicit host facts take priority over inferred facts.

When the detected version differs from the user's terminal or project requirement, report the executable path and version observed in this tool shell separately from `.nvmrc`/manifest requirements. A declared Node 22 requirement does not prove this process runs Node 22. Explain the environment mismatch before recommending an upgrade; do not persist session runtime facts as project stack decisions or silently change the environment.

## Repository and Issues discovery

Observe these independently: Git working-tree existence, remote identity, whether `HEAD` exists, graph eligibility, Issue read access and Issue write authorization. Missing `HEAD` limits history/graph operations; it does not make the repository or its remote disappear.

Prefer a host Issues connector when one exists. Derive the intended repository from an unambiguous configured remote or an explicit user/config reference, then verify that exact repository through the connector. Connector presence without successful repository read is not access.

When no Issues connector is available and shell is available, setup may use this bounded fallback:

1. read configured remotes without requiring `HEAD`;
2. resolve exactly one intended `OWNER/REPO`, or report remote ambiguity;
3. run `command -v gh`;
4. only when found, run `gh repo view OWNER/REPO --json nameWithOwner,url` (repository is a positional argument, not a `--repo` flag).

Classify failure as one of: no remote, ambiguous remote, tool absent, authentication missing, repository access denied, network failure, or other reported read failure. Do not collapse these into “GitHub unavailable.” A successful repository read proves read access only. Write access is known only from an authorized write; a failed write reports its own reason and uses the configured local fallback without rewriting project policy.

Do not install or authenticate a CLI, initialize Git, create a repository/commit, or change remotes to improve detection. `artifacts.issues` and `git.workflow` remain independent. `adapters/host/capabilities.mjs` stays an optional Node/engine probe and is not a GitHub client.

## Optional engines

Resolve resources through the installed skill's adjacent `produktiv` link, or `workflow/` in this checkout. A broken package link is `missing-package`; it does not stop unrelated core work.

- **Graph:** Node >=22, Git available, and `vendor/understand-anything/dist` directory or `vendor/understand-anything/BUNDLE_OK` file. Known version below floor → `node-floor`; absent Git → `git-unavailable`; missing marker after floors pass → `missing-runtime`.
- **Diagram:** Node >=18 and `vendor/archify/renderers/architecture/render-architecture.mjs`. Below floor → `node-floor`; missing renderer → `missing-runtime`. Git is unnecessary.

- **Gate:** Node >=18 and `adapters/host/gate.mjs`. Below floor → `node-floor`; missing adapter → `missing-runtime`. Without Git it still runs but keeps no receipt, and `trailers` is unavailable. It runs only quality-context commands, through the agent's shell, and installs nothing.

Unconfirmed Node major leaves every engine unconfirmed. Node 18–21 may enable diagram while graph remains unavailable. No engine installs Node/Git. A marker establishes runtime presence, not success of an operation: accept only the adapter's actual result.

Availability, project policy (`graph.enabled`) and local preference (`graph_opt_out`) are independent. All must allow optional graph use; a later available runtime never changes stored policy. A capability existing does not select it for the current command.

## Visual operations

Check browser, image generation and supported design-format tools from the current tool inventory/access. A Figma connection or image generator is optional; no shell scan, installation or persisted capability flag is needed. Tool presence does not prove successful render, interaction, font loading, generation or export. Record the actual operation result and unavailable checks. HTML/CSS/SVG remains a portable fallback; source inspection alone cannot prove visual quality.
