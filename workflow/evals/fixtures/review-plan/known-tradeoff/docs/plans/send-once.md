---
feature: send-once
issue: docs/issues/send-once.md
---

# Send once

## Goal

Keep `send` as `docs/issues/send-once.md` decides. Retries stay deferred.

## Current state

`src/send.ts` exports `send(body: string): boolean`. An empty body returns false and appends nothing. Any other body appends one entry to `records` and returns true.

## Target

`send("Ada")` stores one record of `Ada`. `send("")` stores nothing. This route does not retry.

## Units

### U1 — Keep send

#### Requirement references

- Issue: `send("Ada")` stores one record of `Ada`.
- Issue: `send("")` stores nothing.
- Issue deferral: retries. Impact: an empty send is not retried. Owner: the caller. Revisit when a queue exists.

#### Change and touchpoints

Leave `send` in `src/send.ts` as it is. An empty body appends nothing. Any other body appends that body once.

#### Depends on

none

#### Verification

`send("Ada")` appends one `Ada` record. `send("")` appends nothing. Evidence: `npm run test`. Provenance: `.workflow/context/quality.md` row Test, source `package.json#scripts.test`.

## Risks

Tradeoff: retries stay out of this route. The Issue defers them. Ceiling: an empty send is not retried here. Owner: the caller. Revisit when a queue exists.

## Coverage

| Requirement | Unit | Consequence | Evidence | Status |
|---|---|---|---|---|
| send("Ada") stores one record of Ada | U1 | one Ada record | npm run test, quality.md Test | covered |
| send("") stores nothing | U1 | no record | npm run test, quality.md Test | covered |
| Retries | — | an empty send is not retried | deferred by the Issue | deferred: caller, revisit when a queue exists |

## Self-review

Implementation-ready.
