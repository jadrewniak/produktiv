---
feature: copy-snapshot
issue: docs/issues/copy-snapshot.md
spec: docs/specs/draft-copy.md
---

# Copy a snapshot

## Goal

Implement `docs/issues/copy-snapshot.md` through the contract in `docs/specs/copy-snapshot.md`. `copy` writes a snapshot file and leaves no file when that write fails.

## Current state

`src/copy.ts` exports `copy(text: string): boolean`. It pushes `text` onto `live` and returns true. It writes no file. `snapshots/` does not exist.

## Target

A finished copy is the snapshot file named below. A failed copy leaves no file, including no partial file. `copy` does not write back into `live`.

## Units

### U1 — Snapshot file

#### Requirement references

- Issue, Acceptance / success: A finished copy contains only the text that existed when it was requested.

#### Change and touchpoints

In `src/copy.ts`, `copy(text: string)` writes one new file under `snapshots/`. The name is the count of files already in `snapshots/` plus one, with a `.txt` suffix. The file contents are `text`. Do not push onto `live`. `snapshots/` is new. Return true.

#### Depends on

none

#### Consumes / Produces

Produces the snapshot file under `snapshots/` that U2 deletes when the write fails.

#### Verification

`npm test` shows the new file's contents equal `text`, and a second `copy` leaves the first file unchanged. The diff of `src/copy.ts` shows `copy` does not modify `live`. The command is `package.json` `scripts.test`.

### U2 — Failed copy

#### Requirement references

- Issue, Acceptance / success: A failed copy leaves no file.

#### Change and touchpoints

In `src/copy.ts`, when the write inside `copy` throws, delete the partial file if one was created and return false. This call leaves no file.

#### Depends on

U1. U2 consumes the snapshot file U1's write produces. The failure result is the absence of that file.

#### Verification

`npm test` shows a failed write leaves no file from that call and no partial file. The command is `package.json` `scripts.test`.

## Order

U1, then U2. U2 consumes the snapshot file U1 produces.

## Coverage

| Requirement | Unit | Consequence | Evidence | Status |
|---|---|---|---|---|
| A finished copy contains only the text that existed when it was requested. | U1 | the new file's contents are that text | npm test | covered |
| A failed copy leaves no file. | U2 | no file from that call | npm test | covered |

## Self-review

Implementation-ready.
