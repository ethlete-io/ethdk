/** One manifest the host read out of a checkout: a `package.json` anywhere in it, or a root `tsconfig*.json`. */
export type ManifestFile = {
  /** Relative to the checkout, with `/` separators. */
  path: string;
  text: string;
};

/** Every manifest the host read out of one checkout. */
export type CheckoutManifests = {
  repo: string;
  files: ManifestFile[];
};

/** Each checkout mapped to the checkouts it uses as a package: its upstream libraries. */
export type CheckoutDependencies = Readonly<Record<string, readonly string[]>>;

const DEPENDENCY_FIELDS = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

const LOCAL_SPEC = /^(?:file|link|portal):(.+)$/;

type CheckoutUse = {
  names: Set<string>;
  used: Set<string>;
  targets: string[];
};

const normalize = (path: string) => {
  const absolute = path.replaceAll('\\', '/');
  const segments: string[] = [];

  for (const segment of absolute.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') segments.pop();
    else segments.push(segment);
  }

  const drive = /^[A-Za-z]:$/.test(segments[0] ?? '');

  return drive ? segments.join('/') : `/${segments.join('/')}`;
};

const join = (base: string, relative: string) =>
  /^(?:[A-Za-z]:)?[\\/]/.test(relative) ? normalize(relative) : normalize(`${base}/${relative}`);

const dirOf = (path: string) => path.split('/').slice(0, -1).join('/');

/**
 * The JSON inside a `tsconfig`, which allows comments and trailing commas. Anything that still does not
 * parse reads as nothing: a broken manifest names no dependency.
 */
const parseJsonc = (text: string): unknown => {
  let out = '';
  let inString = false;

  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    const next = text[index + 1];

    if (inString) {
      out += char;
      if (char === '\\') out += text[++index] ?? '';
      else if (char === '"') inString = false;
    } else if (char === '"') {
      inString = true;
      out += char;
    } else if (char === '/' && next === '/') {
      while (index < text.length && text[index] !== '\n') index++;
    } else if (char === '/' && next === '*') {
      index = text.indexOf('*/', index + 2);
      if (index < 0) break;
      index++;
    } else {
      out += char;
    }
  }

  try {
    return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
  } catch {
    return undefined;
  }
};

const recordOf = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

const readPackage = (options: { root: string; file: ManifestFile; use: CheckoutUse }) => {
  const { root, file, use } = options;
  const manifest = recordOf(parseJsonc(file.text));
  const at = join(root, dirOf(file.path));

  if (typeof manifest['name'] === 'string') use.names.add(manifest['name']);

  for (const field of DEPENDENCY_FIELDS) {
    for (const [name, spec] of Object.entries(recordOf(manifest[field]))) {
      const local = typeof spec === 'string' ? LOCAL_SPEC.exec(spec)?.[1] : undefined;

      if (local) use.targets.push(join(at, local));
      else use.used.add(name);
    }
  }
};

const readTsconfig = (options: { root: string; file: ManifestFile; use: CheckoutUse }) => {
  const { root, file, use } = options;
  const compilerOptions = recordOf(recordOf(parseJsonc(file.text))['compilerOptions']);
  const at = join(root, dirOf(file.path));
  const baseUrl = typeof compilerOptions['baseUrl'] === 'string' ? join(at, compilerOptions['baseUrl']) : at;

  for (const targets of Object.values(recordOf(compilerOptions['paths']))) {
    if (!Array.isArray(targets)) continue;

    for (const target of targets) {
      if (typeof target === 'string') use.targets.push(join(baseUrl, target.replace(/\*.*$/, '')));
    }
  }
};

const isWithin = (path: string, root: string) => path === root || path.startsWith(`${root}/`);

/**
 * Which checkouts each checkout uses as a package, read from the manifests the host found in them.
 *
 * A checkout uses another when one of its `package.json` files depends on a package the other declares,
 * or points into it through a `file:`, `link:` or `portal:` spec or a `tsconfig` path alias. A name the
 * checkout declares itself is its own workspace package, never another checkout's — which keeps two
 * clones of one repository from using each other.
 */
export const checkoutDependenciesOf = (manifests: readonly CheckoutManifests[]): CheckoutDependencies => {
  const checkouts = manifests.map((entry) => {
    const root = normalize(entry.repo);
    const use: CheckoutUse = { names: new Set(), used: new Set(), targets: [] };

    for (const file of entry.files) {
      const name = file.path.split('/').pop() ?? '';

      if (name === 'package.json') readPackage({ root, file, use });
      else if (name.startsWith('tsconfig') && name.endsWith('.json') && !file.path.includes('/'))
        readTsconfig({ root, file, use });
    }

    return { repo: entry.repo, root, use };
  });
  const checkoutOf = (path: string) =>
    checkouts
      .filter((checkout) => isWithin(path, checkout.root))
      .sort((left, right) => right.root.length - left.root.length)[0];

  const found: Record<string, string[]> = {};

  for (const consumer of checkouts) {
    const upstream = new Set<string>();

    for (const other of checkouts) {
      if (other === consumer) continue;

      const named = [...consumer.use.used].some((name) => other.use.names.has(name) && !consumer.use.names.has(name));

      if (named) upstream.add(other.repo);
    }

    for (const target of consumer.use.targets) {
      const owner = checkoutOf(target);

      if (owner && owner !== consumer) upstream.add(owner.repo);
    }

    if (upstream.size) found[consumer.repo] = [...upstream].sort();
  }

  return found;
};
