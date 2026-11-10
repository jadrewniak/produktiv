---
feature: farewell-pair
slice: U1
plan: docs/plans/farewell-pair.md
---

# Farewell

## Objective

`farewell("Ada")` returns `Goodbye, Ada`.

## Authoritative references

- Plan: U1 — Farewell
- Source brief, Observable acceptance: `farewell("Ada")` returns `Goodbye, Ada`.
- Source brief, Relevant non-goals: Do not add any other public function.

## Scope

Plan U1 in `src/greet.ts`. Add `export function farewell(name: string): string` returning ``Goodbye, ${name}``.

## Out of scope

Do not add any other public function.

## Acceptance

- Source brief, Observable acceptance: `farewell("Ada")` returns `Goodbye, Ada`.
- Source brief, Relevant non-goals: Do not add any other public function.

## Dependencies

none

## Verification expectation

The check in Plan U1 Verification. `node --test` asserts `farewell("Ada")` is `Goodbye, Ada`. The command is `package.json` `scripts.test`.
