---
feature: same-body
---

# Same finished body

## Problem

A caller that repeats an id needs the same finished body back.

## Desired outcome

A second request with the same id returns the same finished body. A different body for that id fails and leaves the first body unchanged.

## Acceptance / success

- A second request with the same id returns the same finished body.
- A different body for that id fails and leaves the first body unchanged.

## Dependencies

None.

## Risks

None.
