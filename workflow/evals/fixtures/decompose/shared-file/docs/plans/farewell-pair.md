---
feature: farewell-pair
issue: docs/issues/farewell-pair.md
---

# Farewell and parting

## Goal

Implement `docs/issues/farewell-pair.md`.

## Current state

`src/greet.ts` exports `greet(name: string): string`, which returns ``Hello, ${name}``.

## Target

Export `farewell` and `parting` from `src/greet.ts` with the returns the Issue states.

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

### U2 — Parting

#### Requirement references

- Issue, Acceptance / success: `parting("Ada")` returns `Parting, Ada`.
- Issue, Out of scope: Do not add any other public function.

#### Change and touchpoints

In `src/greet.ts`, add `export function parting(name: string): string` returning ``Parting, ${name}``.

#### Depends on

U1, because both units edit `src/greet.ts`.

#### Consumes / Produces

none

#### Verification

`node --test` asserts `parting("Ada")` is `Parting, Ada`. The command is `package.json` `scripts.test`.

## Order

U2 lists U1 because both edit `src/greet.ts`. Neither unit consumes an export, a file, or a schema the other produces.

## Coverage

| Requirement | Unit | Consequence | Evidence | Status |
|---|---|---|---|---|
| farewell("Ada") returns Goodbye, Ada | U1 | that return value | node --test | covered |
| parting("Ada") returns Parting, Ada | U2 | that return value | node --test | covered |
| Do not add any other public function | U1, U2 | neither unit adds a third export | node --test | covered |

## Self-review

Implementation-ready.
