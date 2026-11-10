import assert from "node:assert/strict";
import test from "node:test";
import { mark } from "./mark.ts";

test("mark returns a mark string", () => {
  assert.equal(mark("Ada"), "Mark, Ada");
});
