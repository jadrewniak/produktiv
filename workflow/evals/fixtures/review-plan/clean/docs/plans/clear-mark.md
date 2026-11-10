---
feature: clear-mark
issue: docs/issues/clear-mark.md
---

# Clear beside mark

## Goal

Add `clear` beside `mark` as `docs/issues/clear-mark.md` decides.

## Current state

`src/mark.ts` exports `mark(name: string): string`, which returns ``Mark, ${name}``.

## Target

Export `clear(name: string): string` from `src/mark.ts`, returning ``Clear, ${name}``. `mark` stays.

## Units

### U1 — Clear beside mark

#### Requirement references

- Issue: `clear(name: string)` returns ``Clear, ${name}``.
- Issue: `mark(name: string)` still returns ``Mark, ${name}``.
- Issue out of scope: any other public function.

#### Change and touchpoints

In `src/mark.ts`, add `export function clear(name: string): string` returning ``Clear, ${name}``. Leave `mark` as it is.

#### Depends on

none

#### Verification

`clear("Ada")` returns `Clear, Ada`. `mark("Ada")` returns `Mark, Ada`. Evidence: `npm run test`. Provenance: `.workflow/context/quality.md` row Test, source `package.json#scripts.test`. No other public function is added.

## Coverage

| Requirement | Unit | Consequence | Evidence | Status |
|---|---|---|---|---|
| clear("Ada") returns Clear, Ada | U1 | that return | npm run test, quality.md Test | covered |
| mark("Ada") returns Mark, Ada | U1 | mark unchanged | npm run test, quality.md Test | covered |
| No other public function | U1 | clear is the only addition | npm run test, quality.md Test | covered |

## Self-review

Implementation-ready.
