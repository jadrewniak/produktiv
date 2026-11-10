---
feature: notify-once
---

# Notify once

## Problem

A caller needs one notification recorded when a send succeeds, and nothing recorded when it fails.

## Desired outcome

A successful send stores one notification. A failed send stores nothing.

## User stories

- As a caller, I send a notification and, when the send succeeds, one record exists for that send.

## Decisions

### Product

- A successful send stores one notification record.

### Domain/data

- A failed send leaves no notification record. There is no partial record.

## Acceptance / success

- A successful send stores one notification record.
- A failed send leaves no notification record.

## Out of scope

- Retries.
- A queue.
