---
feature: saved-label
---

# Saved label

## Problem

A caller needs a later read to return the text that was saved.

## Desired outcome

A save of Ada is still Ada on a later read. An empty save does not write.

## Decisions

### Product

- A save of `Ada` is still `Ada` on a later read.
- An empty save does not write. The stored text stays.

## Acceptance / success

- A save of `Ada` is still `Ada` on a later read.
- An empty save does not write.

## Dependencies

None.

## Risks

None.
