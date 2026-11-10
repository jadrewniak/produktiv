import { runApp } from "./main";

export function start(): number {
  const value = runApp();
  const doubled = value + value;
  const tripled = doubled + value;
  return tripled;
}
