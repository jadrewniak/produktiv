export function rename(label, name) {
  const trimmed = name.trim();
  if (!trimmed) return label;
  return { ...label, name: trimmed };
}
