import { existsSync, readdirSync, statSync } from 'fs';
import { basename, isAbsolute, posix, resolve, sep } from 'path';
import { Problem } from '../problem';
import { partKeyOf, ResolvedProduct } from '../resolve-product';
import { harnessOf } from '../harness-map';
import { partLinkOf } from '../sketch/part-definition';

const checkoutOf = (product: ResolvedProduct) => resolve(product.configFile, '../../..');

const isFile = (path: string) => existsSync(path) && statSync(path).isFile();

/**
 * A part whose `implements` names no existing `.component.ts` (`IMPLEMENTS-MISSING`), or does not have the shape of
 * its layer: a page names `{ route: '/…' }` with an optional `component`, every other part a component path
 * (`IMPLEMENTS-SHAPE`).
 */
export const badLinksOf = (product: ResolvedProduct): Problem[] =>
  product.parts.flatMap((part): Problem[] => {
    const link = partLinkOf(part.source);
    const shape = (message: string) => [{ rule: 'IMPLEMENTS-SHAPE', file: part.file, message }];
    const component = (path: string): Problem[] => {
      if (!path.endsWith('.component.ts')) return shape(`"${path}" is no .component.ts`);
      if (isAbsolute(path)) return shape(`"${path}" must be a path from the repository root, not absolute`);

      return isFile(resolve(checkoutOf(product), path))
        ? []
        : [
            {
              rule: 'IMPLEMENTS-MISSING',
              file: part.file,
              message: `"${path}" does not exist - implements is a path from the repository root`,
            },
          ];
    };

    if (link.kind === 'none') return [];
    if (link.kind === 'unreadable')
      return shape(
        "implements must be a literal, a component path or { route: '/…', component?: '…' }, so the check can read it",
      );

    if (part.layer === 'pages') {
      if (link.kind !== 'route')
        return shape(
          `a page names its route, for example implements: { route: '/${part.name}', component: 'src/app/…/x.component.ts' }`,
        );
      if (!link.route.startsWith('/')) return shape(`the route "${link.route}" must start with /`);

      return link.component === null ? [] : component(link.component);
    }

    if (link.kind === 'route')
      return shape(`a ${part.layer} part names its component, for example implements: 'src/app/…/x.component.ts'`);

    return component(link.path);
  });

const appComponentsOf = (checkout: string, app: string) => {
  const dir = resolve(checkout, app, 'src');

  if (!existsSync(dir)) return [];

  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((path) => path.endsWith('.component.ts') && !path.split(sep).includes('node_modules'))
    .map((path) => posix.join(app, 'src', ...path.split(sep)));
};

/**
 * A product part without `implements` whose name matches a `<name>.component.ts` in its harness app
 * (`IMPLEMENTS-UNLINKED`): the rules that read the linked component would skip it silently.
 */
export const unlinkedNamesOf = (product: ResolvedProduct): Problem[] => {
  const harness = harnessOf(product);

  if (harness === null || typeof harness === 'string') return [];

  const components = appComponentsOf(checkoutOf(product), harness.app);

  return product.parts
    .filter((part) => part.origin !== 'base' && partLinkOf(part.source).kind === 'none')
    .flatMap((part) =>
      components
        .filter((path) => basename(path) === `${part.name}.component.ts`)
        .map((path) => ({
          rule: 'IMPLEMENTS-UNLINKED',
          file: part.file,
          message: `${partKeyOf(part)} has no implements, but ${path} has its name - link it with implements`,
        })),
    );
};
