---
feature: copy-snapshot
issue: docs/issues/copy-snapshot.md
---

# Copy a snapshot

## Goal

Implement `docs/issues/copy-snapshot.md` through `docs/specs/copy-snapshot.md`.

## Current state

`src/copy.ts` exports `copy(text: string): boolean`. It pushes `text` onto `live` and returns true. It writes no file.

## Target

A finished copy is a snapshot of the requested text. A failed copy leaves no file.

## Units

### U1 — Write the snapshot

#### Requirement references

- Issue, Acceptance / success: A finished copy contains only the text that existed when it was requested.

#### Change and touchpoints

Write the snapshot somewhere in the repository. The directory, the file name, and the write call are not chosen.

#### Depends on

none

#### Consumes / Produces

Produces the snapshot U2 removes. The location is not named.

#### Verification

`npm test` shows a finished copy. The command is `package.json` `scripts.test`. The checked path is not named.

### U2 — Remove on failure

#### Requirement references

- Issue, Acceptance / success: A failed copy leaves no file.

#### Change and touchpoints

Remove whatever U1 wrote. The consumed path is not named.

#### Depends on

U1. The consumed output is not named.

#### Verification

`npm test` shows a failed copy leaves no file. The command is `package.json` `scripts.test`.

## Order

U2 depends on U1. The handoff between them is unnamed.

## Coverage

| Requirement | Unit | Consequence | Evidence | Status |
|---|---|---|---|---|
| A finished copy contains only the text that existed when it was requested. | U1 | a snapshot exists | npm test | covered |
| A failed copy leaves no file. | U2 | no file from that call | npm test | covered |

## Self-review

Implementation-ready.
