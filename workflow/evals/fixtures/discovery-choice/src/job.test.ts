import assert from "node:assert/strict";
import test from "node:test";
import { finish } from "./job.ts";

test("a pending job finishes as success or failure", () => {
  const pending = { id: "job-1", status: "pending" as const };
  assert.deepEqual(finish(pending, "success"), { id: "job-1", status: "success" });
  assert.deepEqual(finish(pending, "failure"), { id: "job-1", status: "failure" });
});

test("a finished job stays finished", () => {
  const success = { id: "job-1", status: "success" as const };
  const failure = { id: "job-1", status: "failure" as const };
  assert.deepEqual(finish(success, "failure"), success);
  assert.deepEqual(finish(failure, "success"), failure);
});
