export function total(lines, coupon) {
  let sum = 0;
  for (const line of lines) {
    let amount = line.price * line.qty;
    if (coupon) {
      amount -= coupon.off;
    }
    sum += amount;
  }
  return Math.max(0, sum);
}
