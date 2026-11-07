import postcss from 'postcss';
import { Problem } from '../problem';
import { ResolvedProduct } from '../resolve-product';

export const SDK_PRIVATE_VAR_RULE = 'SDK-PRIVATE-VAR';

const SDK_PRODUCT = 'sdk';

/**
 * Each `--_et-*` custom property a part's own stylesheet sets: the private variables of an SDK component, which the app
 * cannot rely on without an SDK change. The `sdk` product mirrors the SDK and is exempt.
 */
export const sdkPrivateVarsOf = (product: ResolvedProduct): Problem[] => {
  if (product.name === SDK_PRODUCT) return [];

  return product.parts.flatMap((part) => {
    if (!part.css || !part.cssSource || !part.cssSource.includes('--_et-')) return [];

    let root: postcss.Root;

    try {
      root = postcss.parse(part.cssSource);
    } catch {
      return [];
    }

    const seen = new Set<string>();
    const problems: Problem[] = [];

    root.walkDecls(/^--_et-/u, (decl) => {
      const at = `${decl.parent && 'selector' in decl.parent ? decl.parent.selector : ''} { ${decl.prop} }`;

      if (seen.has(at)) return;

      seen.add(at);
      problems.push({
        rule: SDK_PRIVATE_VAR_RULE,
        file: part.css as string,
        at,
        message: `${decl.prop} (line ${decl.source?.start?.line ?? 0}) sets a private variable of an SDK component - add a public input or token to the SDK component, or drop the override`,
      });
    });

    return problems;
  });
};
