export function total(lines, coupon) {
  let sum = 0;
  for (const line of lines) {
    sum += line.price * line.qty;
  }
  if (coupon) {
    sum -= coupon.off;
  }
  return Math.max(0, sum);
}
