import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { setTimeout } from "node:timers/promises";
import { runAfterReady } from "./gate.mjs";

test("work runs after the ready file exists", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "ready-"));
  const readyPath = path.join(dir, "ready");
  let outcome;
  const pending = runAfterReady(readyPath, async () => {
    const text = await readFile(readyPath, "utf8");
    return text.trim();
  }).then(
    (value) => {
      outcome = { value };
    },
    (error) => {
      outcome = { error };
    },
  );
  await setTimeout(80);
  await writeFile(readyPath, "ok\n");
  try {
    await pending;
    if (outcome.error) throw outcome.error;
    assert.equal(outcome.value, "ok");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
