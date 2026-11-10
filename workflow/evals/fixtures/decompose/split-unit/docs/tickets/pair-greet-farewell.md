---
feature: pair-greet
slice: farewell
plan: docs/plans/pair-greet.md
issue: docs/issues/pair-greet.md
---

# Farewell

## Objective

`src/greet.ts` exports `farewell(name: string)` returning ``Goodbye, ${name}``.

## Authoritative references

- Plan: U1 — Two greetings, boundary Farewell
- Issue, Acceptance / success: `farewell("Ada")` returns `Goodbye, Ada`.
- Issue, Out of scope: Do not add any other public function.

## Scope

The Farewell boundary in Plan U1. In `src/greet.ts`, add `export function farewell(name: string): string` returning ``Goodbye, ${name}``.

## Out of scope

- Do not add any other public function.

## Acceptance

- Issue, Acceptance / success: `farewell("Ada")` returns `Goodbye, Ada`.

## Dependencies

none

## Verification expectation

The check on the Farewell boundary. `node --test` asserts `farewell("Ada")` is `Goodbye, Ada`. The command is `package.json` `scripts.test`.
