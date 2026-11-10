import { resolve } from 'path';
import { DesignConfig } from '../design-config';
import { ACTION_LOST_RULE } from './build-ready-contract';
import { READY_FILE, readReady } from './part-ready';
import { Problem } from './problem';
import { partKeyOf, ResolvedPart, ResolvedProduct } from './resolve-product';
import { productModuleIdOf } from './system-modules';
import { loadingOn, WarmDraw } from '../warm-draw';

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
  options: { target: string; config: DesignConfig; warm?: WarmDraw },
  use: (load: PartModuleLoader) => Promise<T>,
) =>
  loadingOn(options, (server) =>
    use(({ file, product }) => server.ssrLoadModule(productModuleIdOf({ file, product }))),
  );

/**
 * An ACTION-LOST problem for every action key a check record in the product's ready.json holds that no part of the
 * product declares now, at the part's file. A record without actions is skipped.
 */
export const actionLostOf = (options: {
  product: ResolvedProduct;
  declared: ReadonlySet<string>;
  invocation: string;
  part?: string;
}): Problem[] => {
  const { product, declared, invocation } = options;

  return Object.entries(readReady(product.dir))
    .filter(([part]) => !options.part || part === options.part)
    .flatMap(([part, record]) => {
      const file =
        product.parts.find((candidate) => partKeyOf(candidate) === part)?.file ?? resolve(product.dir, READY_FILE);

      return (record.actions ?? [])
        .filter((key) => !declared.has(key))
        .map((key) => ({
          rule: ACTION_LOST_RULE,
          file,
          at: `${part} ${key}`,
          message: `action "${key}" is in the check record of ${part} from ${record.at.slice(0, 10)} and exists nowhere in ${product.name} now - draw it again, or confirm the removal: delete it from the actions of ${part} in ${READY_FILE} and run ${invocation} check --product ${product.name}`,
        }));
    });
};

/** The ACTION-LOST problems of a product, against the actions its parts declare now. */
export const actionLostProblemsOf = async (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  invocation: string;
  part?: string;
  load?: PartModuleLoader;
  warm?: WarmDraw;
}) => {
  const recorded = Object.values(readReady(options.product.dir)).some((record) => (record.actions ?? []).length > 0);

  if (!recorded) return [];

  const declared = options.load
    ? await productActionsOf({ load: options.load, product: options.product })
    : await withPartLoader(options, (load) => productActionsOf({ load, product: options.product }));

  return actionLostOf({ ...options, declared });
};

/** Reads the declared action keys of a part for its go, or why not. */
export type GoActionsOf = (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  part: string;
}) => Promise<string[] | string>;

/** Reads the declared action keys of a part on a design server, or why not; the check record holds them. */
export const declaredPartActionsOf = (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  part: string;
  warm?: WarmDraw;
}) => withPartLoader(options, (load) => partActionsOf({ load, product: options.product, part: options.part }));

export const goActionsOf: GoActionsOf = declaredPartActionsOf;
