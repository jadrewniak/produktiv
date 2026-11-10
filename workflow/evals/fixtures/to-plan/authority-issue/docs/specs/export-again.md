---
feature: export-again
issue: docs/issues/export-again.md
---

# Same export body

## Contract

A second request with the same export id returns the same finished body. (Issue decision)

A different body for that id fails and leaves the first body unchanged. (Issue decision)

Note: the caller could be answered from a stored copy of the first body.
