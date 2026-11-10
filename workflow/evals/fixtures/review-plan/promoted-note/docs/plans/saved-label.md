---
feature: saved-label
issue: docs/issues/saved-label.md
---

# Saved label

## Goal

Store a label as the Issue and the Spec require, and keep the last empty attempt.

## Current state

`src/label.ts` exports `saveLabel(text: string): string`. It returns the submitted text and stores nothing.

## Target

A save of `Ada` stores field `text` and a later read returns `Ada`. An empty save does not write `text`. The route also persists shared field `lastEmpty`.

## Units

### U1 — Text and last empty

#### Requirement references

- Issue: a save of `Ada` is still `Ada` on a later read.
- Spec decision: the stored field is `text`.
- Spec note: persist shared field `lastEmpty` and answer from that field.

#### Change and touchpoints

In `src/label.ts`, store `text` on a non-empty save. A later read returns that `text`. An empty save does not write `text`. Also persist shared field `lastEmpty` on an empty save, as the Spec note says. A later read of that shared field returns the empty attempt. The later read of a saved `Ada` still returns `Ada`.

#### Depends on

none

#### Verification

A save of `Ada` reads back `Ada`. An empty save leaves `text` unchanged. The persisted shared field `lastEmpty` is readable after that empty save. Evidence: `npm run test`. Provenance: `.workflow/context/quality.md` row Test, source `package.json#scripts.test`.

## Coverage

| Requirement | Unit | Consequence | Evidence | Status |
|---|---|---|---|---|
| A save of Ada is still Ada on a later read. | U1 | the stored text is Ada | npm run test, quality.md Test | covered |
| An empty save does not write. | U1 | text stays | npm run test, quality.md Test | covered |
| Spec note: persist shared field lastEmpty. | U1 | lastEmpty is stored and shared | npm run test, quality.md Test | covered |

## Self-review

Implementation-ready.
