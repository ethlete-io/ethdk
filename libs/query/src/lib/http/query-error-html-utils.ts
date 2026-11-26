/**
 * An error body can be an HTML page instead of JSON: a proxy's 502, a load balancer's maintenance page, a
 * platform's "service temporarily unavailable". The markup is never worth showing, but the sentence inside it
 * usually is - this file pulls that sentence out.
 *
 * Parsing is done with string matching rather than `DOMParser` on purpose: it must work during SSR, and the
 * markup must never reach a DOM. What comes back is plain text, so a template can bind it as text like any
 * other error message.
 */

/** A full document, however sloppily written. */
const HTML_DOCUMENT_PATTERN = /<!doctype\s+html|<html[\s>]|<head[\s>]|<body[\s>]/i;

/** A fragment - matched only as a balanced pair, so a message that merely mentions `<p>` is not markup. */
const HTML_ELEMENT_PATTERN = /<(h[1-6]|p|div|title|pre)\b[^>]*>[\s\S]*<\/\1>/i;

/** Carries no readable text, and `<style>` in particular would otherwise flood the fallback. */
const HTML_NOISE_PATTERN = /<(script|style|noscript|svg|iframe|template)\b[^>]*>[\s\S]*?<\/\1>/gi;

const HTML_COMMENT_PATTERN = /<!--[\s\S]*?-->/g;

const HTML_TAG_PATTERN = /<[^>]*>/g;

const HTML_ENTITY_PATTERN = /&(#x[0-9a-f]+|#[0-9]+|[a-z][a-z0-9]*);/gi;

const HTML_BODY_PATTERN = /<body\b[^>]*>([\s\S]*?)<\/body>/i;

const HTML_HEADING_PATTERN = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/i;

const HTML_TITLE_PATTERN = /<title\b[^>]*>([\s\S]*?)<\/title>/i;

const HTML_PARAGRAPH_PATTERN = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;

/**
 * The entities an error page actually uses. A complete table would be kilobytes for no gain - anything missing
 * is left as written, which is still readable.
 */
const HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ensp: ' ',
  emsp: ' ',
  thinsp: ' ',
  shy: '',
  ndash: '–',
  mdash: '-',
  hellip: '…',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  laquo: '«',
  raquo: '»',
  bull: '•',
  middot: '·',
  deg: '°',
  copy: '©',
  reg: '®',
  trade: '™',
  euro: '€',
  pound: '£',
  auml: 'ä',
  ouml: 'ö',
  uuml: 'ü',
  Auml: 'Ä',
  Ouml: 'Ö',
  Uuml: 'Ü',
  szlig: 'ß',
};

/** Long enough for a real explanation, short enough that a dumped stack trace can't become the message. */
const MAX_MESSAGE_LENGTH = 300;

const MAX_CODE_POINT = 0x10ffff;

const decodeHtmlEntities = (value: string) =>
  value.replace(HTML_ENTITY_PATTERN, (match, entity: string) => {
    if (entity.startsWith('#')) {
      const isHex = entity[1] === 'x' || entity[1] === 'X';
      const codePoint = Number.parseInt(isHex ? entity.slice(2) : entity.slice(1), isHex ? 16 : 10);

      // `String.fromCodePoint` throws on anything out of range, and a malformed page is exactly where that shows up.
      return Number.isInteger(codePoint) && codePoint > 0 && codePoint <= MAX_CODE_POINT
        ? String.fromCodePoint(codePoint)
        : match;
    }

    return HTML_ENTITIES[entity] ?? HTML_ENTITIES[entity.toLowerCase()] ?? match;
  });

/**
 * Tags are dropped before entities are decoded, so an escaped `&lt;script&gt;` in the page's text can never
 * turn back into markup on the way out.
 */
const toPlainText = (html: string) =>
  decodeHtmlEntities(html.replace(HTML_TAG_PATTERN, ' ')).replace(/\s+/g, ' ').trim();

const truncate = (value: string) =>
  value.length <= MAX_MESSAGE_LENGTH ? value : `${value.slice(0, MAX_MESSAGE_LENGTH - 1).trimEnd()}…`;

const matchText = (html: string, pattern: RegExp, group: number) => {
  const text = pattern.exec(html)?.[group];

  return text ? toPlainText(text) || null : null;
};

const paragraphTexts = (html: string) => {
  const texts: string[] = [];

  for (const match of html.matchAll(HTML_PARAGRAPH_PATTERN)) {
    const text = toPlainText(match[1] ?? '');

    if (text) texts.push(text);
  }

  return texts;
};

/**
 * Whether a value is an HTML error page rather than a message meant to be read as-is.
 *
 * Deliberately strict: a document marker, or a balanced element pair. A message containing a stray `<` or a
 * lone `<br>` stays a message.
 */
export const isHtmlErrorPayload = (value: unknown): value is string =>
  typeof value === 'string' && (HTML_DOCUMENT_PATTERN.test(value) || HTML_ELEMENT_PATTERN.test(value));

/**
 * The HTML of an error body, or `null` when the body isn't an error page.
 *
 * Two shapes carry one: the raw string body of any failed response, and the `{ error, text }` wrapper
 * Angular's XHR backend produces when a `200` response fails to parse as JSON - which is how a proxy handing
 * back an HTML page with a success status arrives.
 */
export const htmlErrorPayload = (body: unknown): string | null => {
  if (isHtmlErrorPayload(body)) return body;

  if (typeof body === 'object' && !!body && 'text' in body && isHtmlErrorPayload(body.text)) {
    return body.text;
  }

  return null;
};

/**
 * The readable message inside an HTML error page, or `null` when it has none.
 *
 * Prefers what a page puts its message in: the first heading (or the `<title>` when there is no heading),
 * followed by the first paragraph that says something new. Falls back to the page's flattened text, so an
 * unusually structured page still yields something. The result is always plain text, and always short enough
 * to sit in a toast.
 *
 * @example
 * extractHtmlErrorMessage('<h1>Service Unavailable</h1><p>The server is restarting.</p>');
 * // 'Service Unavailable: The server is restarting.'
 */
export const extractHtmlErrorMessage = (html: string): string | null => {
  const document = html.replace(HTML_COMMENT_PATTERN, ' ').replace(HTML_NOISE_PATTERN, ' ');
  const body = HTML_BODY_PATTERN.exec(document)?.[1] ?? document;

  const headline = matchText(body, HTML_HEADING_PATTERN, 2) ?? matchText(document, HTML_TITLE_PATTERN, 1);
  const detail = paragraphTexts(body).find((text) => text !== headline) ?? null;

  if (headline && detail) {
    // A headline that already ends in punctuation is a sentence, not a label.
    const separator = /[.!?:]$/.test(headline) ? ' ' : ': ';

    return truncate(`${headline}${separator}${detail}`);
  }

  const message = headline ?? detail ?? toPlainText(body);

  return message ? truncate(message) : null;
};
