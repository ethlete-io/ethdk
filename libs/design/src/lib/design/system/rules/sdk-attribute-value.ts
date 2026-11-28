import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { DesignConfig } from '../../design-config';
import { renderPackagesOf, typePathsOf } from '../../render-packages';
import { Problem } from '../problem';
import { ResolvedProduct } from '../resolve-product';
import { skipRule } from '../rule-skips';
import { SdkDeclarations, sdkDeclarationsOf } from '../sdk-declarations';
import { sdkCompoundsOf } from '../sdk-selectors';
import { readsCacheOf } from '../tracked-reads';

export const SDK_ATTRIBUTE_VALUE_RULE = 'SDK-ATTRIBUTE-VALUE';

const SDK_PACKAGE = '@ethlete/components';

/** The SDK declarations a built declaration file holds, read again once the file changes. */
export const sdkDeclarationsIn = readsCacheOf({
  slotOf: (file: string) => file,
  run: (file: string) => sdkDeclarationsOf(readFileSync(file, 'utf8')),
});

const declarationFileOf = (product: ResolvedProduct) => {
  const target = resolve(product.configFile, '../../..');
  const config = existsSync(product.configFile)
    ? (JSON.parse(readFileSync(product.configFile, 'utf8')) as DesignConfig)
    : null;
  const file = typePathsOf({ target, packages: renderPackagesOf({ target, config }) })[SDK_PACKAGE]?.[0];

  return file && existsSync(file) ? file : null;
};

/**
 * Each value a part's own stylesheet selects on an SDK component class, as `[data-<input>='<value>']`, that the
 * component's input does not declare: a look the app cannot reproduce without an SDK change. Read from the declaration
 * file of `@ethlete/components` the drawings render from.
 */
export const sdkAttributeValuesOf = (
  product: ResolvedProduct,
  declarations: SdkDeclarations | null = null,
): Problem[] => {
  const styled = product.parts.filter(
    (part) => part.css && part.cssSource && /\.et-/u.test(part.cssSource) && /\[[\w-]+\s*=/u.test(part.cssSource),
  );

  if (styled.length === 0) return [];

  const file = declarations === null ? declarationFileOf(product) : null;

  if (declarations === null && file === null) {
    skipRule({
      rule: SDK_ATTRIBUTE_VALUE_RULE,
      product: product.name,
      kind: 'missing-input',
      reason: `no built declaration file of ${SDK_PACKAGE} - build it first`,
    });

    return [];
  }

  const known = declarations ?? sdkDeclarationsIn(file as string);

  return styled.flatMap((part) => {
    const seen = new Set<string>();

    return sdkCompoundsOf(part.cssSource ?? '').flatMap((compound) =>
      compound.classes.flatMap((name) => {
        const inputs = known.get(name);

        if (!inputs) return [];

        return compound.mentioned.flatMap(({ name: attribute, operator, value }) => {
          const input = attribute.replace(/^data-/u, '');
          const values = inputs.get(input);
          const at = `.${name}[${attribute}='${value}']`;

          if (operator !== '=' || value === null || !values || values.has(value) || seen.has(at)) return [];

          seen.add(at);

          return [
            {
              rule: SDK_ATTRIBUTE_VALUE_RULE,
              file: part.css as string,
              at,
              message: `${at} (line ${compound.line}) styles a value the SDK does not declare: ${name} takes ${input} ${[...values].join(', ')} - add the value to the SDK component, or style one it declares`,
            },
          ];
        });
      }),
    );
  });
};
