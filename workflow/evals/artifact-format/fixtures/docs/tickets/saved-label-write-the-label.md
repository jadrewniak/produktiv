---
feature: saved-label
slice: write-the-label
plan: docs/plans/saved-label.md
issue: docs/issues/saved-label.md
spec: docs/specs/saved-label.md
---

# Write the label

## Objective

A non-empty save writes `text`, and an empty save does not. The Plan states that change under U1 — Write the label.

## Authoritative references

- Plan: U1 — Write the label
- Issue, Acceptance / success: An empty save leaves the previous text.
- Issue, Decisions, Product: A saved label is the text the person submitted.
- Spec, Persistence & compatibility: the stored field is `text`.

## Scope

`saveLabel` in `src/label.ts`. A non-empty save writes `text`. An empty save leaves `text` unchanged.

## Out of scope

- Sharing a label with another person.

## Acceptance

- Issue, Acceptance / success: An empty save leaves the previous text.
- Issue, Decisions, Product: A saved label is the text the person submitted.

## Dependencies

none

## Verification expectation

The check named in Plan U1. `npm run test` shows an empty save leaves the previous `text`, and a non-empty save stores that text. The command is `.workflow/context/quality.md` row Test.
