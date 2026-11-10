export function total(lines) {
  let sum = 0;
  for (const line of lines) {
    sum += line.price * line.qty;
  }
  return sum;
}
