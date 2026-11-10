const live: string[] = [];

export function copy(text: string): boolean {
  live.push(text);
  return true;
}
