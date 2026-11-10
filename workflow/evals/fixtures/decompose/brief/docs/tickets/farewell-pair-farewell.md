---
feature: farewell-pair
slice: farewell
plan: docs/plans/farewell-pair.md
---

# Farewell

## Objective

`src/greet.ts` exports `farewell(name: string)` returning ``Goodbye, ${name}``.

## Authoritative references

- Plan: U1 — Farewell
- Source brief, Observable acceptance: `farewell("Ada")` returns `Goodbye, Ada`.
- Source brief, Relevant non-goals: Do not add any other public function.

## Scope

Plan U1 in `src/greet.ts`. Add `export function farewell(name: string): string` returning ``Goodbye, ${name}``.

## Out of scope

- Do not add any other public function.

## Acceptance

- Source brief, Observable acceptance: `farewell("Ada")` returns `Goodbye, Ada`.

## Dependencies

none

## Verification expectation

The check in Plan U1. `node --test` asserts `farewell("Ada")` is `Goodbye, Ada`. The command is `package.json` `scripts.test`.
