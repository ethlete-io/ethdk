import { existsSync, realpathSync } from 'fs';
import { relative, resolve } from 'path';

const insideOf = (root: string, path: string) => {
  const found = relative(root, path);

  return found !== '' && !found.startsWith('..');
};

/**
 * Everything the tool writes for a checkout, so nothing generated lands in tracked files. It is `node_modules/.design-explore`
 * unless that folder resolves outside the checkout (a symlink to another tree): then it is `.ethlete/cache/design-explore`.
 */
export const workRootOf = (target: string) => {
  const modules = resolve(target, 'node_modules');

  return !existsSync(modules) || insideOf(realpathSync(target), realpathSync(modules))
    ? resolve(modules, '.design-explore')
    : resolve(target, '.ethlete/cache/design-explore');
};
