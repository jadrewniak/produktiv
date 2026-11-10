---
feature: saved-label
issue: docs/issues/saved-label.md
spec: docs/specs/draft-label.md
---

# Saved label

## Goal

Store a label as `docs/specs/draft-label.md` decides.

## Current state

`src/label.ts` exports `saveLabel(text: string): string`. It returns the submitted text and stores nothing.

## Target

A save of `Ada` stores field `label` and a later read returns `Ada`. An empty save does not write `label`.

## Units

### U1 — Store label

#### Requirement references

- Issue: a save of `Ada` is still `Ada` on a later read.
- Spec: `docs/specs/draft-label.md`. The stored field is `label`.

#### Change and touchpoints

In `src/label.ts`, store `label` on a non-empty save. A later read returns that `label`. An empty save does not write `label`.

#### Depends on

none

#### Verification

A save of `Ada` reads back `Ada` from `label`. An empty save leaves `label` unchanged. Evidence: `npm run test`. Provenance: `.workflow/context/quality.md` row Test, source `package.json#scripts.test`.

## Coverage

| Requirement | Unit | Consequence | Evidence | Status |
|---|---|---|---|---|
| A save of Ada is still Ada on a later read. | U1 | the stored field is label | npm run test, quality.md Test | covered |
| An empty save does not write. | U1 | label stays | npm run test, quality.md Test | covered |

## Self-review

Implementation-ready.
