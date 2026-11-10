---
feature: saved-label
issue: docs/issues/saved-label.md
spec: docs/specs/saved-label.md
---

# Save a label

## Goal

Store and read a label as `docs/issues/saved-label.md` decides.

## Current state

`src/label.ts` exports `saveLabel`, which returns the submitted text and stores nothing.

## Target

`saveLabel` writes `text` when the submitted text is non-empty, and leaves `text` unchanged on an empty save. `readLabel` returns `text`.

## Units

### U1 — Write the label

**Requirements**

- Issue, Acceptance / success: An empty save leaves the previous text.
- Issue, Decisions, Product: A saved label is the text the person submitted.
- Spec, Persistence & compatibility: the stored field is `text`.

**Change**

In `src/label.ts`, change `saveLabel` so a non-empty save writes `text` and an empty save does not write.

**Depends on**

none

**Consumes / produces**

Produces the stored field `text` for a later read.

**Verification**

An empty save leaves the previous `text`. A non-empty save stores that text. Evidence: `npm run test`. Provenance: `.workflow/context/quality.md` row Test, source `package.json#scripts.test`.

### U2 — Read the label

**Requirements**

- Issue, Acceptance / success: Saving "Ada" and then reading returns "Ada".
- Spec, Interfaces: Read returns the stored label.

**Change**

In `src/label.ts`, add `readLabel`, which returns the stored `text`.

**Depends on**

U1, for the stored field `text`.

**Verification**

Saving "Ada" and then reading returns "Ada". Evidence: `npm run test`. Provenance: `.workflow/context/quality.md` row Test, source `package.json#scripts.test`.

## Order

U2 reads `text` after U1 writes it.

## Coverage

| Requirement | Unit | Consequence | Evidence | Status |
|---|---|---|---|---|
| An empty save leaves the previous text | U1 | empty save does not write | npm run test, quality.md Test | covered |
| Saving "Ada" and then reading returns "Ada" | U2 | read returns the stored text | npm run test, quality.md Test | covered |

## Self-review

Authority: pass. Per-unit readiness: pass. Cross-unit consistency: pass. Implementation-ready.
