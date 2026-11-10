export function greet(name: string): string {
  return `Hello,${name}`;
}

export function formatNote(text: string): string {
  const trimmed = text.trim();
  return trimmed;
}
