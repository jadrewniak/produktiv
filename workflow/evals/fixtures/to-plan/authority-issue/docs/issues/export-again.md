---
feature: export-again
---

# Return the same export body

## Problem

A caller who repeats an export id needs the first finished body again. A different body for that id must not replace it.

## Desired outcome

The same export id returns the same finished body. A mismatched body fails and leaves the first body unchanged.

## User stories

- As a caller, I repeat an export id and receive the finished body from the first successful write.
- As a caller, I submit a different body for that id, the call fails, and the first body is still the one a later read returns.

## Decisions

### Product

- A second request with the same export id returns the same finished body.
- A different body for that id fails and leaves the first body unchanged.

## Acceptance / success

- The second request with export id `e1` and body `alpha` returns `alpha` when the first successful write for `e1` was `alpha`.
- A request with export id `e1` and body `beta`, after that first write, fails.
- After that failure, a request with export id `e1` and body `alpha` still returns `alpha`.

## Out of scope

- Scheduling recurring exports.
- Editing the account's live records.

## Dependencies

None.

## Risks

None.
