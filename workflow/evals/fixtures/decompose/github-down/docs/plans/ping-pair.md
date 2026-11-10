---
feature: ping-pair
issue: docs/issues/ping-pair.md
---

# Ping and pong

## Goal

Implement `docs/issues/ping-pair.md`.

## Current state

`src/ping.ts` exports `ping(name: string): string`, which returns `name`. `src/pong.ts` exports `pong(name: string): string`, which returns `name`.

## Target

`ping("Ada")` returns `Ping, Ada`. `pong("Ada")` returns `Pong, Ada`.

## Units

### U1 — Ping

#### Requirement references

- Issue, Acceptance / success: `ping("Ada")` returns `Ping, Ada`.
- Issue, Out of scope: Do not add any other public function.

#### Change and touchpoints

In `src/ping.ts`, change `ping` so it returns ``Ping, ${name}``.

#### Depends on

none

#### Consumes / Produces

none

#### Verification

`node --test` asserts `ping("Ada")` is `Ping, Ada`. The command is `package.json` `scripts.test`.

### U2 — Pong

#### Requirement references

- Issue, Acceptance / success: `pong("Ada")` returns `Pong, Ada`.
- Issue, Out of scope: Do not add any other public function.

#### Change and touchpoints

In `src/pong.ts`, change `pong` so it returns ``Pong, ${name}``.

#### Depends on

none

#### Consumes / Produces

none

#### Verification

`node --test` asserts `pong("Ada")` is `Pong, Ada`. The command is `package.json` `scripts.test`.

## Coverage

| Requirement | Unit | Consequence | Evidence | Status |
|---|---|---|---|---|
| ping("Ada") returns Ping, Ada | U1 | that return value | node --test | covered |
| pong("Ada") returns Pong, Ada | U2 | that return value | node --test | covered |

## Self-review

Implementation-ready.
