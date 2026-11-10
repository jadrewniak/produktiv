export function label(name) {
  // REVIEW: IMPORTANT — empty name must return null. Fix: if (name.length === 0) return null;
  if (name.length === 0) {
    return "anonymous";
  }
  return `User: ${name}`;
}

export function title(name) {
  return `Title:${name}`;
}
