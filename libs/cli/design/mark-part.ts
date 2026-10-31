import { Drawing } from './define-call';
import { Interaction, Part, RenderOptions } from './define-part';

const SKIPPED = /^(?:\s+|<!--[\s\S]*?-->|<(style|script)\b[\s\S]*?<\/\1\s*>|<link\b[^>]*>)/i;
const TAG = /^<[a-zA-Z][\w:-]*/;
const ATTRIBUTES = /^(?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*/;
const MARK = /(\sdata-et-part=")([^"]*)"/;
const SLOT = /(\sdata-et-slot=")([^"]*)"/;
const TAG_AT = /<[a-zA-Z][\w:-]*/y;
const ATTRIBUTES_AT = new RegExp(ATTRIBUTES.source.slice(1), 'y');
const RAW_TEXT = new Set(['script', 'style', 'textarea', 'title']);
const MAX_PROP_DEPTH = 4;

const attributesAtOf = (body: string) => {
  let at = 0;

  for (let skipped = SKIPPED.exec(body); skipped; skipped = SKIPPED.exec(body.slice(at))) at += skipped[0].length;

  const tag = TAG.exec(body.slice(at));

  return tag ? at + tag[0].length : null;
};

/** Adds `key` to `data-et-part` on the first element of `body`, after any leading styles, scripts, links and comments. */
export const markBody = (body: string, key: string) => {
  const attributesAt = attributesAtOf(body);

  if (attributesAt === null) return body;

  const attributes = ATTRIBUTES.exec(body.slice(attributesAt))?.[0] ?? '';
  const marked = MARK.exec(attributes);

  if (!marked) return `${body.slice(0, attributesAt)} data-et-part="${key}"${body.slice(attributesAt)}`;

  const valueEnd = attributesAt + marked.index + (marked[1]?.length ?? 0) + (marked[2]?.length ?? 0);

  return `${body.slice(0, valueEnd)} ${key}${body.slice(valueEnd)}`;
};

const DISABLED_ATTRIBUTE = /\s(?:disabled(?=[\s=/>]|$)|aria-disabled\s*=\s*["']?true\b)/i;

const isDisabledMarkup = (attributes: string) => DISABLED_ATTRIBUTE.test(attributes);

/**
 * Forces `interaction` on the first element of `body` the way a frame forces it on the root of a part. A disabled
 * element stays at rest: it gets no forced hover, active or focus-visible.
 */
export const forceBody = (body: string, interaction: Interaction) => {
  const attributesAt = attributesAtOf(body);

  if (attributesAt === null) return body;
  if (interaction !== 'disabled' && isDisabledMarkup(ATTRIBUTES.exec(body.slice(attributesAt))?.[0] ?? '')) return body;

  const forced = interaction === 'disabled' ? ' disabled aria-disabled="true"' : ` data-et-force="${interaction}"`;

  return `${body.slice(0, attributesAt)}${forced}${body.slice(attributesAt)}`;
};

/** Adds `key` to `data-et-slot` on every element of `markup`: the markup a host passes into the part `key` through its props. */
export const markSlot = (markup: string, key: string) => {
  let marked = '';
  let at = 0;

  for (let open = markup.indexOf('<'); open >= 0; open = markup.indexOf('<', at)) {
    if (markup.startsWith('<!--', open)) {
      const close = markup.indexOf('-->', open + 4);
      const end = close < 0 ? markup.length : close + 3;

      marked += markup.slice(at, end);
      at = end;
      continue;
    }

    TAG_AT.lastIndex = open;
    const tag = TAG_AT.exec(markup);

    if (!tag) {
      marked += markup.slice(at, open + 1);
      at = open + 1;
      continue;
    }

    const attributesAt = open + tag[0].length;

    ATTRIBUTES_AT.lastIndex = attributesAt;
    const attributes = ATTRIBUTES_AT.exec(markup)?.[0] ?? '';
    const slot = SLOT.exec(attributes);

    if (slot) {
      const valueEnd = attributesAt + slot.index + (slot[1]?.length ?? 0) + (slot[2]?.length ?? 0);

      marked += `${markup.slice(at, valueEnd)} ${key}`;
      at = valueEnd;
    } else {
      marked += `${markup.slice(at, attributesAt)} data-et-slot="${key}"`;
      at = attributesAt;
    }

    const name = tag[0].slice(1).toLowerCase();

    if (RAW_TEXT.has(name)) {
      const close = markup.toLowerCase().indexOf(`</${name}`, attributesAt);
      const end = close < 0 ? markup.length : close;

      marked += markup.slice(at, end);
      at = end;
    }
  }

  return marked + markup.slice(at);
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype;

const slotProps = (value: unknown, { key, depth = 0 }: { key: string; depth?: number }): unknown => {
  const inner = { key, depth: depth + 1 };

  if (typeof value === 'string') return /<[a-zA-Z]/.test(value) ? markSlot(value, key) : value;
  if (depth >= MAX_PROP_DEPTH) return value;
  if (Array.isArray(value)) return value.map((item) => slotProps(item, inner));
  if (isPlainObject(value))
    return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, slotProps(item, inner)]));

  return value;
};

const markDrawing = <TDrawing extends Drawing>(drawn: TDrawing, key: string): TDrawing =>
  typeof drawn?.body === 'string' ? { ...drawn, body: markBody(drawn.body, key) } : drawn;

/**
 * The part with a `render` that marks the first element of each drawing as the root of the part `key`, and every
 * element of the markup its props pass in as slotted into `key`.
 */
export const markPart = <TProps, TState extends string>(
  part: Part<TProps, TState>,
  key: string,
): Part<TProps, TState> => {
  if (typeof part?.render !== 'function') return part;

  const render = part.render;

  return {
    ...part,
    render: (props: TProps, options?: RenderOptions) => {
      const drawn = render.call(part, slotProps(props, { key }) as TProps, options);

      return drawn instanceof Promise ? drawn.then((done) => markDrawing(done, key)) : markDrawing(drawn, key);
    },
  };
};

const markOutput = (output: unknown, key: string) =>
  typeof output === 'string' ? markBody(output, key) : markDrawing(output as Drawing, key);

/**
 * `value` as a named export of the part `key`: a function whose markup, or drawing body, comes back with its first
 * element marked as the root of `key`, and the markup of its arguments as slotted into `key`. Any other value, a
 * class included, stays as it is.
 */
export const markNamed = <T>(value: T, key: string): T => {
  if (typeof value !== 'function' || /^class\b/u.test(Function.prototype.toString.call(value))) return value;

  return function (this: unknown, ...args: unknown[]) {
    const output = value.apply(
      this,
      args.map((arg) => slotProps(arg, { key })),
    );

    return output instanceof Promise ? output.then((done) => markOutput(done, key)) : markOutput(output, key);
  } as T;
};
