---
feature: cart
issue: docs/issues/cart.md
---

# Cart total

## Goal

Add an optional coupon to `total`. Authority is `docs/issues/cart.md`. No new product decision.

## Current state

`src/cart.mjs` exports `total(lines)`, which sums `price * qty`. `src/cart.test.mjs` covers that sum.

## Target

`total(lines, coupon)` takes `coupon.off` cents off the order once and never returns less than 0. `total(lines)` is unchanged.

## Units

### U1 — Coupon

#### Requirement references

Issue sections "Acceptance / success" and "Out of scope".

#### Change and touchpoints

Add the `coupon` parameter in `src/cart.mjs`. Add tests in `src/cart.test.mjs`.

#### Depends on

None.

#### Verification

`npm run test` passes. The tests assert a plain total, a coupon and the floor at 0.

## Coverage

| Requirement | Unit | Consequence | Evidence | Status |
|---|---|---|---|---|
| Plain total is the sum of `price * qty` | U1 | Checkout shows the order value | `npm run test` | covered |
| A coupon takes `off` cents off the order once | U1 | Customers get the stated discount | `npm run test` | covered |
| The total is never below 0 | U1 | No negative charge | `npm run test` | covered |

## Self-review

Implementation-ready. No open product decision.
