---
feature: mark-pair
issue: docs/issues/mark-pair.md
---

# Wave and nod

## Goal

Implement `docs/issues/mark-pair.md`.

## Current state

`src/wave.ts` exports `wave(name: string): string`, which returns `name`. `src/nod.ts` exports `nod(name: string): string`, which returns `name`.

## Target

`wave("Ada")` returns `Wave, Ada`. `nod("Ada")` returns `Nod, Ada`.

## Units

### U1 — Wave helper

#### Requirement references

- Issue, Acceptance / success: `wave("Ada")` returns `Wave, Ada`.

#### Change and touchpoints

In `src/wave.ts`, add `function waveText(name: string): string` returning ``Wave, ${name}``. Do not export `waveText`. This step has no observable outcome of its own.

#### Depends on

none

#### Consumes / Produces

none

#### Verification

No check on this step. U2 checks the wave outcome.

### U2 — Wave export

#### Requirement references

- Issue, Acceptance / success: `wave("Ada")` returns `Wave, Ada`.
- Issue, Out of scope: Do not add any other public function.

#### Change and touchpoints

In `src/wave.ts`, change `wave` so it returns `waveText(name)`.

#### Depends on

none

#### Consumes / Produces

none

#### Verification

`node --test` asserts `wave("Ada")` is `Wave, Ada`. A runtime call of `wave("Ada")` returns `Wave, Ada`. Both checks prove that one outcome. The command is `package.json` `scripts.test`.

### U3 — Nod helper

#### Requirement references

- Issue, Acceptance / success: `nod("Ada")` returns `Nod, Ada`.

#### Change and touchpoints

In `src/nod.ts`, add `function nodText(name: string): string` returning ``Nod, ${name}``. Do not export `nodText`. This step has no observable outcome of its own.

#### Depends on

none

#### Consumes / Produces

none

#### Verification

No check on this step. U4 checks the nod outcome.

### U4 — Nod export

#### Requirement references

- Issue, Acceptance / success: `nod("Ada")` returns `Nod, Ada`.
- Issue, Out of scope: Do not add any other public function.

#### Change and touchpoints

In `src/nod.ts`, change `nod` so it returns `nodText(name)`.

#### Depends on

none

#### Consumes / Produces

none

#### Verification

`node --test` asserts `nod("Ada")` is `Nod, Ada`. A runtime call of `nod("Ada")` returns `Nod, Ada`. Both checks prove that one outcome. The command is `package.json` `scripts.test`.

## Order

U1 and U2 are steps of the wave outcome. U3 and U4 are steps of the nod outcome. The Plan states no separate name for either group. Neither group produces an output the other consumes.

## Coverage

| Requirement | Unit | Consequence | Evidence | Status |
|---|---|---|---|---|
| wave("Ada") returns Wave, Ada | U1, U2 | that return value | node --test and a runtime call | covered |
| nod("Ada") returns Nod, Ada | U3, U4 | that return value | node --test and a runtime call | covered |

## Self-review

Implementation-ready.
