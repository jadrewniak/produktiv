---
feature: pair-greet
slice: parting
plan: docs/plans/pair-greet.md
issue: docs/issues/pair-greet.md
---

# Parting

## Objective

`src/greet.ts` exports `parting(name: string)` returning ``Parting, ${name}``.

## Authoritative references

- Plan: U1 — Two greetings, boundary Parting
- Issue, Acceptance / success: `parting("Ada")` returns `Parting, Ada`.
- Issue, Out of scope: Do not add any other public function.

## Scope

The Parting boundary in Plan U1. In `src/greet.ts`, add `export function parting(name: string): string` returning ``Parting, ${name}``.

## Out of scope

- Do not add any other public function.

## Acceptance

- Issue, Acceptance / success: `parting("Ada")` returns `Parting, Ada`.

## Dependencies

none

## Verification expectation

The check on the Parting boundary. `node --test` asserts `parting("Ada")` is `Parting, Ada`. The command is `package.json` `scripts.test`.
