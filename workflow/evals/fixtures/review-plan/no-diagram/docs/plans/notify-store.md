---
feature: notify-store
issue: docs/issues/notify-store.md
---

# Separate notification store

## Goal

Move notification rows as `docs/issues/notify-store.md` decides. Dropping `notifications` after a checked copy is costly to reverse.

## Current state

`src/notify.ts` keeps an in-memory list named `notifications`. `send` appends one entry on success. An empty body returns false and appends nothing. That list is the app table.

## Target

Copy `notifications` into `notify_store`. After the copy checks equal, read from `notify_store` and drop `notifications`. A failed check discards `notify_store`, leaves `notifications` in place, and does not switch reads.

## Units

### U1 — Copy then drop

#### Requirement references

- Issue: rows move from `notifications` to `notify_store`.
- Issue: the app table is dropped only after the copy has been checked.
- Issue: a failed copy leaves `notifications` in place and writes nothing further.
- Issue out of scope: no second service process, and no send API change.

#### Change and touchpoints

In `src/notify.ts`, add a list `notify_store`. Copy every `notifications` entry into it. If the copy has the same entries in the same order, read from `notify_store` and drop `notifications`. If the check fails, discard `notify_store` and leave `notifications` unchanged. `send(body: string): boolean` stays the signature.

#### Depends on

none

#### Verification

`npm test` covers both acceptance lines. The command is `package.json` `scripts.test`. One test checks a matching copy reads from `notify_store` with `notifications` gone. One test checks a failed copy leaves `notifications` unchanged and discards `notify_store`.

## Risks

Dropping `notifications` is the one-way step. The down-path is to discard `notify_store` and stop before that drop when the copy check fails. No second process. No API change.

## Coverage

| Requirement | Unit | Consequence | Evidence | Status |
|---|---|---|---|---|
| After a checked copy, rows are read from `notify_store` and `notifications` is gone. | U1 | switch reads only after the check, then drop | npm test | covered |
| A failed copy leaves `notifications` unchanged. | U1 | discard `notify_store`; no drop of `notifications` | npm test | covered |

## Self-review

Implementation-ready. Nothing deferred.
