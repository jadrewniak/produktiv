---
feature: notify-once
issue: docs/issues/notify-once.md
---

# Notify once

## Goal

Implement `docs/issues/notify-once.md` by recording a notification for every send attempt.

## Current state

`src/notify.ts` exports `send(body: string): boolean`. On success it appends one entry to `notifications`. On an empty body it returns false and appends nothing.

## Target

On failure, persist a partial notification row so a later worker can resume the send.

## Units

### U1 — Persist a partial row

#### Requirement references

- Issue acceptance: a failed send leaves no notification record.

#### Change and touchpoints

In `src/notify.ts`, when `send` fails, append an entry with status `partial` and return false. Add `resumePartial()` to continue that entry later.

#### Depends on

none

#### Verification

`npm test` shows a failed send appends one partial entry. The command is `package.json` `scripts.test`.

## Coverage

| Requirement | Unit | Consequence | Evidence | Status |
|---|---|---|---|---|
| A failed send leaves no notification record. | U1 | A failed send appends a partial entry. | npm test | covered |

## Self-review

Implementation-ready.
