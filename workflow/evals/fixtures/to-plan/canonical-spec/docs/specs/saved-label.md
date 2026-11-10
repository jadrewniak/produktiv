---
feature: saved-label
issue: docs/issues/saved-label.md
---

# Saved label

## Contract

A save of `Ada` is still `Ada` on a later read. (Issue decision)

The stored field is `text`. (Spec decision)

A later read returns the stored `text`. (Issue decision)

An empty save does not write. The stored `text` stays. When no `text` is stored, the read returns no text. (Issue decision)
