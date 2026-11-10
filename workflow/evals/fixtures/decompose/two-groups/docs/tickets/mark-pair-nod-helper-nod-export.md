---
feature: mark-pair
slice: nod-helper-nod-export
plan: docs/plans/mark-pair.md
issue: docs/issues/mark-pair.md
---

# Nod helper nod export

## Objective

In `src/nod.ts`, `nod` returns `nodText(name)`. `nodText` returns ``Nod, ${name}`` and is not exported.

## Authoritative references

- Plan: U3 — Nod helper
- Plan: U4 — Nod export
- Issue, Acceptance / success: `nod("Ada")` returns `Nod, Ada`.
- Issue, Out of scope: Do not add any other public function.

## Scope

Plan U3 and U4 in `src/nod.ts`. Add `function nodText(name: string): string` returning ``Nod, ${name}``. Do not export `nodText`. Change `nod` so it returns `nodText(name)`.

## Out of scope

- Do not add any other public function.

## Acceptance

- Issue, Acceptance / success: `nod("Ada")` returns `Nod, Ada`.

## Dependencies

none

## Verification expectation

The evidence set in Plan U4. `node --test` asserts `nod("Ada")` is `Nod, Ada`. A runtime call of `nod("Ada")` returns `Nod, Ada`. Both checks prove that one outcome. The command is `package.json` `scripts.test`.
