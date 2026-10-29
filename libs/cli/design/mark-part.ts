import { Drawing } from './define-call';
import { Interaction, Part, RenderOptions } from './define-part';

const SKIPPED = /^(?:\s+|<!--[\s\S]*?-->|<(style|script)\b[\s\S]*?<\/\1\s*>|<link\b[^>]*>)/i;
const TAG = /^<[a-zA-Z][\w:-]*/;
const ATTRIBUTES = /^(?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*/;
const MARK = /(\sdata-et-part=")([^"]*)"/;

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

/** Forces `interaction` on the first element of `body` the way a frame forces it on the root of a part. */
export const forceBody = (body: string, interaction: Interaction) => {
  const attributesAt = attributesAtOf(body);

  if (attributesAt === null) return body;

  const forced = interaction === 'disabled' ? ' disabled aria-disabled="true"' : ` data-et-force="${interaction}"`;

  return `${body.slice(0, attributesAt)}${forced}${body.slice(attributesAt)}`;
};

const markDrawing = <TDrawing extends Drawing>(drawn: TDrawing, key: string): TDrawing =>
  typeof drawn?.body === 'string' ? { ...drawn, body: markBody(drawn.body, key) } : drawn;

/** The part with a `render` that marks the first element of each drawing as the root of the part `key`. */
export const markPart = <TProps, TState extends string>(
  part: Part<TProps, TState>,
  key: string,
): Part<TProps, TState> => {
  if (typeof part?.render !== 'function') return part;

  const render = part.render;

  return {
    ...part,
    render: (props: TProps, options?: RenderOptions) => {
      const drawn = render.call(part, props, options);

      return drawn instanceof Promise ? drawn.then((done) => markDrawing(done, key)) : markDrawing(drawn, key);
    },
  };
};
