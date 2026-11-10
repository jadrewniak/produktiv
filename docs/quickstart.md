# Quickstart

This installs Produktiv in an existing project, sets it up and walks one small change through it.

## Before you start

- One host: Claude Code, Codex or Cursor.
- Node 22 or newer for the installer. The skills themselves run without Node, but the graph, diagrams, the quality gate and the `/pk-implement` fast path need it.
- Git, if you want the fast path, gate receipts and commit trailers.
- macOS or Linux. Windows is not tested.

## 1. Install

From the root of your project, in your own terminal:

```sh
npx --yes produktiv@0.1.0 install --host claude-code --scope project --project .
```

Use `--host codex` or `--host cursor` for the other hosts. Run it yourself rather than asking the agent to: the installer writes to `~/.agents/packages/`, outside the project, and an agent's sandbox usually refuses that (`EPERM`). The installer:

- stores the release outside your repository, under your home directory;
- links the 17 `pk-` skills into the host's project skill directory (`.claude/skills/` for Claude Code, `.agents/skills/` for Codex and Cursor);
- writes `produktiv-lock.json` with the exact version and digest. Commit it so the team runs the same release.

If the skills do not show up in the host's command list, open a new session or restart the host. Codex scans `.agents/skills` both in the working directory and at the repository root, so at the root it may list each skill twice, under two labels.

## 2. Set up the project

Run `/pk-setup`. It reads your repository and asks two things: your technical level (`non-technical`, `product-technical` or `engineer`) and how much detail you want in replies. Then it writes:

| File | Shared | What it holds |
|---|---|---|
| `.workflow/config.yaml` | Yes | Where Issues, Specs and Plans live, Git policy, graph, verification and cost profile, the optional external reviewer (off) |
| `.workflow/context/project.md` | Yes | Purpose, stack, entry points, run and build pointers |
| `.workflow/context/quality.md` | Yes | The test, lint and typecheck commands your repository defines |
| `.workflow/local/preferences.yaml` | No, gitignored | Your technical level and detail |

Check `quality.md`. Setup only records commands it can confirm from your repository and runs none of them. The quality gate later runs exactly these rows, so a wrong or missing row means a wrong or missing check.

In an empty directory, `/pk-setup` instead asks about the product, users and stack, and records a greenfield foundation. It does not scaffold code.

## 3. Make a small change

Pick a small change in your own code that you can state fully, and call `/pk-implement` with the behavior and how to check it:

```text
/pk-implement <what to change, where, and to what>. <the test or command that checks it>.
```

For example, in a project whose `greet()` returns `Hello <name>` and has a test for it:

```text
/pk-implement greet() in greet.mjs returns "Hello <name>". Make it return "Hi <name>"
and update greet.test.mjs to match.
```

The request has to describe code that exists. If it does not, `/pk-implement` stops and asks where the code is, rather than building it.

With Node and Git this takes the fast path: no Plan file and no separate review. The gate sizes the change, runs the `quality.md` commands and reports `Path: fast (trivial: <files> files, <lines> lines)`. A change over the limit (3 files or 60 changed lines) stops, keeps your edits and recommends `/pk-to-plan`.

## 4. A larger change

For anything you cannot state fully, start earlier and let each command recommend the next one:

```text
/pk-discover Users want to archive projects instead of deleting them.
```

Like step 3, describe your own feature. A typical route is `/pk-discover` → `/pk-to-plan` → `/pk-review-plan` → `/pk-implement` → `/pk-code-review` → `/pk-closeout`. No command starts the next one. You can run them in one conversation or in separate sessions, because each step reads and writes durable artifacts rather than chat history. [The workflow](workflow.md) explains the stages and artifacts.

## 5. Update and uninstall

To move to a newer release, run `update` with the new version:

```sh
npx --yes produktiv@<version> update --host claude-code --scope project --project .
```

To remove Produktiv:

```sh
npx --yes produktiv@0.1.0 uninstall --host claude-code --scope project --project .
```

Uninstall removes the skill links, the installer's entries in `.gitignore`, and the skill and package directories once nothing else is left in them. It keeps `.workflow/`, your Issues, Specs and Plans, `produktiv-lock.json` and the stored release under `~/.agents/packages/`. Delete the lock yourself if you are not coming back. In Codex, restart the app if the skills are still listed afterwards.
