---
feature: ping-count
issue: docs/issues/ping-count.md
---

# Count one ping

## Goal

Add `count` beside `ping` as `docs/issues/ping-count.md` decides.

## Current state

`src/ping.ts` exports `ping(): string`, which returns `pong`.

## Target

Export `count(): number` from `src/ping.ts`, returning `1`. `ping` stays.

## Units

### U1 — Count beside ping

#### Requirement references

- Issue: `count()` returns `1`.
- Issue: `ping()` still returns `pong`.
- Issue out of scope: any other public function.

#### Change and touchpoints

In `src/ping.ts`, add `export function count(): number` returning `1`. Leave `ping` as it is.

#### Depends on

none

#### Verification

`count()` returns `1`. `ping()` returns `pong`. Evidence: `npm test`. Provenance: the project test command is `npm test`. No other public function is added.

## Coverage

| Requirement | Unit | Consequence | Evidence | Status |
|---|---|---|---|---|
| count() returns 1 | U1 | that return | npm test | covered |
| ping() returns pong | U1 | ping unchanged | npm test | covered |
| No other public function | U1 | count is the only addition | npm test | covered |

## Self-review

Implementation-ready.
