import assert from "node:assert/strict";
import test from "node:test";
import { total } from "./cart.mjs";

test("total sums price times quantity", () => {
  assert.equal(total([{ price: 250, qty: 2 }, { price: 100, qty: 1 }]), 600);
});
