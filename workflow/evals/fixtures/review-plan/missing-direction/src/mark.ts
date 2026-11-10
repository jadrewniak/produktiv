let current = "Mark, Ada";

export function mark(name: string): string {
  current = `Mark, ${name}`;
  return current;
}

export function read(): string {
  return current;
}
