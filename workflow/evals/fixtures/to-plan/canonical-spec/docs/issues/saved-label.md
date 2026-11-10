---
feature: saved-label
---

# Save a label

## Problem

The caller needs the submitted label text to still be there on a later read.

## Desired outcome

Saving a text stores it. A later read returns that text. An empty save writes nothing.

## User stories

- As a caller, I save `Ada` and a later read returns `Ada`.
- As a caller, I save an empty text and the previous text stays.

## Decisions

### Product

- A save of `Ada` is still `Ada` on a later read.
- An empty save writes nothing.
- A read before any save returns no text.

## Acceptance / success

- `save("Ada")` then `read()` returns `Ada`.
- `save("")` after that writes nothing. `read()` still returns `Ada`.
- `read()` before any save returns no text.

## Out of scope

- More than one label.

## Dependencies

None.

## Risks

None.
