import { knownSymbol, removeMe, oldName } from "../lib/known";

export function useLib(): number {
  const value = knownSymbol();
  const removed = removeMe();
  const renamed = oldName();
  return value + removed + renamed;
}
