---
feature: pair-greet
issue: docs/issues/pair-greet.md
---

# Farewell and parting

## Goal

Implement `docs/issues/pair-greet.md`.

## Current state

`src/greet.ts` exports `greet(name: string): string`, which returns ``Hello, ${name}``.

## Target

Export `farewell` and `parting` from `src/greet.ts` with the returns the Issue states.

## Units

### U1 — Two greetings

This unit already separates two execution boundaries. Each has its own outcome and its own evidence. Neither consumes the other. The shared file `src/greet.ts` is not an ordering edge.

#### Farewell

##### Requirement references

- Issue, Acceptance / success: `farewell("Ada")` returns `Goodbye, Ada`.
- Issue, Out of scope: Do not add any other public function.

##### Change and touchpoints

In `src/greet.ts`, add `export function farewell(name: string): string` returning ``Goodbye, ${name}``.

##### Verification

`node --test` asserts `farewell("Ada")` is `Goodbye, Ada`. The command is `package.json` `scripts.test`.

#### Parting

##### Requirement references

- Issue, Acceptance / success: `parting("Ada")` returns `Parting, Ada`.
- Issue, Out of scope: Do not add any other public function.

##### Change and touchpoints

In `src/greet.ts`, add `export function parting(name: string): string` returning ``Parting, ${name}``.

##### Verification

`node --test` asserts `parting("Ada")` is `Parting, Ada`. The command is `package.json` `scripts.test`.

## Coverage

| Requirement | Unit | Consequence | Evidence | Status |
|---|---|---|---|---|
| farewell("Ada") returns Goodbye, Ada | U1 Farewell | that return value | node --test | covered |
| parting("Ada") returns Parting, Ada | U1 Parting | that return value | node --test | covered |
| Do not add any other public function | U1 | neither boundary adds a third export | node --test | covered |

## Self-review

Implementation-ready.
