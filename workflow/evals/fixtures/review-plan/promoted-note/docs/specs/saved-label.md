---
feature: saved-label
issue: docs/issues/saved-label.md
---

# Saved label

## Contract

A save of `Ada` is still `Ada` on a later read. (Issue decision)

The stored field is `text`. (Spec decision)

An empty save does not write. The stored `text` stays. When no `text` is stored, the read returns no text. (Issue decision)

`saveLabel` currently returns the submitted text and stores nothing. (repo fact: src/label.ts)

Note: the caller could be answered from a persisted shared field `lastEmpty`.
