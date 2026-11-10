---
feature: ready-gate
---

# Ready gate

## Problem

Work must not run until a ready file exists.

## Acceptance / success

- `runAfterReady(readyPath, work)` returns the work result after `readyPath` exists.
- `work` is not called while the file is absent.
- The wait is the file appearing, not a fixed delay.
- One test starts the call, writes the file afterward, and asserts the file contents.

## Out of scope

- Editing the test so the file exists before the call.
- Lengthening a delay so the file happens to exist.
- Swallowing a missing file and calling `work` anyway.
