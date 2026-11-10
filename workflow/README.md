# Produktiv Workflow

Produktiv is a self-contained Agent Skills workflow for taking a product change from an unclear request through discovery, design, planning, implementation, review and closeout. This package holds one immutable release: 17 skills with shared policies, templates, fixed reviewer criteria, a structural code-graph adapter and an offline diagram renderer.

The skill list, the quickstart and when not to use Produktiv are in the [source repository](https://github.com/jadrewniak/produktiv#readme).

## Runtime and installation boundary

The installer registers the canonical skills for Claude Code, Codex or Cursor and resolves an immutable release outside the target repository. A project pins an exact version and digest in `produktiv-lock.json`. Package updates and uninstall preserve project-owned `.workflow/` state and product artifacts.

The skills are independent entrypoints with recommendations between lifecycle stages. They do not form an orchestration daemon, and no command automatically starts the next stage.

The installed core workflow runs in the host agent and does not require Node or Git. Optional local capabilities have separate floors:

- structural graph: Node 22 or newer, Git and the bundled graph runtime;
- diagram rendering: Node 18 or newer and the bundled diagram runtime;
- quality gate: Node 18 or newer; its receipts and the `/pk-implement` fast path also need Git.

Missing or broken optional capabilities must degrade only their dependent path. The installer itself requires Node 22 or newer; that is separate from workflow runtime requirements.

## Platforms

- macOS: distribution accepted on Claude Code, Codex and Cursor.
- Linux: covered by CI and the install smoke test, without an independent v1 acceptance run.
- Windows: not tested. Windows graph and diagram support is not claimed.

## Upstreams, inspiration and licenses

The structural graph runtime adapts the MIT-licensed [Understand Anything](https://github.com/Egonex-AI/Understand-Anything). The diagram runtime adapts the MIT-licensed [Archify](https://github.com/tt-a1i/archify). Their license and third-party attribution files are shipped beside the corresponding installed runtime, including grammar licenses and the JetBrains Mono OFL text.

Produktiv also borrows workflow mechanisms and design/review ideas from the pinned Matt Skills, Addy Agent Skills, Superpowers, Ponytail, Caveman, UI UX Pro Max and Taste projects. They are credited inspirations, not installed runtime dependencies or sources of authority for Produktiv behavior. Exact repositories, commits and licenses are recorded in [`UPSTREAMS.yaml`](https://github.com/jadrewniak/produktiv/blob/main/docs/upstream/UPSTREAMS.yaml) and [`PROVENANCE.md`](https://github.com/jadrewniak/produktiv/blob/main/docs/upstream/PROVENANCE.md).

No automatic upstream updater is included. Promoting a new upstream revision requires an explicit provenance and integration review.
