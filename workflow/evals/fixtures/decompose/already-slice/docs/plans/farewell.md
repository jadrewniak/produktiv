---
feature: farewell
issue: docs/issues/farewell.md
---

# Farewell

## Goal

Implement `docs/issues/farewell.md`.

## Current state

`src/greet.ts` exports `greet(name: string): string`, which returns ``Hello, ${name}``.

## Target

Export `farewell` from `src/greet.ts` with the return the Issue states.

## Units

### U1 — Farewell

#### Requirement references

- Issue, Acceptance / success: `farewell("Ada")` returns `Goodbye, Ada`.
- Issue, Out of scope: Do not add any other public function.

#### Change and touchpoints

In `src/greet.ts`, add `export function farewell(name: string): string` returning ``Goodbye, ${name}``.

#### Depends on

none

#### Consumes / Produces

none

#### Verification

`node --test` asserts `farewell("Ada")` is `Goodbye, Ada`. The command is `package.json` `scripts.test`.

## Coverage

| Requirement | Unit | Consequence | Evidence | Status |
|---|---|---|---|---|
| farewell("Ada") returns Goodbye, Ada | U1 | that return value | node --test | covered |
| Do not add any other public function | U1 | no third export | node --test | covered |

## Self-review

Implementation-ready.
