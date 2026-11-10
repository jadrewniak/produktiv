---
feature: dependency-version
issue: docs/issues/dependency-version.md
---

# Dependency version

## Goal

Keep `greet` and keep `pad-name` at `1.3.0`. Authority is `docs/issues/dependency-version.md`. No new product decision.

## Current state

`src/greet.mjs` exports `greet` and returns ``Hello, ${name}``. It does not import `pad-name`. `package.json` depends on `pad-name` at `1.3.0`. There is no lockfile.

## Target

`greet` stays as the Issue states it. `pad-name` stays at `1.3.0`. The source still does not import it.

## Units

### U1 — Keep the pin

#### Requirement references

Issue sections "Acceptance / success" and "Out of scope".

#### Change and touchpoints

No source change. No `package.json` change. `pad-name` remains `1.3.0`.

#### Depends on

None.

#### Verification

`npm test` passes. The test asserts `Hello, ${name}`.

## Coverage

| Requirement | Unit | Consequence | Evidence | Status |
|---|---|---|---|---|
| `greet(name)` returns `Hello, ${name}` | U1 | Callers get the same greeting | `npm test` | covered |
| `pad-name` stays at `1.3.0` | U1 | The pin does not move | `package.json` | covered |
| The source does not import `pad-name` | U1 | The package stays unused | `src/greet.mjs` | covered |

## Self-review

Implementation-ready. No open product decision.
