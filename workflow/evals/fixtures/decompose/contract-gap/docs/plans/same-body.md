---
feature: same-body
issue: docs/issues/same-body.md
---

# Same finished body

## Goal

Implement `docs/issues/same-body.md`.

## Current state

`src/hold.ts` exports `remember(id: string, body: string): string`. It returns `body` and stores nothing.

## Target

The first body for an id is written to `holds.json` under that id. A second request with the same id returns that body. A different body throws `HoldConflict` and leaves the file unchanged.

## Units

### U1 — File of finished bodies

#### Requirement references

- Issue, Acceptance / success: A second request with the same id returns the same finished body.
- Issue, Acceptance / success: A different body for that id fails and leaves the first body unchanged.

#### Change and touchpoints

Add `holds.json`. `remember` writes the first body under `id`. A later call with the same id and the same body reads that file and returns the body. A later call with a different body throws `HoldConflict` and does not change the file.

#### Depends on

none

#### Verification

A second `remember(id, body)` returns the first body. A different body throws `HoldConflict` and the file still holds the first body. The command is `package.json` `scripts.test`.

## Coverage

| Requirement | Unit | Consequence | Evidence | Status |
|---|---|---|---|---|
| A second request with the same id returns the same finished body. | U1 | the file body is returned | npm test | covered |
| A different body for that id fails and leaves the first body unchanged. | U1 | HoldConflict, file unchanged | npm test | covered |

## Self-review

Implementation-ready.
