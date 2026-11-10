const records: string[] = [];

export function send(body: string): boolean {
  if (body.length === 0) return false;
  records.push(body);
  return true;
}
