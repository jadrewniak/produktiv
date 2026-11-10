import assert from "node:assert/strict";
import test from "node:test";
import { total } from "./cart.mjs";

test("total sums price times quantity", () => {
  assert.equal(total([{ price: 250, qty: 2 }, { price: 100, qty: 1 }]), 600);
});

test("a coupon takes its amount off the order", () => {
  assert.equal(total([{ price: 1000, qty: 2 }], { off: 300 }), 1700);
});

test("the total is never below 0", () => {
  assert.equal(total([{ price: 100, qty: 1 }], { off: 500 }), 0);
});
