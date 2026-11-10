---
feature: ping-count
---

# Count one ping

## Problem

Callers of `ping` need a count of one beside it.

## Desired outcome

`count` returns `1`. `ping` still returns `pong`.

## Decisions

### Product

- `count()` returns `1`.
- `ping()` still returns `pong`.

## Acceptance / success

- `count()` returns `1`.
- `ping()` returns `pong`.

## Out of scope

- Any other public function.

## Dependencies

None.

## Risks

None.
