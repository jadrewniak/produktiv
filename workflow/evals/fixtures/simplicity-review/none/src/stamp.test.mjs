import assert from "node:assert/strict";
import test from "node:test";
import { stamp } from "./stamp.mjs";

test("stamp prefixes the name", () => {
  assert.equal(stamp("Ada"), "Stamp: Ada");
});
