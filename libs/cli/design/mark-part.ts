import type { Drawing } from './define-call';
import type { Part } from './define-part';

const SKIPPED = /^(?:\s+|<!--[\s\S]*?-->|<(style|script)\b[\s\S]*?<\/\1\s*>|<link\b[^>]*>)/i;
const TAG = /^<[a-zA-Z][\w:-]*/;
const ATTRIBUTES = /^(?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*/;
const MARK = /(\sdata-et-part=")([^"]*)"/;

/** Adds `key` to `data-et-part` on the first element of `body`, after any leading styles, scripts, links and comments. */
export const markBody = (body: string, key: string) => {
  let at = 0;

  for (let skipped = SKIPPED.exec(body); skipped; skipped = SKIPPED.exec(body.slice(at))) at += skipped[0].length;

  const tag = TAG.exec(body.slice(at));

  if (!tag) return body;

  const attributesAt = at + tag[0].length;
  const attributes = ATTRIBUTES.exec(body.slice(attributesAt))?.[0] ?? '';
  const marked = MARK.exec(attributes);

  if (!marked) return `${body.slice(0, attributesAt)} data-et-part="${key}"${body.slice(attributesAt)}`;

  const valueEnd = attributesAt + marked.index + (marked[1]?.length ?? 0) + (marked[2]?.length ?? 0);

  return `${body.slice(0, valueEnd)} ${key}${body.slice(valueEnd)}`;
};

const markDrawing = (drawn: Drawing, key: string): Drawing =>
  typeof drawn?.body === 'string' ? { ...drawn, body: markBody(drawn.body, key) } : drawn;

/** The part with a `render` that marks the first element of each drawing as the root of the part `key`. */
export const markPart = <P>(part: Part<P>, key: string): Part<P> => {
  if (typeof part?.render !== 'function') return part;

  const render = part.render;

  return {
    ...part,
    render: (props) => {
      const drawn = render.call(part, props);

      return drawn instanceof Promise ? drawn.then((done) => markDrawing(done, key)) : markDrawing(drawn, key);
    },
  };
};
