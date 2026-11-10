import { access } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";

export async function runAfterReady(readyPath, work) {
  await setTimeout(15);
  try {
    await access(readyPath);
  } catch {
    // The file can appear later.
  }
  return work();
}
