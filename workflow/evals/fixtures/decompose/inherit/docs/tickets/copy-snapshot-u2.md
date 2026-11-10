---
feature: copy-snapshot
slice: U2
plan: docs/plans/copy-snapshot.md
issue: docs/issues/copy-snapshot.md
spec: docs/specs/copy-snapshot.md
---

# Leave no file on failure

## Objective

A failed copy leaves no file. A failed copy produces no file. There is no partial file.

## Authoritative references

- Plan: U2 — Leave no file on failure
- Issue, Acceptance / success: A failed copy leaves no file.
- Spec, Contract: A failed copy produces no file. There is no partial file.

## Scope

Plan U2 in `src/copy.ts`. When the write inside `copy` throws, delete the partial file if one was created and return false. This call leaves no file.

## Out of scope

- Retries.
- Editing the live text from the snapshot.

## Acceptance

- Issue, Acceptance / success: A failed copy leaves no file.
- Spec, Contract: A failed copy produces no file. There is no partial file.

## Dependencies

Blocked by `docs/tickets/copy-snapshot-u1.md`. It consumes the snapshot file that ticket's `copy` write produces. The failure result is the absence of that file.

## Verification expectation

The check in Plan U2 Verification. `npm test` shows a failed write leaves no file from that call and no partial file. The command is `package.json` `scripts.test`.
