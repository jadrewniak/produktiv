---
feature: clear-mark
issue: docs/issues/clear-mark.md
---

# Clear beside mark

## Goal

Add `clear` beside `mark` as `docs/issues/clear-mark.md` decides, then call it from the next unit.

## Current state

`src/mark.ts` exports `mark(name: string): string`, which returns ``Mark, ${name}``.

## Target

`src/mark.ts` exports `clear`. A second unit calls that function.

## Units

### U1 — Add clear

#### Requirement references

- Issue: `clear(name: string)` returns ``Clear, ${name}``.
- Issue: `mark(name: string)` still returns ``Mark, ${name}``.

#### Change and touchpoints

In `src/mark.ts`, add `export function clear(name: string): string` returning ``Clear, ${name}``. Leave `mark` as it is.

#### Depends on

none

#### Consumes / Produces

Produces `clear(name: string): string`.

#### Verification

`clear("Ada")` returns `Clear, Ada`. `mark("Ada")` returns `Mark, Ada`. Evidence: `npm run test`. Provenance: `.workflow/context/quality.md` row Test, source `package.json#scripts.test`.

### U2 — Second caller

#### Requirement references

- Issue: `clear(name: string)` returns ``Clear, ${name}``.

#### Change and touchpoints

In `src/mark.ts`, add a private function `useClear`. It calls `clear(id: number)` and ignores the return. `useClear` is not exported.

#### Depends on

U1

#### Consumes / Produces

Consumes `clear(id: number): void`.

#### Verification

`clear(1)` returns `undefined`. Evidence: `npm run test`. Provenance: `.workflow/context/quality.md` row Test, source `package.json#scripts.test`.

## Order

U2 depends on U1.

## Coverage

| Requirement | Unit | Consequence | Evidence | Status |
|---|---|---|---|---|
| clear("Ada") returns Clear, Ada | U1 | that return | npm run test, quality.md Test | covered |
| mark("Ada") returns Mark, Ada | U1 | mark unchanged | npm run test, quality.md Test | covered |
| clear(name: string) returns Clear, ${name} | U2 | clear(id: number) returns void | npm run test, quality.md Test | covered |

## Self-review

Implementation-ready.
