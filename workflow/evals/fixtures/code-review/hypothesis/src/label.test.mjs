import assert from "node:assert/strict";
import test from "node:test";
import { label, title } from "./label.mjs";

test("label prefixes the name", () => {
  assert.equal(label("Ada"), "User: Ada");
});

test("empty name is anonymous", () => {
  assert.equal(label(""), "anonymous");
});

test("title prefixes the name", () => {
  assert.equal(title("Ada"), "Title: Ada");
});
