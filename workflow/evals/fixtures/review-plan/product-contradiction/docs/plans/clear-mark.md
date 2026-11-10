---
feature: clear-mark
issue: docs/issues/clear-mark.md
---

# Clear beside mark

## Goal

Implement `docs/issues/clear-mark.md` by storing a partial mark when `clear` is given an empty name.

## Current state

`src/mark.ts` keeps `current`, starting as `Mark, Ada`. `mark(name)` stores ``Mark, ${name}`` and returns it. `read()` returns `current`.

## Target

`clear("Ada")` returns `Clear, Ada` and stores it. `mark("Ada")` still returns `Mark, Ada`. `clear("")` stores `Partial` and returns that partial mark.

## Units

### U1 — Clear and partial

#### Requirement references

- Issue: `clear("Ada")` returns `Clear, Ada`.
- Issue: `mark("Ada")` returns `Mark, Ada`.
- Issue: `clear("")` returns the previous text and does not replace it. There is no partial mark.

#### Change and touchpoints

In `src/mark.ts`, add `clear(name: string): string`. For `Ada`, store `Clear, Ada` and return it. Leave `mark` as it is. When `name` is empty, store `Partial` and return that value.

#### Depends on

none

#### Verification

`clear("Ada")` returns `Clear, Ada`. `mark("Ada")` returns `Mark, Ada`. `clear("")` returns `Partial` and `read()` returns that partial mark. Evidence: `npm run test`. Provenance: `.workflow/context/quality.md` row Test, source `package.json#scripts.test`.

## Coverage

| Requirement | Unit | Consequence | Evidence | Status |
|---|---|---|---|---|
| clear("Ada") returns Clear, Ada | U1 | that return | npm run test, quality.md Test | covered |
| mark("Ada") returns Mark, Ada | U1 | mark unchanged | npm run test, quality.md Test | covered |
| clear("") leaves the existing mark unchanged. There is no partial mark. | U1 | clear("") stores Partial | npm run test, quality.md Test | covered |

## Self-review

Implementation-ready.
