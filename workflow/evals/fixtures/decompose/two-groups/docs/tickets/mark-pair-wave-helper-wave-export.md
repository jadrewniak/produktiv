---
feature: mark-pair
slice: wave-helper-wave-export
plan: docs/plans/mark-pair.md
issue: docs/issues/mark-pair.md
---

# Wave helper wave export

## Objective

In `src/wave.ts`, `wave` returns `waveText(name)`. `waveText` returns ``Wave, ${name}`` and is not exported.

## Authoritative references

- Plan: U1 — Wave helper
- Plan: U2 — Wave export
- Issue, Acceptance / success: `wave("Ada")` returns `Wave, Ada`.
- Issue, Out of scope: Do not add any other public function.

## Scope

Plan U1 and U2 in `src/wave.ts`. Add `function waveText(name: string): string` returning ``Wave, ${name}``. Do not export `waveText`. Change `wave` so it returns `waveText(name)`.

## Out of scope

- Do not add any other public function.

## Acceptance

- Issue, Acceptance / success: `wave("Ada")` returns `Wave, Ada`.

## Dependencies

none

## Verification expectation

The evidence set in Plan U2. `node --test` asserts `wave("Ada")` is `Wave, Ada`. A runtime call of `wave("Ada")` returns `Wave, Ada`. Both checks prove that one outcome. The command is `package.json` `scripts.test`.
