import { classesOf, cssBlocksOf } from '../css-source';
import { partDependenciesOf, partSpecifierOf } from '../imports';
import { Problem } from '../problem';
import { ResolvedPart, ResolvedProduct } from '../resolve-product';
import { textsOf } from '../ts-source';

const classAttributesOf = (text: string) =>
  [...text.matchAll(/\bclass\s*=\s*["']([^"']*)/g)].flatMap((match) => (match[1] ?? '').split(/\s+/).filter(Boolean));

/** Each class a component's CSS declares a selector for, with the component that owns it. */
const ownersOf = (product: ResolvedProduct) => {
  const owners = new Map<string, ResolvedPart>();

  for (const part of product.parts) {
    if (part.layer !== 'components' || !part.cssSource) continue;

    for (const name of cssBlocksOf(part.cssSource).selectors.flatMap(classesOf)) owners.set(name, part);
  }

  return owners;
};

const copyOf = (options: { file: string; name: string; owner: ResolvedPart; how: string }): Problem => ({
  rule: 'COMPONENT-COPY',
  file: options.file,
  message: `${options.how} .${options.name} of ${partSpecifierOf(options.owner)} - import the component instead`,
});

/**
 * An element or page that restyles a component's class in its CSS, or writes a component's class
 * in its markup without importing that component.
 */
export const componentCopiesOf = (product: ResolvedProduct): Problem[] => {
  const owners = ownersOf(product);
  const ownerOf = (name: string) => owners.get(name);

  return product.parts
    .filter((part) => part.layer === 'elements' || part.layer === 'pages')
    .flatMap((part) => {
      const imported = new Set(partDependenciesOf(part).map((dependency) => dependency.specifier));
      const styled = part.css && part.cssSource ? cssBlocksOf(part.cssSource).selectors.flatMap(classesOf) : [];
      const written = textsOf(part.source).flatMap(classAttributesOf);

      return [
        ...[...new Set(styled)].flatMap((name) => {
          const owner = ownerOf(name);

          return owner ? [copyOf({ file: part.css ?? part.file, name, owner, how: 'restyles' })] : [];
        }),
        ...[...new Set(written)].flatMap((name) => {
          const owner = ownerOf(name);

          return owner && !imported.has(partSpecifierOf(owner))
            ? [copyOf({ file: part.file, name, owner, how: 'writes' })]
            : [];
        }),
      ];
    });
};
