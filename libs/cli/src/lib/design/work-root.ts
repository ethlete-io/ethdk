import { resolve } from 'path';

/** Everything the tool writes for a checkout, so nothing generated lands in tracked files. */
export const workRootOf = (target: string) => resolve(target, 'node_modules/.design-explore');
