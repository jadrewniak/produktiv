---
feature: wave-nod
issue: "#14"
---

# Wave and nod

## Goal

Implement GitHub issue #14.

## Current state

`src/wave.ts` exports `wave(name: string): string`, which returns `name`. `src/nod.ts` exports `nod(name: string): string`, which returns `name`.

## Target

`wave("Ada")` returns `Wave, Ada`. `nod("Ada")` returns `Nod, Ada`.

## Units

### U1 — Wave

#### Requirement references

- Issue, Acceptance / success: `wave("Ada")` returns `Wave, Ada`.
- Issue, Out of scope: Do not add any other public function.

#### Change and touchpoints

In `src/wave.ts`, change `wave` so it returns ``Wave, ${name}``.

#### Depends on

none

#### Consumes / Produces

none

#### Verification

`node --test` asserts `wave("Ada")` is `Wave, Ada`. The command is `package.json` `scripts.test`.

### U2 — Nod

#### Requirement references

- Issue, Acceptance / success: `nod("Ada")` returns `Nod, Ada`.
- Issue, Out of scope: Do not add any other public function.

#### Change and touchpoints

In `src/nod.ts`, change `nod` so it returns ``Nod, ${name}``.

#### Depends on

none

#### Consumes / Produces

none

#### Verification

`node --test` asserts `nod("Ada")` is `Nod, Ada`. The command is `package.json` `scripts.test`.

## Coverage

| Requirement | Unit | Consequence | Evidence | Status |
|---|---|---|---|---|
| wave("Ada") returns Wave, Ada | U1 | that return value | node --test | covered |
| nod("Ada") returns Nod, Ada | U2 | that return value | node --test | covered |

## Self-review

Implementation-ready.
