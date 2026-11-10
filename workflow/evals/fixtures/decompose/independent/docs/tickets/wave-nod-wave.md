---
feature: wave-nod
slice: wave
plan: docs/plans/wave-nod.md
issue: docs/issues/wave-nod.md
---

# Wave

## Objective

In `src/wave.ts`, `wave` returns ``Wave, ${name}``.

## Authoritative references

- Plan: U1 — Wave
- Issue, Acceptance / success: `wave("Ada")` returns `Wave, Ada`.
- Issue, Out of scope: Do not add any other public function.

## Scope

Plan U1 in `src/wave.ts`. Change `wave` so it returns ``Wave, ${name}``.

## Out of scope

- Do not add any other public function.

## Acceptance

- Issue, Acceptance / success: `wave("Ada")` returns `Wave, Ada`.

## Dependencies

none

## Verification expectation

The check in Plan U1. `node --test` asserts `wave("Ada")` is `Wave, Ada`. The command is `package.json` `scripts.test`.
