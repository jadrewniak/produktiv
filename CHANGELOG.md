# Changelog

All notable changes are listed here. Versions follow [Semantic Versioning](https://semver.org/). While the version is 0.x, a minor release may change behavior.

## 0.1.0 — 2026-11-11

First public release. The [acceptance record](docs/acceptance/0.1.0.md) lists what was run for this release and what it does not cover.

- 17 `pk-` skills for Claude Code, Codex and Cursor: setup, discovery, research, prototype, design, diagram, Spec, Plan, Plan review, decomposition, implementation, code review, simplicity review, debugging, closeout, handoff and explanation.
- Installer on npm (`npx produktiv install`, `update`, `uninstall`) that pins an immutable release by version and digest in `produktiv-lock.json` and keeps `.workflow/` state on update and uninstall.
- Quality gate for `/pk-implement`, running the project's own test, lint and typecheck commands, with a fast path for small, fully stated changes.
- Versioned reviewer criteria with reproduction of material findings, and an optional external reviewer for `/pk-code-review`, off by default.
- Commit trailers that link commits back to Plan units and Tickets.
- Optional structural code graph and offline diagram renderer.
