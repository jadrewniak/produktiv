---
feature: export-snapshot
---

# Export a finished snapshot

## Problem

An account holder needs a copy of their records they can keep. The copy has to be a finished snapshot. It must not be a view that changes while they take it.

## Desired outcome

The account holder receives one finished export of the records that existed when the export was requested.

## User stories

- As an account holder, I request an export and receive one finished file of the records that existed at request time.

## Decisions

### Product

- An export is a snapshot of the records that existed when it was requested. Its contents do not change afterward.

### Domain/data

- An export is either incomplete or finished. A failed export produces no file. There is no partial file.

## Acceptance / success

- A finished export contains only the records that existed when it was requested.
- A failed export leaves no file.

## Evidence and references

- `docs/adr/0001-export-store.md` — an export is stored apart from the live record table, and writing an export does not update live records.

## Out of scope

- Scheduling recurring exports.
- Editing records from the export.

## Open material questions

- Who, besides the account holder, may request an export of that account?
