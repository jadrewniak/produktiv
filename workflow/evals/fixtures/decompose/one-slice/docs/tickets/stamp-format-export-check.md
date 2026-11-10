---
feature: stamp
slice: format-export-check
plan: docs/plans/stamp.md
issue: docs/issues/stamp.md
---

# Format export check

## Objective

`stamp` in `src/stamp.ts` returns `format(name)`. `format` returns ``Stamp, ${name}`` and is not exported.

## Authoritative references

- Plan: U1 — Format
- Plan: U2 — Export
- Plan: U3 — Check
- Issue, Acceptance / success: `stamp("Ada")` returns `Stamp, Ada`.
- Issue, Out of scope: Do not add any other public function.

## Scope

Plan U1, U2, and U3 in `src/stamp.ts`. Add `function format(name: string): string` returning ``Stamp, ${name}``. Do not export `format`. Change `stamp` so it returns `format(name)`.

## Out of scope

- Do not add any other public function.

## Acceptance

- Issue, Acceptance / success: `stamp("Ada")` returns `Stamp, Ada`.

## Dependencies

none

## Verification expectation

The evidence set in Plan U3. `node --test` asserts `stamp("Ada")` is `Stamp, Ada` and that the module exports no other public function. A runtime call of `stamp("Ada")` returns `Stamp, Ada`. Both checks prove that one outcome. The command is `package.json` `scripts.test`.
