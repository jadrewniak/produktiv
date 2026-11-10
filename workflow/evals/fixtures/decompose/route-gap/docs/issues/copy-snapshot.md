---
feature: copy-snapshot
---

# Copy a snapshot

## Problem

A caller needs a copy of text they can keep.

## Desired outcome

A finished copy stores that text. A failed copy stores nothing.

## Acceptance / success

- A finished copy contains only the text that existed when it was requested.
- A failed copy leaves no file.

## Out of scope

- Retries.
- Editing the live text from the snapshot.
