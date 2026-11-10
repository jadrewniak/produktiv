---
feature: notify-store
---

# Separate notification store

## Problem

Notification rows live in the app table. They need their own store, without losing a failed copy.

## Desired outcome

A checked copy is read from the new store, and the app table is gone. A failed copy leaves the app table as it was.

## Decisions

### Domain/data

- Notification rows move from the app table `notifications` into a separate store `notify_store`.
- The app table is dropped only after a copy of its rows has been checked.
- A failed copy leaves `notifications` in place and writes nothing further.

## Acceptance / success

- After a checked copy, notification rows are read from `notify_store` and `notifications` is gone.
- A failed copy leaves `notifications` unchanged.

## Out of scope

- A second service process.
- Changing the send API.
