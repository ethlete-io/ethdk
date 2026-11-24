import { DesignConfig } from '../../design-config';
import { WarmDraw } from '../../warm-draw';
import { PartModuleLoader, withPartLoader } from '../action-lost';
import { STATE_INNER_RULE } from '../build-ready-contract';
import { Problem } from '../problem';
import { partKeyOf, ResolvedPart, ResolvedProduct } from '../resolve-product';

const TOKEN =
  /<!--[\s\S]*?-->|<\/?([a-zA-Z][\w:-]*)((?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/u;
const PART_ATTRIBUTE = /\sdata-et-part\s*=\s*"([^"]*)"/u;
const SLOT_ATTRIBUTE = /\sdata-et-slot\s*=\s*"([^"]*)"/u;
const CONTROL_ATTRIBUTE = /\sdata-et-control\s*=\s*"([^"]*)"/u;
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

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** The part each control of `controls` takes its interactions from, by control id. */
const controlPartsOf = (controls: unknown): Record<string, string> =>
  Object.fromEntries(
    isRecord(controls)
      ? Object.entries(controls).flatMap(([id, control]) =>
          isRecord(control) && typeof control['part'] === 'string' ? [[id, control['part']]] : [],
        )
      : [],
  );

/**
 * `markup` split by owner: the part's own markup, with a placeholder where each embedded part instance starts, and
 * the markup each instance draws itself. An element marked `data-et-part`, or a control whose entry in
 * `controlParts` names a part, starts an instance. Markup a host passes into a part (`data-et-slot`) belongs to that
 * host.
 */
const ownedOf = (
  markup: string,
  { own, controlParts }: { own: string; controlParts: Record<string, string> },
): Owned => {
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
    const marked = keysOf(attributes, PART_ATTRIBUTE);
    const controlPart = controlParts[keysOf(attributes, CONTROL_ATTRIBUTE)[0] ?? ''];
    const parts = marked.length === 0 && controlPart ? [controlPart] : marked;
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
 * The key of the one embedded part whose drawn markup holds every difference between the markup `base` and `state`
 * of the part `own`, when its own markup, the markup it passes into its parts included, is the same in both; `null`
 * otherwise. Of nested parts it names the innermost one that holds them all. `controlParts` maps a control id to the
 * part it takes its interactions from.
 */
export const innerOnlyPartOf = (options: {
  own: string;
  base: string;
  state: string;
  controlParts?: Record<string, string>;
}): string | null => {
  const owner = { own: options.own, controlParts: options.controlParts ?? {} };
  const base = ownedOf(options.base, owner);
  const state = ownedOf(options.state, owner);

  if (base.page !== state.page || base.instances.length !== state.instances.length) return null;

  const chains = state.instances.flatMap((instance, index) =>
    instance.markup === base.instances[index]?.markup ? [] : [chainOf(state.instances, index)],
  );
  const [first = [], ...rest] = chains;
  const holder = first.find((index) => rest.every((chain) => chain.includes(index)));

  return holder === undefined ? null : (state.instances[holder]?.key ?? null);
};

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

/**
 * Whether one prop that `state` changes against `base` leaves the drawn markup of `base` as it is: its effect lives
 * outside the markup (for example in a setup), so markup alone cannot show the state stays inside one part.
 */
const changesUnseenProp = async (options: {
  render: (props: unknown) => unknown;
  props: Record<string, unknown>;
  baseProps: Record<string, unknown>;
  baseBody: string;
}) => {
  const { render, props, baseProps, baseBody } = options;
  const names = new Set([...Object.keys(props), ...Object.keys(baseProps)]);

  for (const name of names) {
    if (sameValue(props[name], baseProps[name])) continue;

    const changed = { ...baseProps };

    if (name in props) changed[name] = props[name];
    else delete changed[name];

    if ((await bodyOf(render, changed)) === baseBody) return true;
  }

  return false;
};

export type InnerOnlyState = { state: string; base: string; part: string };

/**
 * The states of a part definition that differ only inside one embedded part from the default state (the first) or
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
  const controlParts = controlPartsOf(definition['controls']);

  const found: InnerOnlyState[] = [];

  for (const [state, props] of states.slice(1)) {
    const body = bodies.get(state);

    if (!body) continue;

    for (const [base, baseProps] of states) {
      const baseBody = bodies.get(base);

      if (base === state || !baseBody || baseBody === body || (base !== first?.[0] && !repeatsProps(props, baseProps)))
        continue;

      const part = innerOnlyPartOf({ own, base: baseBody, state: body, controlParts });

      if (!part) continue;
      if (isRecord(props) && isRecord(baseProps) && (await changesUnseenProp({ render, props, baseProps, baseBody })))
        continue;

      found.push({ state, base, part });
      break;
    }
  }

  return found;
};

/** A STATE-INNER problem for each state of `parts` that changes only one inner part, by {@link innerOnlyStatesOf}. */
export const stateInnerOf = async (options: {
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
        rule: STATE_INNER_RULE,
        file: part.file,
        at: state,
        states: [state],
        message: `state "${state}" differs from "${base}" only inside ${inner}: add the state in ${inner} and drop it from ${own}, which draws ${inner} in its default`,
      });
  }

  return problems;
};

const EMBEDS_PART = /@system\/(?:components|elements|pages)\/|\bpart\s*:\s*['"`](?:components|elements)\//u;

/** Whether STATE-INNER checks `part`: an own page, or an own part of any layer that embeds a part or names one for a control. */
export const checksInnerStates = (part: ResolvedPart) =>
  part.origin !== 'base' && (part.layer === 'pages' || EMBEDS_PART.test(part.source));

/** `STATE-INNER` for the own parts of `product`, or of `part` / `parts` only, loading each state's markup without a browser. */
export const stateInnerProblemsOf = async (options: {
  target: string;
  config: DesignConfig;
  product: ResolvedProduct;
  part?: string;
  parts?: readonly string[];
  warm?: WarmDraw;
}): Promise<Problem[]> => {
  const parts = options.product.parts.filter(
    (part) =>
      checksInnerStates(part) &&
      (!options.part || partKeyOf(part) === options.part) &&
      (!options.parts || options.parts.includes(partKeyOf(part))),
  );

  if (parts.length === 0) return [];

  return withPartLoader(options, (load) => stateInnerOf({ load, product: options.product, parts }));
};
