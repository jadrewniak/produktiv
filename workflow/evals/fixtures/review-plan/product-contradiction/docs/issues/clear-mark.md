---
feature: clear-mark
---

# Clear beside mark

## Problem

Callers need `clear` beside `mark`. An empty clear must not replace the mark.

## Desired outcome

`clear("Ada")` returns `Clear, Ada`. `mark("Ada")` still returns `Mark, Ada`. An empty clear leaves the existing mark unchanged.

## User stories

- As a caller, I call `clear("Ada")` and get `Clear, Ada`.
- As a caller, I call `mark("Ada")` and still get `Mark, Ada`.
- As a caller, I call `clear("")` and the previous mark stays.

## Decisions

### Product

- `clear("Ada")` returns `Clear, Ada`, and a later `read()` returns `Clear, Ada`.
- `mark("Ada")` returns `Mark, Ada`.
- `clear("")` returns the previous text and does not replace it. There is no partial mark.

## Acceptance / success

- `clear("Ada")` returns `Clear, Ada`.
- `mark("Ada")` returns `Mark, Ada`.
- `clear("")` returns the previous text and does not replace it. There is no partial mark.

## Out of scope

- Any other public function.

## Dependencies

None.

## Risks

None.
