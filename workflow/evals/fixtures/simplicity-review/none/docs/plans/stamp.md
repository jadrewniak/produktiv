---
feature: stamp
issue: docs/issues/stamp.md
---

# Stamp

## Goal

Add `stamp` as one function. Authority is `docs/issues/stamp.md`. No new product decision.

## Current state

`src/stamp.mjs` does not exist. No helper, config, or second module exists for this behavior.

## Target

`stamp(name)` in `src/stamp.mjs` returns `Stamp: ${name}`. One test in `src/stamp.test.mjs` asserts `Stamp: Ada`.

## Units

### U1 — Add stamp

#### Requirement references

Issue sections "Acceptance / success" and "Out of scope".

#### Change and touchpoints

Add one function `stamp` in `src/stamp.mjs`. Add one test in `src/stamp.test.mjs`. No helper, no config, no second module.

#### Depends on

None.

#### Verification

`npm test` passes. The test asserts `Stamp: Ada`.

## Coverage

| Requirement | Unit | Consequence | Evidence | Status |
|---|---|---|---|---|
| `stamp(name)` returns `Stamp: ${name}` | U1 | Callers get a display stamp | `npm test` | covered |
| One test asserts that result | U1 | The result is checked | `npm test` | covered |

## Self-review

Implementation-ready. No open product decision.
