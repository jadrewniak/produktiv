---
feature: cart
---

# Cart total

## Problem

Checkout needs the order total with an optional coupon.

## Acceptance / success

- `total(lines)` returns the sum of `price * qty` over the lines, in cents.
- `total(lines, coupon)` takes `coupon.off` cents off the order once, whatever the number of lines.
- The total is never below 0.
- Tests cover a plain total, a coupon and the floor at 0.

## Out of scope

- Percentage coupons.
- Tax and currency.
