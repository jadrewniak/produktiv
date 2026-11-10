---
feature: farewell
---

# Farewell

## Goal

Add farewell beside greet. The route is Source brief.

## Source brief

- **Requested behavior:** Add `farewell(name: string)` beside `greet`, returning ``Goodbye, ${name}``.
- **Observable acceptance:** `farewell("Ada")` returns `Goodbye, Ada`.
- **Relevant non-goals:** Do not add any other public function.

## Current state

`src/greet.ts` exports `greet(name: string): string`, which returns ``Hello, ${name}``.

## Target

Export `farewell` and `wave` from `src/greet.ts`.

## Units

### U1 — Farewell and wave

#### Requirement references

- Source brief requested behavior and observable acceptance.
- Source brief non-goal: do not add any other public function.

#### Change and touchpoints

Add `export function farewell(name: string): string` returning ``Goodbye, ${name}``.
Add `export function wave(name: string): string` returning ``Wave, ${name}``.

#### Depends on

none

#### Verification

`node --test` asserts `farewell("Ada")` is `Goodbye, Ada` and `wave("Ada")` is `Wave, Ada`. The command is `package.json` `scripts.test`.

## Coverage

| Requirement | Unit | Consequence | Evidence | Status |
|---|---|---|---|---|
| farewell("Ada") returns Goodbye, Ada | U1 | that return value | node --test | covered |
| Do not add any other public function | U1 | wave is also exported | node --test | covered |

## Self-review

Implementation-ready.
