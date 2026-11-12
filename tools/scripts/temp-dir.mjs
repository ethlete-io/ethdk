import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tempDirs = [];
const removeTempDirs = () => tempDirs.splice(0).forEach((dir) => rmSync(dir, { recursive: true, force: true }));

/** Makes a temp directory that is removed when the process exits, and returns its path. */
export const tempDir = (prefix) => {
  if (!tempDirs.length) process.once('exit', removeTempDirs);
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
};
