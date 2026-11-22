import { PartModuleLoader } from './action-lost';
import { partKeyOf, ResolvedProduct } from './resolve-product';

const PART_MARK = /\sdata-et-part\s*=\s*(?:"([^"]*)"|'([^']*)')/gu;

type Definition = Record<string, unknown> & { states: Record<string, unknown> };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const marksPart = (markup: string, part: string) =>
  [...markup.matchAll(PART_MARK)].some((match) => (match[1] ?? match[2] ?? '').split(/\s+/u).includes(part));

const runsSetup = (drawn: unknown) => isRecord(drawn) && [drawn['setup'] ?? []].flat().length > 0;

const holdsPart = async (options: {
  definition: Record<string, unknown>;
  props: unknown;
  part: string;
}): Promise<boolean | null> => {
  const { definition, props, part } = options;
  const render = definition['render'] as (props: unknown) => unknown;
  const frame =
    typeof definition['frame'] === 'function' ? (definition['frame'] as (...args: unknown[]) => unknown) : null;

  try {
    const drawn = await render(props);
    const body = isRecord(drawn) ? drawn['body'] : undefined;

    if (typeof body !== 'string' || runsSetup(drawn)) return null;

    const framed = frame ? frame(body, props) : body;

    return typeof framed === 'string' ? marksPart(framed, part) : null;
  } catch {
    return null;
  }
};

const definitionOf = async (options: { load: PartModuleLoader; product: ResolvedProduct; part: string }) => {
  const resolved = options.product.parts.find((candidate) => partKeyOf(candidate) === options.part);
  const module = resolved
    ? await options.load({ file: resolved.file, product: options.product.name }).catch(() => null)
    : null;
  const definition = isRecord(module) ? module['default'] : undefined;

  return isRecord(definition) && typeof definition['render'] === 'function' && isRecord(definition['states'])
    ? (definition as Definition)
    : null;
};

const holdingByStateOf = async (definition: Definition, part: string) => {
  const holding: [string, boolean | null][] = [];

  for (const [state, props] of Object.entries(definition.states))
    holding.push([state, await holdsPart({ definition, props, part })]);

  return holding;
};

/**
 * The states of the part `embedder` whose drawing holds the part `part`, directly or through a nested part, read from
 * the markup its `render` returns outside a browser. A state whose markup cannot be read, or whose drawing runs a
 * `setup` that can draw more in the browser, counts as holding it; `null`
 * when every state counts: the embedder does not load, or no state shows `part` while `part` does not show its own mark.
 */
export const statesHoldingPartOf = async (options: {
  load: PartModuleLoader;
  product: ResolvedProduct;
  embedder: string;
  part: string;
}): Promise<string[] | null> => {
  const definition = await definitionOf({ ...options, part: options.embedder });

  if (!definition) return null;

  const held = (await holdingByStateOf(definition, options.part)).flatMap(([state, holds]) =>
    holds === false ? [] : [state],
  );

  if (held.length > 0) return held;

  const own = await definitionOf(options);
  const marksItself = own ? (await holdingByStateOf(own, options.part)).some(([, holds]) => holds === true) : false;

  return marksItself ? [] : null;
};
