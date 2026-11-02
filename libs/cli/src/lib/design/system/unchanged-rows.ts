import { FORCE_ATTRIBUTE } from '../force-interactions';

type Tag = { name: string; closing: boolean; selfClosing: boolean; attributes: Map<string, string> };

const TAG = /<(\/?)([a-zA-Z][\w:.-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
const ATTRIBUTE = /([^\s=/"'>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
const VOID_ELEMENTS = new Set([
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
  'param',
  'source',
  'track',
  'wbr',
]);

const tagsOf = (markup: string): Tag[] =>
  [...markup.replace(/<!--[\s\S]*?-->/g, '').matchAll(TAG)].map(([, slash, name = '', rest = '']) => ({
    name: name.toLowerCase(),
    closing: slash === '/',
    selfClosing: rest.trimEnd().endsWith('/') || VOID_ELEMENTS.has(name.toLowerCase()),
    attributes: new Map(
      [...rest.matchAll(ATTRIBUTE)].map(([, attribute = '', double, single, bare]) => [
        attribute.toLowerCase(),
        double ?? single ?? bare ?? '',
      ]),
    ),
  }));

const customClassesOf = (tag: Tag) =>
  (tag.attributes.get('class') ?? '').split(/\s+/u).filter((name) => name !== '' && !name.startsWith('et-'));

const isStyled = (tag: Tag) => customClassesOf(tag).length > 0 || (tag.attributes.get('style') ?? '').trim() !== '';

const isSdkComponent = (tag: Tag) =>
  tag.attributes.has('data-et-ng') &&
  (tag.name.startsWith('et-') || [...tag.attributes.keys()].some((name) => name.startsWith('et-')));

/** The open tags inside the element opened at `start`, leaving out `svg` and embedded `data-et-part` subtrees. */
const contentOf = (tags: Tag[], start: number) => {
  const content: Tag[] = [];
  let depth = 0;
  let skippedAt: number | null = null;

  for (const tag of tags.slice(start + 1)) {
    if (tag.closing) {
      if (depth === 0) break;
      depth--;
      if (skippedAt === depth) skippedAt = null;
      continue;
    }

    if (skippedAt === null && (tag.name === 'svg' || tag.attributes.has('data-et-part'))) skippedAt = depth;
    if (skippedAt === null) content.push(tag);
    if (!tag.selfClosing) depth++;
    else if (skippedAt === depth) skippedAt = null;
  }

  return content;
};

/**
 * Whether every element a body forces into an interaction is an SDK component the part renders through `ng()` and does
 * not style: an `et-` element or attribute with no custom class or inline style, and no styled content outside icons and
 * embedded parts. `body` is the markup a part draws outside a browser, where `ng()` marks each element `data-et-ng`.
 * `false` when the body forces nothing.
 */
export const forcesOnlyUnchangedControls = (markup: string) => {
  const tags = tagsOf(markup);
  const forced = tags.flatMap((tag, index) => (!tag.closing && tag.attributes.has(FORCE_ATTRIBUTE) ? [index] : []));

  return (
    forced.length > 0 &&
    forced.every((index) => {
      const tag = tags[index] as Tag;

      return isSdkComponent(tag) && !isStyled(tag) && !contentOf(tags, index).some(isStyled);
    })
  );
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const bodyOf = async (render: (props: unknown) => unknown, props: unknown) => {
  const drawn = await render(props);

  return isRecord(drawn) && typeof drawn['body'] === 'string' ? drawn['body'] : null;
};

/**
 * The interaction states of each grid row whose forced elements are only SDK components the part leaves unchanged, so
 * the row draws nothing the part styles: the grid shows such a row at rest only, and no tool draws or judges its
 * interaction states. Read from the unrendered markup of the row's first interaction state.
 */
export const unchangedRowStatesOf = async (definition: unknown): Promise<Set<string>> => {
  const dropped = new Set<string>();

  if (!isRecord(definition) || typeof definition['render'] !== 'function') return dropped;

  const { states, grid } = definition;
  const render = definition['render'] as (props: unknown) => unknown;

  if (!isRecord(states) || !isRecord(grid) || !Array.isArray(grid['columns']) || !isRecord(grid['rows']))
    return dropped;

  const interactions = grid['columns'].filter(
    (column): column is string => typeof column === 'string' && column !== 'rest',
  );

  for (const cells of Object.values(grid['rows'])) {
    if (!isRecord(cells)) continue;

    const forced = interactions
      .map((column) => cells[column])
      .filter((state): state is string => typeof state === 'string' && state in states);
    const first = forced[0];

    if (first === undefined) continue;

    const body = await bodyOf(render, states[first]).catch(() => null);

    if (body !== null && forcesOnlyUnchangedControls(body)) for (const state of forced) dropped.add(state);
  }

  return dropped;
};

/** The names of the states of a part definition every tool draws: its `states` without the unchanged row states. */
export const drawnStateNamesOf = async (definition: unknown): Promise<string[]> => {
  const states = isRecord(definition) ? definition['states'] : undefined;

  if (!isRecord(states) || Array.isArray(states)) return [];

  const dropped = await unchangedRowStatesOf(definition);

  return Object.keys(states).filter((state) => !dropped.has(state));
};
