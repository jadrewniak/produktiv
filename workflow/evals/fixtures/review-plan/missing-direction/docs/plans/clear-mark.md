---
feature: clear-mark
issue: docs/issues/clear-mark.md
---

# Clear beside mark

## Goal

Add `clear` beside `mark` as `docs/issues/clear-mark.md` decides.

## Current state

`src/mark.ts` keeps `current`, starting as `Mark, Ada`. `mark(name)` stores ``Mark, ${name}`` and returns it. `read()` returns `current`.

## Target

`clear("Ada")` stores and returns `Clear, Ada`. `mark("Ada")` still returns `Mark, Ada`. `clear("")` does not replace the stored mark.

## Units

### U1 — Clear beside mark

#### Requirement references

- Issue: `clear("Ada")` returns `Clear, Ada`.
- Issue: `mark("Ada")` returns `Mark, Ada`.
- Issue: `clear("")` does not replace the stored mark.

#### Change and touchpoints

In `src/mark.ts`, add `clear(name: string): string`. For `Ada`, store `Clear, Ada` and return it. Leave `mark` as it is. When `name` is empty, return the previous text and do not write.

#### Depends on

none

#### Verification

`clear("Ada")` returns `Clear, Ada`. Evidence: `npm run test`. Provenance: `.workflow/context/quality.md` row Test, source `package.json#scripts.test`.

## Coverage

| Requirement | Unit | Consequence | Evidence | Status |
|---|---|---|---|---|
| clear("Ada") returns Clear, Ada | U1 | that return | npm run test, quality.md Test | covered |
| mark("Ada") returns Mark, Ada | U1 | mark unchanged | clear("Ada") returns Clear, Ada | covered |
| clear("") does not replace the stored mark | U1 | previous text stays | clear("Ada") returns Clear, Ada | covered |

## Self-review

Implementation-ready.
