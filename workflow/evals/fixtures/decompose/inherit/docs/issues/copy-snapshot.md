---
feature: copy-snapshot
---

# Copy a snapshot

## Problem

A caller needs a copy of text they can keep. The copy has to be the text that existed when they requested it.

## Desired outcome

A finished copy stores that text. A failed copy stores nothing.

## User stories

- As a caller, I request a copy and receive one finished snapshot of the text that existed at request time.

## Decisions

### Product

- A finished copy contains only the text that existed when it was requested.

### Domain/data

- A failed copy leaves no file.

## Acceptance / success

- A finished copy contains only the text that existed when it was requested.
- A failed copy leaves no file.

## Out of scope

- Retries.
- Editing the live text from the snapshot.
