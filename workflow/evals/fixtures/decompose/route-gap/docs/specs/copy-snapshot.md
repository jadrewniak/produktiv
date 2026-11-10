---
feature: copy-snapshot
issue: docs/issues/copy-snapshot.md
---

# Copy a snapshot

## Contract

A copy is a snapshot of the text that existed when it was requested. Its contents do not change afterward.

A failed copy produces no file. There is no partial file.

## Boundaries

The snapshot store is separate from the live text. A copy does not write back into live text.
