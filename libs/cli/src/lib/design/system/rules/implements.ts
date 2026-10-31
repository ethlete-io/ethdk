import { existsSync, statSync } from 'fs';
import { isAbsolute, resolve } from 'path';
import { Problem } from '../problem';
import { ResolvedProduct } from '../resolve-product';
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
