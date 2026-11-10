---
feature: dependency-version
---

# Dependency version

## Problem

Callers need `greet` to keep returning a hello string. The package pin is already chosen.

## Acceptance / success

- `greet(name)` returns `Hello, ${name}`.
- `package.json` depends on `pad-name` at `1.3.0`.
- `src/greet.mjs` does not import `pad-name`.

## Out of scope

- A newer `pad-name`.
- Using `pad-name` from the source.
- An advisory lookup, a lockfile, or a registry check.
