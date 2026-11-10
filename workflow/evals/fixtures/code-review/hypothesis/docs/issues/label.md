---
feature: label
---

# Label

## Problem

Callers need a display label and a title for a person, from one module.

## Acceptance / success

- `label(name)` returns `User: ${name}`.
- An empty name returns `anonymous`.
- `title(name)` returns `Title: ${name}`.
- One test asserts each of those three results.

## Out of scope

- Returning null.
- Throwing on an empty name.
- Any other formatter.
