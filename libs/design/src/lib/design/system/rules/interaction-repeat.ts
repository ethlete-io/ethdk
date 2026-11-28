const INTERACTIONS = new Set(['hover', 'focus', 'focus-visible', 'focus-within', 'active', 'pressed']);
const START_TAG = /<[a-zA-Z][^\s/>]*(?:\s+[^\s=/>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*\s*\/?>/gu;
const ATTRIBUTE = /\s([^\s=/>]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s>]+))?/gu;
const CONTENT_ATTRIBUTES = new Set(['src', 'srcset', 'alt', 'href', 'title', 'aria-label']);
const INTERACTION_VARIANT = /(?:^\.?|:)(?:group-|peer-)?(?:hover|focus(?:-visible|-within)?|active)(?:\/[\w-]+)?:/u;
const INTERACTIVE_SELECTOR = /:(?:hover|focus|active)/u;

type Drawn = { body: string; styles: string };

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const drawnOf = async (render: (props: unknown) => unknown, props: unknown): Promise<Drawn | null> => {
  const drawn = await Promise.resolve()
    .then(() => render(props))
    .catch(() => null);

  if (!isRecord(drawn) || typeof drawn['body'] !== 'string') return null;

  return { body: drawn['body'], styles: typeof drawn['styles'] === 'string' ? drawn['styles'] : '' };
};

const attributesOf = (tag: string) =>
  [...tag.matchAll(ATTRIBUTE)].map((match) => ({
    name: match[1] ?? '',
    value: (match[2] ?? '').replace(/^["']|["']$/gu, ''),
  }));

/** What `state` changes against `rest`: the text between their common start and their common end, on each side. */
const changeOf = (rest: string, state: string) => {
  let start = 0;

  while (start < rest.length && start < state.length && rest[start] === state[start]) start++;

  let end = 0;

  while (
    end < rest.length - start &&
    end < state.length - start &&
    rest[rest.length - 1 - end] === state[state.length - 1 - end]
  )
    end++;

  return `${rest.slice(start, rest.length - end)}\u0000${state.slice(start, state.length - end)}`;
};

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
const TAG =
  /<!--[\s\S]*?-->|<\/([a-zA-Z][^\s/>]*)\s*>|<([a-zA-Z][^\s/>]*)(?:\s+[^\s=/>]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*\s*(\/?)>/gu;

const lookOf = (tag: string) =>
  `${tag.match(/^<[^\s/>]+/u)?.[0] ?? ''} ${attributesOf(tag)
    .filter(({ name }) => !CONTENT_ATTRIBUTES.has(name))
    .map(({ name, value }) => `${name}=${value}`)
    .join(' ')}`;

/** The start tags of the element the interaction is forced on and of its ancestors, without their content attributes. */
const forcedLookOf = (body: string) => {
  const open: { name: string; tag: string }[] = [];

  for (const match of body.matchAll(TAG)) {
    const [tag, closing, name, selfClosing] = match;

    if (closing) {
      const at = open.map((entry) => entry.name).lastIndexOf(closing.toLowerCase());

      if (at >= 0) open.splice(at);
      continue;
    }

    if (!name) continue;
    if (/\sdata-et-force\s*=/u.test(tag)) return [...open.map((entry) => entry.tag), tag].map(lookOf).join('\n');
    if (!selfClosing && !VOID.has(name.toLowerCase())) open.push({ name: name.toLowerCase(), tag });
  }

  return lookOf(body.match(START_TAG)?.[0] ?? '');
};

const tokensOf = (body: string) =>
  new Set(
    (body.match(START_TAG) ?? []).flatMap((tag) =>
      attributesOf(tag).flatMap(({ name, value }) =>
        name === 'class'
          ? value
              .split(/\s+/u)
              .filter(Boolean)
              .map((name) => `.${name}`)
          : [`[${name}=${value}`, `[${name}`],
      ),
    ),
  );

const interactiveSelectorTokensOf = (styles: string) =>
  new Set(
    [...styles.matchAll(/([^{}]+)\{/gu)]
      .map((match) => match[1] ?? '')
      .filter((selector) => INTERACTIVE_SELECTOR.test(selector))
      .flatMap((selector) => [
        ...[...selector.matchAll(/\.((?:\\.|[\w-])+)/gu)].map((match) => `.${(match[1] ?? '').replace(/\\/gu, '')}`),
        ...[...selector.matchAll(/\[\s*([\w-]+)\s*(?:[~|^$*]?=\s*["']?([^"'\]]*))?/gu)].map((match) =>
          match[2] === undefined ? `[${match[1]}` : `[${match[1]}=${match[2]}`,
        ),
      ]),
  );

/** Whether something only `row` draws may take part in an interaction: an interaction utility or an interactive selector. */
const reactsOnItsOwn = (row: Drawn, base: Drawn) => {
  const baseTokens = tokensOf(base.body);
  const own = [...tokensOf(row.body)].filter((token) => !baseTokens.has(token));
  const selected = interactiveSelectorTokensOf(row.styles);

  return own.some((token) => INTERACTION_VARIANT.test(token) || selected.has(token));
};

export type RepeatedInteractions = { row: string; baseRow: string; states: string[]; interactions: string[] };

const rowsOf = (grid: unknown): [string, Record<string, unknown>][] =>
  isRecord(grid) && isRecord(grid['rows'])
    ? Object.entries(grid['rows']).flatMap(([row, cells]) => (isRecord(cells) ? [[row, cells] as const] : []))
    : [];

/**
 * The interaction cells of each grid row after the first that draw their interaction as the first row does: the
 * same change against the row's rest, on an element that looks the same, with nothing of the row's own content
 * taking part in it. Such a row only changes content, so its interactions repeat the first row's.
 */
export const repeatedInteractionsOf = async (definition: unknown): Promise<RepeatedInteractions[]> => {
  if (!isRecord(definition) || typeof definition['render'] !== 'function' || !isRecord(definition['states'])) return [];

  const render = (props: unknown) => (definition['render'] as (props: unknown) => unknown).call(definition, props);
  const states = definition['states'];
  const drawn = new Map<string, Promise<Drawn | null>>();
  const drawnState = (state: unknown) => {
    if (typeof state !== 'string' || !(state in states)) return Promise.resolve(null);
    if (!drawn.has(state)) drawn.set(state, drawnOf(render, states[state]));

    return drawn.get(state) as Promise<Drawn | null>;
  };
  const [first, ...rows] = rowsOf(definition['grid']);

  if (!first) return [];

  const [baseRow, baseCells] = first;
  const baseRest = await drawnState(baseCells['rest']);
  const found: RepeatedInteractions[] = [];

  if (!baseRest) return [];

  for (const [row, cells] of rows) {
    const rest = await drawnState(cells['rest']);

    if (!rest || reactsOnItsOwn(rest, baseRest)) continue;

    const repeated: RepeatedInteractions = { row, baseRow, states: [], interactions: [] };

    for (const [interaction, state] of Object.entries(cells)) {
      const base = baseCells[interaction];

      if (!INTERACTIONS.has(interaction) || typeof state !== 'string' || typeof base !== 'string') continue;

      const [drawnCell, drawnBase] = await Promise.all([drawnState(state), drawnState(base)]);

      if (
        drawnCell &&
        drawnBase &&
        changeOf(rest.body, drawnCell.body) === changeOf(baseRest.body, drawnBase.body) &&
        forcedLookOf(drawnCell.body) === forcedLookOf(drawnBase.body)
      ) {
        repeated.states.push(state);
        repeated.interactions.push(interaction);
      }
    }

    if (repeated.states.length > 0) found.push(repeated);
  }

  return found;
};

/** Why the interactions of a row break INTERACTION-REPEAT, and how to fix it. */
export const interactionRepeatMessageOf = ({ row, baseRow, states, interactions }: RepeatedInteractions) =>
  `row "${row}" draws ${interactions.join(', ')} as the base row "${baseRow}" does and only changes content: ` +
  `draw "${row}" only at rest - drop ${states.join(', ')} (with interactionRows, add "${row}" to restOnly); ` +
  `its interactions are drawn once, on "${baseRow}"`;
