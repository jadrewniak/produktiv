---
feature: farewell-pair
slice: parting
plan: docs/plans/farewell-pair.md
---

# Parting

## Objective

`src/greet.ts` exports `parting(name: string)` returning ``Parting, ${name}``.

## Authoritative references

- Plan: U2 — Parting
- Source brief, Observable acceptance: `parting("Ada")` returns `Parting, Ada`.
- Source brief, Relevant non-goals: Do not add any other public function.

## Scope

Plan U2 in `src/greet.ts`. Add `export function parting(name: string): string` returning ``Parting, ${name}``.

## Out of scope

- Do not add any other public function.

## Acceptance

- Source brief, Observable acceptance: `parting("Ada")` returns `Parting, Ada`.

## Dependencies

none

## Verification expectation

The check in Plan U2. `node --test` asserts `parting("Ada")` is `Parting, Ada`. The command is `package.json` `scripts.test`.
