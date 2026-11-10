---
feature: send-once
---

# Send once

## Problem

A caller needs one record when a send has a body, and no record when the body is empty.

## Desired outcome

`send("Ada")` stores one `Ada` record. `send("")` stores nothing.

## Decisions

### Product

- `send("Ada")` stores one record of `Ada`.
- `send("")` stores nothing.

## Acceptance / success

- `send("Ada")` stores one record of `Ada`.
- `send("")` stores nothing.

## Out of scope

- A queue.

## Explicitly deferred material decisions

- Retries. Impact: an empty send is not retried in this feature. Owner: the caller. Revisit when a queue exists.

## Dependencies

None.

## Risks

None.
