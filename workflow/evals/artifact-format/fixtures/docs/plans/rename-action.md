<!-- produktiv: {"version":1,"feature":"rename-action"} -->

# Rename the save action

**Date:** 2026-10-09

Make the existing action say “Save draft”; do not change its behavior. This is an illustrative small-change Plan, not executed evidence.

## Source brief

The user requested replacing “Save” with “Save draft” in the editor toolbar, with existing save behavior unchanged.

## Current seam

In this fictional fixture, `src/editor/Toolbar.tsx` owns the label and `src/editor/Toolbar.test.tsx` checks its accessible name and click handler. The existing `package.json` defines `npm test -- Toolbar`.

## Route

### U1 — Action label

Change the toolbar label and update the existing name assertion. Preserve the handler, keyboard activation and disabled state. No dependencies or new contracts.

Proof: run the confirmed toolbar test command above; expect the new accessible name and unchanged handler/disabled assertions. This is planned proof, not PASS.

## Coverage and self-review

The requested label maps to U1's accessible-name assertion; preservation maps to its existing interaction assertions. Authority, U1 readiness and cross-unit consistency have no unresolved choices in this illustrative fixture.
