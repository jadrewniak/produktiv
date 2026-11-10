---
feature: clear-mark
---

# Clear beside mark

## Problem

Callers need `clear` beside `mark`, in the same string shape, without moving `mark`.

## Desired outcome

`clear(name)` returns `Clear, ${name}`. `mark(name)` still returns `Mark, ${name}`.

## User stories

- As a caller, I call `clear("Ada")` and get `Clear, Ada`.
- As a caller, I call `mark("Ada")` and still get `Mark, Ada`.

## Decisions

### Product

- `clear(name: string)` returns ``Clear, ${name}``.
- `mark(name: string)` still returns ``Mark, ${name}``.

## Acceptance / success

- `clear("Ada")` returns `Clear, Ada`.
- `mark("Ada")` returns `Mark, Ada`.

## Out of scope

- Any other public function.

## Dependencies

None.

## Risks

None.
