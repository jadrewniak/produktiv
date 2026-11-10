---
feature: saved-label
issue: docs/issues/saved-label.md
---

# Save a label — System contract

## Contract

### Model

One current label is stored. That label is the text from the last non-empty save. (Issue decision)

### Lifecycle

A save with text replaces the stored label. An empty save leaves the stored label unchanged. (Issue decision)

### Interfaces

Save accepts the submitted text. When that text is non-empty, the stored label becomes that text. When it is empty, the stored label stays. Read returns the stored label. (Issue decision)

### Persistence & compatibility

The stored field is `text`. (Spec decision)

Current `saveLabel` returns the submitted text and stores nothing. (repo fact: src/label.ts)

The target keeps `text` and does not write it on an empty save. (Spec decision)

## Boundaries

The label store owns `text`. A reader takes the stored label from that store and does not keep a second copy. (Spec decision)

## Non-goals

Sharing a label with another person.