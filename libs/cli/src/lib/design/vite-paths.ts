import { posix } from 'path';

const slash = (path: string) => path.replace(/\\/g, '/');

export const fsUrl = (absolutePath: string) => `/@fs/${slash(absolutePath).replace(/^\//, '')}`;

export const callSlugOf = (callFile: string) => posix.dirname(slash(callFile));

export const isCallFile = (options: { callsRoot: string; file: string }) =>
  slash(options.file).startsWith(slash(options.callsRoot)) && slash(options.file).endsWith('/call.ts');

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const aliasPattern = (key: string) =>
  key.endsWith('/*') ? new RegExp(`^${escapeRegExp(key.slice(0, -2))}/`) : new RegExp(`^${escapeRegExp(key)}$`);
