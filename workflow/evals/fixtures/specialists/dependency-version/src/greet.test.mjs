import assert from "node:assert/strict";
import test from "node:test";
import { greet } from "./greet.mjs";

test("greet returns a hello string", () => {
  assert.equal(greet("Ada"), "Hello, Ada");
});
