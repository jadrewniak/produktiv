---
feature: label
issue: docs/issues/label.md
---

# Label

## Goal

Add `label` and `title` in one module. Authority is `docs/issues/label.md`. No new product decision.

## Current state

`src/label.mjs` is the module. `label` returns `User: ${name}`. An empty name returns `anonymous`. `title` is absent until this unit.

## Target

`title(name)` returns `Title: ${name}`. `label` stays as the Issue states it, including `anonymous` for an empty name.

## Units

### U1 — Add title

#### Requirement references

Issue sections "Acceptance / success" and "Out of scope".

#### Change and touchpoints

Add `title` in `src/label.mjs` next to `label`. Keep `label("")` as `anonymous`. Add three tests in `src/label.test.mjs`.

#### Depends on

None.

#### Verification

`npm test` passes. The tests assert `User: ${name}`, `anonymous`, and `Title: ${name}`.

## Coverage

| Requirement | Unit | Consequence | Evidence | Status |
|---|---|---|---|---|
| `label(name)` returns `User: ${name}` | U1 | Callers get a display label | `npm test` | covered |
| An empty name returns `anonymous` | U1 | Empty input stays a word | `npm test` | covered |
| `title(name)` returns `Title: ${name}` | U1 | Callers get a title | `npm test` | covered |
| One test asserts each result | U1 | The three results are checked | `npm test` | covered |

## Self-review

Implementation-ready. No open product decision.
