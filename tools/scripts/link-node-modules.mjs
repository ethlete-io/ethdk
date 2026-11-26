import { existsSync, lstatSync, mkdirSync, readdirSync, readlinkSync, symlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

/** Links the dependencies of `root` into a checkout of it, with `@ethlete/*` pointing at the checkout's own libs. */
export const linkNodeModules = (root, checkout) => {
  const source = join(root, 'node_modules');
  if (!existsSync(source)) return;

  const target = join(checkout, 'node_modules');
  mkdirSync(target);

  for (const name of readdirSync(source)) {
    const entry = join(source, name);
    if (lstatSync(entry).isSymbolicLink()) {
      symlinkSync(readlinkSync(entry), join(target, name));
    } else if (name === '@ethlete') {
      mkdirSync(join(target, name));
      for (const scoped of readdirSync(entry)) {
        symlinkSync(readlinkSync(join(entry, scoped)), join(target, name, scoped));
      }
    } else {
      symlinkSync(entry, join(target, name));
    }
  }

  const nestedNodeModules = ['libs', 'apps', 'tools']
    .filter((top) => existsSync(join(root, top)))
    .flatMap((top) => [
      join(top, 'node_modules'),
      ...readdirSync(join(root, top)).map((project) => join(top, project, 'node_modules')),
    ]);

  for (const nested of nestedNodeModules) {
    if (
      existsSync(join(root, nested)) &&
      existsSync(dirname(join(checkout, nested))) &&
      !existsSync(join(checkout, nested))
    ) {
      symlinkSync(join(root, nested), join(checkout, nested));
    }
  }
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const [root, checkout] = process.argv.slice(2);
  linkNodeModules(resolve(root), resolve(checkout));
}
