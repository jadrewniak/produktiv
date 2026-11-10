---
feature: farewell-pair
---

# Farewell and parting

## Goal

Add farewell and parting beside greet. The route is Source brief.

## Source brief

- **Requested behavior:** Add `farewell(name: string)` beside `greet`, returning ``Goodbye, ${name}``. Add `parting(name: string)` beside `greet`, returning ``Parting, ${name}``.
- **Observable acceptance:** `farewell("Ada")` returns `Goodbye, Ada`. `parting("Ada")` returns `Parting, Ada`.
- **Relevant non-goals:** Do not add any other public function.

## Current state

`src/greet.ts` exports `greet(name: string): string`, which returns ``Hello, ${name}``.

## Target

Export `farewell` and `parting` from `src/greet.ts` with the returns the Source brief states.

## Units

### U1 — Farewell

#### Requirement references

- Source brief, Observable acceptance: `farewell("Ada")` returns `Goodbye, Ada`.
- Source brief, Relevant non-goals: Do not add any other public function.

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

- Source brief, Observable acceptance: `parting("Ada")` returns `Parting, Ada`.
- Source brief, Relevant non-goals: Do not add any other public function.

#### Change and touchpoints

In `src/greet.ts`, add `export function parting(name: string): string` returning ``Parting, ${name}``.

#### Depends on

none

#### Consumes / Produces

none

#### Verification

`node --test` asserts `parting("Ada")` is `Parting, Ada`. The command is `package.json` `scripts.test`.

## Coverage

| Requirement | Unit | Consequence | Evidence | Status |
|---|---|---|---|---|
| farewell("Ada") returns Goodbye, Ada | U1 | that return value | node --test | covered |
| parting("Ada") returns Parting, Ada | U2 | that return value | node --test | covered |
| Do not add any other public function | U1, U2 | neither unit adds a third export | node --test | covered |

## Self-review

Implementation-ready.
