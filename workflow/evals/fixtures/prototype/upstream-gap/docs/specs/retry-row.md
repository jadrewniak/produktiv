---
feature: retry-row
issue: docs/issues/retry-row.md
---

# Retry a failed job from its row

## Contract

A failed job stays failed. The list shows the status word and no retry control. (Spec decision)

## Non-goals

A control that returns a failed job to pending.
