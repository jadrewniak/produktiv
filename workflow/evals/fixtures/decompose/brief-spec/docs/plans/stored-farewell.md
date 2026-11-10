---
feature: stored-farewell
spec: docs/specs/stored-farewell.md
---

# Stored farewell

## Goal

Add farewell beside greet. The route is Source brief. The store is the Spec.

## Source brief

- **Requested behavior:** Add `farewell(name: string)` beside `greet`, returning ``Goodbye, ${name}``.
- **Observable acceptance:** `farewell("Ada")` returns `Goodbye, Ada`.
- **Relevant non-goals:** Do not add any other public function.

## Current state

`src/greet.ts` exports `greet(name: string): string`, which returns ``Hello, ${name}``. It writes no file.

## Target

`farewell` writes ``Goodbye, ${name}`` to `farewells.json` under that name. A later call with the same name returns the stored line and does not write again.

## Units

### U1 — Store the farewell

#### Requirement references

- Source brief, Observable acceptance: `farewell("Ada")` returns `Goodbye, Ada`.
- Spec, Contract: The first `farewell(name)` writes ``Goodbye, ${name}`` to `farewells.json` under that name. A later call with the same name returns the stored line and does not write again.

#### Change and touchpoints

In `src/greet.ts`, add `export function farewell(name: string): string`. The first call writes ``Goodbye, ${name}`` to `farewells.json` under `name` and returns that line. A later call with the same name reads the file and returns the stored line.

#### Depends on

none

#### Verification

`node --test` asserts `farewell("Ada")` is `Goodbye, Ada` and that a second call does not change `farewells.json`. The command is `package.json` `scripts.test`.

## Coverage

| Requirement | Unit | Consequence | Evidence | Status |
|---|---|---|---|---|
| farewell("Ada") returns Goodbye, Ada | U1 | that return value | node --test | covered |
| The line is stored and a later call returns it | U1 | farewells.json holds the line | node --test | covered |

## Self-review

Implementation-ready.
