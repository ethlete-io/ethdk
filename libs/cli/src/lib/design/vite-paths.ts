import { existsSync, statSync } from 'fs';
import { posix } from 'path';

const slash = (path: string) => path.replace(/\\/g, '/');

export const fsUrl = (absolutePath: string) => `/@fs/${slash(absolutePath).replace(/^\//, '')}`;

export const callSlugOf = (callFile: string) => posix.dirname(slash(callFile));

export const isCallFile = (options: { callsRoot: string; file: string }) =>
  slash(options.file).startsWith(slash(options.callsRoot)) && slash(options.file).endsWith('/call.ts');

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const aliasPattern = (key: string) =>
  key.endsWith('/*') ? new RegExp(`^${escapeRegExp(key.slice(0, -2))}/`) : new RegExp(`^${escapeRegExp(key)}$`);

const SOURCE_SUFFIXES = ['', '.ts', '.js', '.mjs', '/index.ts', '/index.js'];
const SOURCE = /\.(?:ts|js|mjs)$/u;

/** The source module `path` names, Node-style, with the extension or `/index` it leaves out; `null` for anything else. */
export const sourceFileOf = (path: string) =>
  SOURCE_SUFFIXES.map((suffix) => `${path}${suffix}`).find(
    (candidate) => SOURCE.test(candidate) && existsSync(candidate) && statSync(candidate).isFile(),
  ) ?? null;
