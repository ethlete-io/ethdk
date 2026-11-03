import { relative, resolve } from 'path';
import { DesignConfig } from '../paths';
import { createDesignServer } from '../serve';
import { partOwnerOf } from './inventory-approval';
import { GO_FILE, readGo } from './part-go';
import { Problem } from './problem';
import { partKeyOf, ResolvedPart, ResolvedProduct } from './resolve-product';
import { productModuleIdOf } from './system-modules';

export const ACTION_LOST_RULE = 'ACTION-LOST';

/** Loads the module of a part file as `product` draws it. */
export type PartModuleLoader = (options: { file: string; product: string }) => Promise<unknown>;

const ACTION_ATTRIBUTE = /\sdata-et-action\s*=\s*(?:"([^"]*)"|'([^']*)')/gu;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** The sorted, distinct `data-et-action` values of a markup string. */
export const actionKeysOfMarkup = (markup: string) =>
  [
    ...new Set(
      [...markup.matchAll(ACTION_ATTRIBUTE)].map((match) => (match[1] ?? match[2] ?? '').trim()).filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b));

/**
 * The sorted action keys a part definition declares across all its states, read from the markup its `render` returns
 * outside a browser. A state whose render throws declares nothing.
 */
export const declaredActionsOf = async (definition: unknown): Promise<string[]> => {
  if (!isRecord(definition) || typeof definition['render'] !== 'function' || !isRecord(definition['states'])) return [];

  const render = definition['render'] as (props: unknown) => unknown;
  const keys = new Set<string>();

  for (const props of Object.values(definition['states'])) {
    const drawn = await Promise.resolve()
      .then(() => render(props))
      .catch(() => null);

    if (isRecord(drawn) && typeof drawn['body'] === 'string')
      for (const key of actionKeysOfMarkup(drawn['body'])) keys.add(key);
  }

  return [...keys].sort((a, b) => a.localeCompare(b));
};

const definitionOf = async (options: { load: PartModuleLoader; product: ResolvedProduct; part: ResolvedPart }) => {
  const module = await options.load({ file: options.part.file, product: options.product.name });

  return isRecord(module) ? module['default'] : undefined;
};

/** The declared action keys of one part, or why they could not be read. */
export const partActionsOf = async (options: {
  load: PartModuleLoader;
  product: ResolvedProduct;
  part: string;
}): Promise<string[] | string> => {
  const resolved = options.product.parts.find((candidate) => partKeyOf(candidate) === options.part);

  if (!resolved) return `product "${options.product.name}" has no part "${options.part}"`;

  try {
    return await declaredActionsOf(await definitionOf({ ...options, part: resolved }));
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
};

/** Every action key some part of the product declares now; a part that cannot be loaded declares nothing. */
export const productActionsOf = async (options: { load: PartModuleLoader; product: ResolvedProduct }) => {
  const keys = new Set<string>();

  for (const part of options.product.parts) {
    const declared = await partActionsOf({ ...options, part: partKeyOf(part) });

    if (typeof declared !== 'string') for (const key of declared) keys.add(key);
  }

  return keys;
};

/** Runs `use` with a loader on a design server of its own, closed afterwards. */
export const withPartLoader = async <T>(
  options: { target: string; config: DesignConfig },
  use: (load: PartModuleLoader) => Promise<T>,
) => {
  const server = await createDesignServer({ target: options.target, config: options.config, listen: false });

  try {
    return await use(({ file, product }) => server.ssrLoadModule(productModuleIdOf({ file, product })));
  } finally {
    await server.close();
  }
};

/** The directories whose go.json can hold a go of a part of the product. */
const goDirsOf = (product: ResolvedProduct) =>
  new Set([product.dir, ...product.parts.map((part) => partOwnerOf({ product, part }).dir)]);

/**
 * An ACTION-LOST problem for every action key a go recorded that no part of the product declares now. A go without
 * recorded actions is skipped; a new go of the part records its current actions and so confirms the removal.
 */
export const actionLostOf = (options: {
  target: string;
  product: ResolvedProduct;
  declared: ReadonlySet<string>;
  invocation: string;
}): Problem[] => {
  const { product, declared, invocation } = options;

  return [...goDirsOf(product)].flatMap((dir) => {
    const file = relative(options.target, resolve(dir, GO_FILE));

    return Object.entries(readGo(dir)).flatMap(([part, go]) =>
      (go.actions ?? [])
        .filter((key) => !declared.has(key))
        .map((key) => ({
          rule: ACTION_LOST_RULE,
          file,
          message: `${product.name} ${part}: action "${key}" was declared at the go of ${go.at.slice(0, 10)} and exists nowhere now - draw it again, or confirm the removal with a new go: ${invocation} go ${part} --product ${product.name} --by <name>`,
        })),
    );
  });
};

/** Reads the declared action keys of a part for its go, or why not. */
export type GoActionsOf = (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  part: string;
}) => Promise<string[] | string>;

export const goActionsOf: GoActionsOf = ({ target, config, product, part }) =>
  withPartLoader({ target, config }, (load) => partActionsOf({ load, product, part }));
