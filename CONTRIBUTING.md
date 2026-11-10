# Contributing

Thanks for looking. Produktiv is a small project, so open an issue before a larger change to check that it fits.

## Set up

Node 22 or newer and Git. Install the vendored graph runtime dependencies once after cloning:

```sh
npx --yes pnpm@12.16.1 --dir workflow/vendor/understand-anything install --frozen-lockfile --ignore-scripts
```

## Check

```sh
node workflow/evals/run.mjs --all
```

```sh
sh scripts/smoke-npm-install.sh
```

The first runs every eval suite offline. Pass a suite name instead of `--all` to run one. The second packs this checkout and installs, updates and uninstalls it through the real `skills` CLI on all three hosts; it needs network access. `PRODUKTIV_SMOKE_SPEC=produktiv@<version>` runs the same check against the npm registry. CI runs both on Ubuntu and macOS.

## Layout

| Path | What it is |
|---|---|
| `workflow/skills/` | The 17 `pk-` skills |
| `workflow/policies/`, `workflow/references/` | Shared rules the skills load |
| `workflow/templates/` | Templates for `.workflow/` files and artifacts |
| `workflow/agents/` | Reviewer criteria, versioned |
| `workflow/adapters/`, `workflow/graph/`, `workflow/vendor/` | Gate, graph and diagram runtimes |
| `workflow/scripts/` | Installer, release and npm packaging |
| `workflow/evals/` | Eval suites and fixtures |
| `docs/upstream/` | Upstream pins and provenance |

## Changing skills and policies

- **Instruction size is budgeted.** The `budget` suite fails when skills, policies or references grow past the limit in `workflow/evals/budget/budget.json`. If your change needs more words, raise the limit in the same PR and say why. A rule a script can check belongs in the script, not in prose.
- **Show behavior, not wording.** A test that matches text guards wording. If you change how the agent behaves, describe a real run that shows it, or say plainly that you did not run one.
- **Reviewer criteria are versioned.** Changing a rubric means a new version file, for example `v5.md` after `v4.md`, and the skills point to it. The old file leaves the tree at the next release; each release's receipts point to the version in its own package.
- **No claims of superiority** over other tools in docs or skills.
- **Upstream content** must keep a license compatible with MIT and be recorded in `docs/upstream/`.

## Pull requests

PRs are squash-merged. Describe what changed, how you checked it and the net word change to skills, policies and references. Commit messages follow `type(scope): summary`.
