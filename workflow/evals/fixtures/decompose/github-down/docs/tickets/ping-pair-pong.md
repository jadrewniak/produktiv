---
feature: ping-pair
slice: pong
plan: docs/plans/ping-pair.md
issue: docs/issues/ping-pair.md
---

# Pong

## Objective

In `src/pong.ts`, `pong` returns ``Pong, ${name}``.

## Authoritative references

- Plan: U2 — Pong
- Issue, Acceptance / success: `pong("Ada")` returns `Pong, Ada`.
- Issue, Out of scope: Do not add any other public function.

## Scope

Plan U2 in `src/pong.ts`. Change `pong` so it returns ``Pong, ${name}``.

## Out of scope

- Do not add any other public function.

## Acceptance

- Issue, Acceptance / success: `pong("Ada")` returns `Pong, Ada`.

## Dependencies

none

## Verification expectation

The check in Plan U2. `node --test` asserts `pong("Ada")` is `Pong, Ada`. The command is `package.json` `scripts.test`.
