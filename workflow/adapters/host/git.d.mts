/** Types for the argv-safe Git helper. The implementation is git.mjs. */
export function head(cwd: string): Promise<string>;
export function listTree(cwd: string): Promise<string[]>;
export function show(cwd: string, filePath: string): Promise<Buffer>;
export function diffNames(cwd: string, args?: string[]): Promise<string[]>;
export function untrackedNames(cwd: string): Promise<string[]>;
export const GIT_TIMEOUT_MS: number;
export const GIT_SNAPSHOT_TIMEOUT_MS: number;
export interface WorkingTree {
  hash(): Promise<string>;
  base(rev?: string): Promise<string>;
  hasTree(sha: string): Promise<boolean>;
  stats(from: string, to: string): Promise<Array<{ path: string; status: string; added: number | null; deleted: number | null; binary: boolean }>>;
  diffNames(from: string, to: string): Promise<string[]>;
  patch(from: string, to: string): Promise<string>;
  dirtySubmodules(): Promise<string[]>;
  close(): void;
}
export function openWorkingTree(cwd: string, options?: { exclude?: string[]; objectDir?: string | null }): Promise<WorkingTree>;
