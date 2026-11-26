import { catchError, defer, map, Observable, of, switchMap } from 'rxjs';

const isCrossOrigin = (source: string) => /^(https?:)?\/\//.test(source);

const HTML_COMMENT = /<!--[\s\S]*?-->/g;
const SCRIPT_SRC = /<script\b[^>]*?\ssrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi;
const CHARACTER_REFERENCE = /&(?:#(\d+)|#[xX]([\da-fA-F]+)|(amp|quot|apos|lt|gt));/g;
const NAMED_REFERENCES: Record<string, string> = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' };

const decodeCharacterReferences = (value: string) =>
  value.replace(CHARACTER_REFERENCE, (_match, decimal?: string, hex?: string, name?: string) =>
    decimal
      ? String.fromCodePoint(Number(decimal))
      : hex
        ? String.fromCodePoint(parseInt(hex, 16))
        : (NAMED_REFERENCES[name ?? ''] ?? ''),
  );

const toFingerprint = (sources: string[]) =>
  sources
    .filter((source) => !!source && !isCrossOrigin(source))
    .sort()
    .join('|');

/**
 * Must decode what `getAttribute('src')` decodes, or every check reports an update.
 *
 * Not `DOMParser`: its document inherits the page's CSP, and under a nonce `style-src` each `<style>`
 * in the fetched document, with its fresh nonce, logs a violation.
 */
const readBuildFingerprintFromHtml = (html: string) =>
  toFingerprint(
    Array.from(html.replace(HTML_COMMENT, '').matchAll(SCRIPT_SRC), ([, doubleQuoted, singleQuoted, unquoted]) =>
      decodeCharacterReferences(doubleQuoted ?? singleQuoted ?? unquoted ?? ''),
    ),
  );

/**
 * Identifies the build a document boots from, by its entry script filenames. Those carry a content
 * hash in any production build, so two documents share a fingerprint exactly when reloading one would
 * run the same code - which is the only thing an update check needs to know, and it needs no version
 * file to be generated at build time.
 *
 * Cross-origin scripts are left out: an analytics tag with a cache-busting query would otherwise read
 * as a new deploy on every check.
 */
export const readBuildFingerprint = (document: Document) =>
  toFingerprint(Array.from(document.querySelectorAll('script[src]'), (script) => script.getAttribute('src') ?? ''));

/**
 * Reads the currently deployed build's fingerprint from the app's entry document. Cold: nothing is fetched
 * until it is subscribed.
 *
 * `null` for anything that is not a usable answer - a network failure, a non-2xx response, or a body
 * with no entry scripts in it. Callers must treat that as "no information" rather than as a change:
 * an error page parses perfectly well as HTML, and acting on its empty fingerprint would reload the
 * app in a loop.
 */
export const fetchDeployedBuildFingerprint$ = (url: string): Observable<string | null> =>
  defer(() => fetch(url, { cache: 'no-store', headers: { accept: 'text/html' } })).pipe(
    switchMap((response) => (response.ok ? response.text() : of(null))),
    map((html) => (html === null ? null : readBuildFingerprintFromHtml(html) || null)),
    catchError(() => of(null)),
  );
