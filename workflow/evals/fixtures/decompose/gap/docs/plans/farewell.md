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

Export `farewell` from `src/greet.ts` with the return the Source brief states.

## Units

### U1 — Farewell

#### Requirement references

- Source brief, Observable acceptance: `farewell("Ada")` returns `Goodbye, Ada`.
- Source brief, Relevant non-goals: Do not add any other public function.

#### Change and touchpoints

In `src/greet.ts`, add `export function farewell(name: string): string` returning ``Goodbye, ${name}``.

#### Depends on

none

#### Verification

`node --test` asserts `farewell("Ada")` is `Goodbye, Ada`. The command is `package.json` `scripts.test`.

### U2 — Empty name

#### Requirement references

- Source brief does not state this.

#### Change and touchpoints

Choose whether `farewell("")` throws or returns ``Goodbye, ``.

#### Depends on

U1

#### Verification

`node --test` asserts the chosen empty-name behavior. The command is `package.json` `scripts.test`.

## Order

U2 depends on U1.

## Coverage

| Requirement | Unit | Consequence | Evidence | Status |
|---|---|---|---|---|
| farewell("Ada") returns Goodbye, Ada | U1 | that return value | node --test | covered |
| Empty name behavior | U2 | whichever alternative is chosen | node --test | covered |

## Self-review

Implementation-ready.
