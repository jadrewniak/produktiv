---
feature: copy-snapshot
slice: snapshot-file
plan: docs/plans/copy-snapshot.md
issue: docs/issues/copy-snapshot.md
spec: docs/specs/copy-snapshot.md
---

# Snapshot file

## Objective

In `src/copy.ts`, `copy(text: string)` writes one new file under `snapshots/`. The name is the count of files already in `snapshots/` plus one, with a `.txt` suffix. The file contents are `text`. `copy` does not push onto `live`. `snapshots/` is new. Return true.

## Authoritative references

- Plan: U1 — Snapshot file
- Issue, Acceptance / success: A finished copy contains only the text that existed when it was requested.
- Spec, Contract: A copy is a snapshot of the text that existed when it was requested. Its contents do not change afterward.
- Spec, Boundaries: A copy does not write back into live text.

## Scope

Plan U1 in `src/copy.ts`. `copy(text: string)` writes one new file under `snapshots/`. The name is the count of files already in `snapshots/` plus one, with a `.txt` suffix. The file contents are `text`. Do not push onto `live`. `snapshots/` is new. Return true.

## Out of scope

- Retries.
- Editing the live text from the snapshot.

## Acceptance

- Issue, Acceptance / success: A finished copy contains only the text that existed when it was requested.

## Dependencies

none

## Verification expectation

The check in Plan U1 Verification. `npm test` shows the new file's contents equal `text`, and a second `copy` leaves the first file unchanged. The diff of `src/copy.ts` shows `copy` does not modify `live`. The command is `package.json` `scripts.test`.
