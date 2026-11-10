---
feature: ping-pair
slice: ping
plan: docs/plans/ping-pair.md
issue: docs/issues/ping-pair.md
---

# Ping

## Objective

In `src/ping.ts`, `ping` returns ``Ping, ${name}``.

## Authoritative references

- Plan: U1 — Ping
- Issue, Acceptance / success: `ping("Ada")` returns `Ping, Ada`.
- Issue, Out of scope: Do not add any other public function.

## Scope

Plan U1 in `src/ping.ts`. Change `ping` so it returns ``Ping, ${name}``.

## Out of scope

- Do not add any other public function.

## Acceptance

- Issue, Acceptance / success: `ping("Ada")` returns `Ping, Ada`.

## Dependencies

none

## Verification expectation

The check in Plan U1. `node --test` asserts `ping("Ada")` is `Ping, Ada`. The command is `package.json` `scripts.test`.
