---
feature: farewell
issue: docs/issues/farewell.md
---

# Farewell

## Goal

Add goodbye beside the existing greeting. Authority is the Issue acceptance. No new product decision.

## Current state

`src/greet.mjs` exports `greet(name)`, which returns `Hello, ${name}`. `src/greet.test.mjs` covers that return value.

## Units

### U1 — Add farewell

#### Requirement references

Issue sections "Acceptance / success" and "Out of scope".

#### Change and touchpoints

Add `farewell` in `src/greet.mjs`, next to `greet`, using the same string style. Add one test in `src/greet.test.mjs`.

#### Depends on

None.

#### Verification

`node --test` passes, and the new test asserts `Goodbye, ${name}`.

## Coverage

| Requirement | Unit | Consequence | Evidence | Status |
|---|---|---|---|---|
| farewell returns `Goodbye, ${name}` | U1 | Callers can say goodbye | `node --test` | covered |
| One test asserts that return value | U1 | The new behavior is checked | `node --test` | covered |

## Self-review

Implementation-ready. No open product decision.
