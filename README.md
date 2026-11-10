# Produktiv

**Build better products with coding agents.**

Produktiv brings selected ideas and practices together in one toolkit. Its skills offer entry points for exploring a problem, shaping a solution, building it, and checking the result. They can help you make decisions explicit, turn ideas into actionable work, and carry useful artifacts between stages.

It runs inside Claude Code, Codex, and Cursor.

## Why Produktiv exists

A coding agent can write code, but a useful change also needs a clear problem, decisions that hold together, a workable plan, and a review of the result. As work grows, keeping those pieces connected across conversations and tools can become a job of its own.

Produktiv is a curated collection of Agent Skills for that work. It helps you take a product change from an unclear request through discovery, design, planning, implementation, review, and closeout, or use just the part you need.

## Get started

The installer requires Node 22 or newer. Choose your coding agent and run its command in your project.

**Claude Code**

```sh
npx --yes produktiv@0.1.0 install --host claude-code --scope project --project .
```

**Codex**

```sh
npx --yes produktiv@0.1.0 install --host codex --scope project --project .
```

**Cursor**

```sh
npx --yes produktiv@0.1.0 install --host cursor --scope project --project .
```

Then open your agent in the project and start with:

```text
/pk-setup
```

The installer places an immutable release outside your repository and pins its exact version and digest in `produktiv-lock.json`.

To remove the package, run the same command with `uninstall`. Your `.workflow/` state and product artifacts are preserved. The [quickstart](docs/quickstart.md) covers setup, a first change, and updates.

## Explore the skills

| Area | Skills |
|---|---|
| Set up | `/pk-setup` |
| Understand | `/pk-discover`, `/pk-research`, `/pk-prototype`, `/pk-explain`, `/pk-diagram` |
| Design and plan | `/pk-design`, `/pk-to-spec`, `/pk-to-plan`, `/pk-review-plan`, `/pk-decompose` |
| Build and review | `/pk-implement`, `/pk-debug`, `/pk-code-review`, `/pk-simplicity-review` |
| Finish | `/pk-closeout`, `/pk-handoff` |

Each skill is an independent entry point. [The workflow guide](docs/workflow.md) explains the stages, the artifacts they write, and the checks between them.

## Cost

Skills read workflow instructions, and review adds further work, so a structured run can use noticeably more tokens and time than working directly with your agent. Choose the amount of structure that fits the task. 

See [costs and trade-offs](docs/costs.md) for details.

## Compatibility

Produktiv supports **Claude Code, Codex, and Cursor**. macOS has been accepted on all three hosts. Linux runs in CI and the installation smoke test, although it has not had a separate acceptance run. Windows has not yet been tested; the graph and diagram runtimes are not supported there.

See [`workflow/README.md`](workflow/README.md) for runtime requirements for optional capabilities.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) to contribute. Report security issues privately, as described in [SECURITY.md](SECURITY.md). Changes are listed in [CHANGELOG.md](CHANGELOG.md).

## License and credits

[MIT](LICENSE).

Bundled runtimes keep their own licenses, shipped beside them. Upstream sources and credits are in [`docs/upstream/PROVENANCE.md`](docs/upstream/PROVENANCE.md).
