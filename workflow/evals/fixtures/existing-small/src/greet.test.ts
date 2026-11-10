import assert from "node:assert/strict";
import test from "node:test";
import { greet } from "./greet.ts";

test("greet returns a hello string", () => {
  assert.equal(greet("Ada"), "Hello, Ada");
});
