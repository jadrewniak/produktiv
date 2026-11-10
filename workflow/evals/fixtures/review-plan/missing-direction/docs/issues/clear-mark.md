---
feature: clear-mark
---

# Clear beside mark

## Problem

Callers need `clear` beside `mark`, including the empty call that must not replace the mark.

## Desired outcome

`clear("Ada")` returns `Clear, Ada`. `mark("Ada")` still returns `Mark, Ada`. An empty clear leaves the stored mark unchanged.

## User stories

- As a caller, I call `clear("Ada")` and get `Clear, Ada`.
- As a caller, I call `mark("Ada")` and still get `Mark, Ada`.
- As a caller, I call `clear("")` and the stored mark stays.

## Decisions

### Product

- `clear("Ada")` returns `Clear, Ada`, and a later `read()` returns `Clear, Ada`.
- `mark("Ada")` returns `Mark, Ada`.
- `clear("")` does not replace the stored mark. A later `read()` still returns `Mark, Ada` when that was the previous text.

## Acceptance / success

- `clear("Ada")` returns `Clear, Ada`.
- `mark("Ada")` returns `Mark, Ada`.
- `clear("")` does not replace the stored mark. `read()` returns the previous text.

## Out of scope

- Any other public function.

## Dependencies

None.

## Risks

None.
