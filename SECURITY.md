# Security

## Reporting

Report a vulnerability privately through GitHub: open the repository's **Security** tab and choose **Report a vulnerability**. Do not open a public issue for it.

Include the version from `produktiv-lock.json`, the host (Claude Code, Codex or Cursor), the operating system and the steps that show the problem. This is a one-person project, so replies are best effort. You will get an answer before anything about the report is made public.

## Scope

These parts run code or move data, so they are in scope:

- **The installer** (`npx produktiv install`, `update`, `uninstall`): writing outside the project or the release store, following a symlink out of it, removing files it does not own, or installing a release whose digest does not match the lock.
- **The external reviewer** for `/pk-code-review`, off by default: sending code without the preview and per-run agreement, sending more than the preview showed, or leaking secrets into the request.
- **The quality gate** (`adapters/host/gate.mjs`): running a command that is not in `.workflow/context/quality.md`, or treating command output as instructions.
- **The graph and diagram runtimes**: reaching the network, or reading or writing outside the project and its `.workflow/` directory.

Out of scope: vulnerabilities in the hosts themselves, including how a host agent handles prompt injection. Report those to the host's vendor. A skill instruction that tells the agent to do something unsafe is in scope.

## Supported versions

Only the latest published release gets fixes. A fix ships as a new version, and the affected version is deprecated on npm.
