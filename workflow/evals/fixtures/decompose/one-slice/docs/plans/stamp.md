---
feature: stamp
issue: docs/issues/stamp.md
---

# Stamp a name

## Goal

Implement `docs/issues/stamp.md`. `stamp("Ada")` returns `Stamp, Ada`.

## Current state

`src/stamp.ts` exports `stamp(name: string): string`, which returns `name`. There is no `format`.

## Target

`stamp` returns `format(name)`. `format` returns ``Stamp, ${name}`` and is not exported.

## Units

### U1 — Format

#### Requirement references

- Issue, Acceptance / success: `stamp("Ada")` returns `Stamp, Ada`.

#### Change and touchpoints

In `src/stamp.ts`, add `function format(name: string): string` returning ``Stamp, ${name}``. Do not export `format`. This step has no observable outcome of its own.

#### Depends on

none

#### Consumes / Produces

none

#### Verification

No check on this step. U3 checks the outcome.

### U2 — Export

#### Requirement references

- Issue, Acceptance / success: `stamp("Ada")` returns `Stamp, Ada`.

#### Change and touchpoints

In `src/stamp.ts`, change `stamp` so it returns `format(name)`.

#### Depends on

none

#### Consumes / Produces

none

#### Verification

No check on this step. U3 checks the outcome.

### U3 — Check

#### Requirement references

- Issue, Acceptance / success: `stamp("Ada")` returns `Stamp, Ada`.
- Issue, Out of scope: Do not add any other public function.

#### Change and touchpoints

No production edit. The check asserts `stamp("Ada")` and that `format` is not exported.

#### Depends on

none

#### Consumes / Produces

none

#### Verification

`node --test` asserts `stamp("Ada")` is `Stamp, Ada` and that the module exports no other public function. A runtime call of `stamp("Ada")` returns `Stamp, Ada`. Both checks prove that one outcome. The command is `package.json` `scripts.test`.

## Order

U1, U2, and U3 are steps of one outcome. None produces an output a separate ticket must consume.

## Coverage

| Requirement | Unit | Consequence | Evidence | Status |
|---|---|---|---|---|
| stamp("Ada") returns Stamp, Ada | U1, U2, U3 | that return value | node --test and a runtime call | covered |
| Do not add any other public function | U3 | format is not exported | node --test | covered |

## Self-review

Implementation-ready.
