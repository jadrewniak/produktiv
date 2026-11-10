# Consolidation source checks

Run `node workflow/evals/run.mjs consolidation`. These checks validate resource references, example identity compatibility and the installed gh command parser (offline help). They do not simulate conversations or prove that an agent will follow instructions.

The delivery-hardening suite additionally builds and moves the real release, installs into an isolated consumer, compares the new shared resources and exercises graph dependencies without the build checkout. Run it with Node 22 or newer.

Examples in artifact-format are fictional scope-specific documents, not generated behavior evidence.
