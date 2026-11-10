import assert from "node:assert/strict";
import test from "node:test";
import { greet } from "./greet.ts";

test("greet puts a space after the comma", () => {
  assert.equal(greet("Ada"), "Hello, Ada");
});
