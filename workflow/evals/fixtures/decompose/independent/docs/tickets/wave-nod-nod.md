---
feature: wave-nod
slice: nod
plan: docs/plans/wave-nod.md
issue: docs/issues/wave-nod.md
---

# Nod

## Objective

In `src/nod.ts`, `nod` returns ``Nod, ${name}``.

## Authoritative references

- Plan: U2 — Nod
- Issue, Acceptance / success: `nod("Ada")` returns `Nod, Ada`.
- Issue, Out of scope: Do not add any other public function.

## Scope

Plan U2 in `src/nod.ts`. Change `nod` so it returns ``Nod, ${name}``.

## Out of scope

- Do not add any other public function.

## Acceptance

- Issue, Acceptance / success: `nod("Ada")` returns `Nod, Ada`.

## Dependencies

none

## Verification expectation

The check in Plan U2. `node --test` asserts `nod("Ada")` is `Nod, Ada`. The command is `package.json` `scripts.test`.
