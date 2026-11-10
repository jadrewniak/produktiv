export type Row = { id: string };

/** Current writer. A failed read still returns the rows already collected. */
export function writeExport(rows: Row[], failAt: number | null): string {
  let body = "";
  for (let i = 0; i < rows.length; i++) {
    if (failAt !== null && i === failAt) return body;
    body += rows[i].id + "\n";
  }
  return body;
}
