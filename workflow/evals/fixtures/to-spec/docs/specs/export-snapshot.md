---
feature: export-snapshot
issue: docs/issues/export-snapshot.md
---

# Export a finished snapshot

## Contract

The Issue's user story is the account holder who requests an export and receives one finished file.

An export is a snapshot of the records that existed when it was requested. Its contents do not change afterward.

An export is either incomplete or finished. A failed export produces no file. There is no partial file.

The stable seam is that finished file, or its absence. A finished export contains only the records that existed when it was requested. After a failure, the seam shows no file.

## Boundaries

The export store is separate from the live record table (`docs/adr/0001-export-store.md`). An export does not write back into live records. Inference from that split and from the snapshot decision: the export depends on a snapshot of the live records, and the live records do not depend on the export.

## Non-goals

Scheduling recurring exports. Editing records from the export.
