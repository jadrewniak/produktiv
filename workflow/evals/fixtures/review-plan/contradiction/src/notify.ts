const notifications: string[] = [];

export function send(body: string): boolean {
  if (body.length === 0) return false;
  notifications.push(body);
  return true;
}
