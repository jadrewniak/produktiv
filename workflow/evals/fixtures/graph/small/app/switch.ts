import { knownSymbol } from "../lib/known";

export function switched(): number {
  const value = knownSymbol();
  const doubled = value + value;
  const tripled = doubled + value;
  return tripled;
}
