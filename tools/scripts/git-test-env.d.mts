import type { ExecFileSyncOptions, SpawnSyncOptions, SpawnSyncReturns } from 'node:child_process';

export function gitEnv(extra?: Record<string, string | undefined>): NodeJS.ProcessEnv;
export function gitExec(args: string[], options?: ExecFileSyncOptions & { encoding?: BufferEncoding }): string & Buffer;
export function gitSpawn(
  args: string[],
  options?: SpawnSyncOptions,
): SpawnSyncReturns<string> & SpawnSyncReturns<Buffer>;
export function git(dir: string, ...args: string[]): string;
export function tempGitRepo(prefix?: string): string;
