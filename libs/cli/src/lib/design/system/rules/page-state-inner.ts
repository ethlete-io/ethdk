import { DesignConfig } from '../../design-config';
import { WarmDraw } from '../../warm-draw';
import { PartModuleLoader, withPartLoader } from '../action-lost';
import { PAGE_STATE_INNER_RULE } from '../build-ready-contract';
import { Problem } from '../problem';
import { partKeyOf, ResolvedPart, ResolvedProduct } from '../resolve-product';

const TOKEN =
  /<!--[\s\S]*?-->|<\/?([a-zA-Z][\w:-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/u;
const PART_ATTRIBUTE = /\sdata-et-part\s*=\s*"([^"]*)"/u;
const SLOT_ATTRIBUTE = /\sdata-et-slot\s*=\s*"([^"]*)"/u;
const VOID = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'source',
  'track',
  'wbr',
]);
const RAW_TEXT = new Set(['script', 'style', 'textarea', 'title']);

type Instance = { key: string; parent: number; markup: string };

type Owned = { page: string; instances: Instance[] };

const keysOf = (attributes: string, pattern: RegExp) =>
  pattern.exec(attributes)?.[1]?.split(/\s+/u).filter(Boolean) ?? [];

/**
 * `markup` split by owner: the page's own markup, with a placeholder where each embedded part instance starts, and
 * the markup each instance draws itself. Markup a host passes into a part (`data-et-slot`) belongs to that host.
 */
const ownedOf = (markup: string, own: string): Owned => {
  const instances: Instance[] = [];
  const open: number[] = [];
  let page = '';
  let at = 0;
  const append = (owner: number, text: string) => {
    const instance = instances[owner];

    if (instance) instance.markup += text;
    else page += text;
  };
  const tokens = new RegExp(TOKEN.source, 'gu');

  for (let match = tokens.exec(markup); match; match = tokens.exec(markup)) {
    const [token, name = '', attributes = '', selfClosing] = match;
    const current = open[open.length - 1] ?? -1;

    append(current, markup.slice(at, match.index));
    at = match.index + token.length;

    if (!name) continue;

    if (token.startsWith('</')) {
      append(current, token);
      open.pop();
      continue;
    }

    const tag = name.toLowerCase();
    const leaf = VOID.has(tag) || selfClosing === '/';
    const slots = keysOf(attributes, SLOT_ATTRIBUTE);
    const parts = keysOf(attributes, PART_ATTRIBUTE);
    let owner = current;

    while (owner >= 0 && slots.includes(instances[owner]?.key ?? '')) owner = instances[owner]?.parent ?? -1;

    if (parts.length > 0 && !parts.includes(own)) {
      const key = parts[parts.length - 1] ?? '';

      append(owner, `<et-inner-part ${key}>`);
      instances.push({ key, parent: owner, markup: '' });
      owner = instances.length - 1;
    }

    append(owner, token);

    if (RAW_TEXT.has(tag) && !leaf) {
      const close = markup.toLowerCase().indexOf(`</${tag}`, at);
      const end = close < 0 ? markup.length : close;

      append(owner, markup.slice(at, end));
      at = end;
      tokens.lastIndex = end;
    }

    if (!leaf) open.push(owner);
  }

  append(open[open.length - 1] ?? -1, markup.slice(at));

  return { page, instances };
};

const chainOf = (instances: Instance[], index: number) => {
  const chain: number[] = [];

  for (let at = index; at >= 0; at = instances[at]?.parent ?? -1) chain.push(at);

  return chain;
};

/**
 * The key of the one embedded part whose drawn markup holds every difference between the page markup `base` and
 * `state`, when the page's own markup, the markup it passes into its parts included, is the same in both; `null`
 * otherwise. Of nested parts it names the innermost one that holds them all.
 */
export const innerOnlyPartOf = (options: { own: string; base: string; state: string }): string | null => {
  const base = ownedOf(options.base, options.own);
  const state = ownedOf(options.state, options.own);

  if (base.page !== state.page || base.instances.length !== state.instances.length) return null;

  const chains = state.instances.flatMap((instance, index) =>
    instance.markup === base.instances[index]?.markup ? [] : [chainOf(state.instances, index)],
  );
  const [first = [], ...rest] = chains;
  const holder = first.find((index) => rest.every((chain) => chain.includes(index)));

  return holder === undefined ? null : (state.instances[holder]?.key ?? null);
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const bodyOf = async (render: (props: unknown) => unknown, props: unknown) => {
  const drawn = await Promise.resolve()
    .then(() => render(props))
    .catch(() => null);

  return isRecord(drawn) && typeof drawn['body'] === 'string' ? drawn['body'] : null;
};

const sameValue = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Whether the props of `state` repeat every prop of `base` with the same value. */
const repeatsProps = (state: unknown, base: unknown) =>
  isRecord(state) &&
  isRecord(base) &&
  Object.entries(base).every(([name, value]) => name in state && sameValue(state[name], value));

export type InnerOnlyState = { state: string; base: string; part: string };

/**
 * The states of a page definition that differ only inside one embedded part from the default state (the first) or
 * from another state whose props they all repeat, each with that state and the part.
 */
export const innerOnlyStatesOf = async (options: { own: string; definition: unknown }): Promise<InnerOnlyState[]> => {
  const { definition, own } = options;

  if (!isRecord(definition) || typeof definition['render'] !== 'function' || !isRecord(definition['states'])) return [];

  const render = (props: unknown) => (definition['render'] as (props: unknown) => unknown).call(definition, props);
  const states = Object.entries(definition['states']);
  const bodies = new Map<string, string | null>();

  for (const [state, props] of states) bodies.set(state, await bodyOf(render, props));

  const [first] = states;

  return states.slice(1).flatMap(([state, props]): InnerOnlyState[] => {
    const body = bodies.get(state);

    if (!body) return [];

    for (const [base, baseProps] of states) {
      const baseBody = bodies.get(base);

      if (base === state || !baseBody || baseBody === body || (base !== first?.[0] && !repeatsProps(props, baseProps)))
        continue;

      const part = innerOnlyPartOf({ own, base: baseBody, state: body });

      if (part) return [{ state, base, part }];
    }

    return [];
  });
};

/** A PAGE-STATE-INNER problem for each state of `parts` that changes only one inner part, by {@link innerOnlyStatesOf}. */
export const pageStateInnerOf = async (options: {
  load: PartModuleLoader;
  product: ResolvedProduct;
  parts: ResolvedPart[];
}): Promise<Problem[]> => {
  const problems: Problem[] = [];

  for (const part of options.parts) {
    const own = partKeyOf(part);
    const module = await options.load({ file: part.file, product: options.product.name }).catch(() => null);
    const definition = isRecord(module) ? module['default'] : undefined;

    for (const { state, base, part: inner } of await innerOnlyStatesOf({ own, definition }))
      problems.push({
        rule: PAGE_STATE_INNER_RULE,
        file: part.file,
        at: state,
        states: [state],
        message: `state "${state}" differs from "${base}" only inside ${inner}: make it a state of ${inner} and drop it from ${own}, which draws ${inner} in its default (ADR 0331)`,
      });
  }

  return problems;
};

/** Whether PAGE-STATE-INNER checks `part`: an own page of its product. */
export const checksPageStates = (part: ResolvedPart) => part.layer === 'pages' && part.origin !== 'base';

/** `PAGE-STATE-INNER` for the own pages of `product`, or of `part` / `parts` only, loading each state's markup without a browser. */
export const pageStateInnerProblemsOf = async (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  part?: string;
  parts?: readonly string[];
  warm?: WarmDraw;
}): Promise<Problem[]> => {
  const parts = options.product.parts.filter(
    (part) =>
      checksPageStates(part) &&
      (!options.part || partKeyOf(part) === options.part) &&
      (!options.parts || options.parts.includes(partKeyOf(part))),
  );

  if (parts.length === 0) return [];

  return withPartLoader(options, (load) => pageStateInnerOf({ load, product: options.product, parts }));
};
