import { knownSymbol } from "../lib/known";
import { handleRequest } from "../api/handler";

export function runApp(): number {
  const known = knownSymbol();
  const handled = handleRequest();
  const doubled = known + handled;
  return doubled;
}
