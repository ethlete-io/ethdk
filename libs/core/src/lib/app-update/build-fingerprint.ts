const isCrossOrigin = (source: string) => /^(https?:)?\/\//.test(source);

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
  Array.from(document.querySelectorAll('script[src]'))
    .map((script) => script.getAttribute('src') ?? '')
    .filter((source) => !!source && !isCrossOrigin(source))
    .sort()
    .join('|');

/**
 * Reads the currently deployed build's fingerprint from the app's entry document.
 *
 * `null` for anything that is not a usable answer - a network failure, a non-2xx response, or a body
 * with no entry scripts in it. Callers must treat that as "no information" rather than as a change:
 * an error page parses perfectly well as HTML, and acting on its empty fingerprint would reload the
 * app in a loop.
 */
export const fetchDeployedBuildFingerprint = async (url: string): Promise<string | null> => {
  try {
    const response = await fetch(url, { cache: 'no-store', headers: { accept: 'text/html' } });

    if (!response.ok) {
      return null;
    }

    const parsed = new DOMParser().parseFromString(await response.text(), 'text/html');

    return readBuildFingerprint(parsed) || null;
  } catch {
    return null;
  }
};
