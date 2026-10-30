import { execFileSync } from 'child_process';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import postcss from 'postcss';
import { ProductSource } from '../base';
import { ownSharedFilesOf, SharedDirs } from '../imports';
import { Problem } from '../problem';
import { ResolvedPart, ResolvedProduct } from '../resolve-product';
import { textsOf } from '../ts-source';

const CANONICALIZE = `
const { __unstable__loadDesignSystem } = require(process.argv[1]);
const { css, base, rem, candidates } = JSON.parse(require('fs').readFileSync(0, 'utf8'));
__unstable__loadDesignSystem(css, { base })
  .then((system) => process.stdout.write(JSON.stringify(candidates.map((c) => system.canonicalizeCandidates([c], { rem }).join(' ')))))
  .catch((error) => { process.stderr.write(String(error && error.message || error)); process.exit(1); });
`;

const DEFAULT_REM = 16;

const stylesheetsOf = (product: ResolvedProduct) => {
  const source = [product, product.base].find((each): each is ProductSource => !!each?.config.styles?.length);

  if (!source) return [];

  const root = resolve(dirname(source.configFile), '../..');

  return (source.config.styles ?? []).map((style) => resolve(root, style));
};

const remOf = (stylesheets: string[]) => {
  const queue = [...stylesheets];
  const seen = new Set<string>();
  let rem = DEFAULT_REM;

  for (let file = queue.shift(); file !== undefined; file = queue.shift()) {
    if (seen.has(file) || !existsSync(file)) continue;
    seen.add(file);

    try {
      const root = postcss.parse(readFileSync(file, 'utf8'));

      root.walkAtRules('import', (rule) => {
        const specifier = /^(?:url\(\s*)?['"]?([^'"\s)]+)/u.exec(rule.params.trim())?.[1];

        if (specifier?.startsWith('.')) queue.push(resolve(dirname(file), specifier));
      });
      root.walkRules(/^(?:html|:root)$/u, (rule) =>
        rule.walkDecls('font-size', (declaration) => {
          const [, amount, unit] = /^(\d*\.?\d+)(%|px)$/u.exec(declaration.value.trim()) ?? [];

          if (amount) rem = unit === '%' ? (DEFAULT_REM * Number(amount)) / 100 : Number(amount);
        }),
      );
    } catch {
      continue;
    }
  }

  return rem;
};

const candidatesIn = (texts: string[]) => texts.flatMap((text) => text.split(/[\s"'`<>]+/u).filter(Boolean));

const tsSourcesIn = (dir: string) =>
  existsSync(dir)
    ? (readdirSync(dir, { recursive: true }) as string[])
        .filter((path) => path.endsWith('.ts') && !path.endsWith('.d.ts') && !path.endsWith('.spec.ts'))
        .map((path) => resolve(dir, path))
        .map((file) => ({ file, source: readFileSync(file, 'utf8') }))
    : [];

const sourcesOf = (part: ResolvedPart) => [
  { file: part.file, source: part.source },
  ...tsSourcesIn(dirname(part.file)).filter(({ file }) => file !== part.file),
];

const canonicalCache = new Map<string, Map<string, string>>();

const canonicalFormsOf = (options: { target: string; css: string; rem: number; candidates: string[] }) => {
  const key = `${options.rem}\n${options.css}`;
  const known = canonicalCache.get(key) ?? new Map<string, string>();
  const missing = [...new Set(options.candidates)].filter((candidate) => !known.has(candidate));

  canonicalCache.set(key, known);

  if (missing.length > 0) {
    const tailwind = require.resolve('@tailwindcss/node', { paths: [options.target, __dirname] });
    const output = execFileSync(process.execPath, ['-e', CANONICALIZE, tailwind], {
      input: JSON.stringify({ css: options.css, base: options.target, rem: options.rem, candidates: missing }),
      encoding: 'utf8',
      maxBuffer: 1 << 28,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const forms = JSON.parse(output) as string[];

    missing.forEach((candidate, index) => known.set(candidate, forms[index] ?? candidate));
  }

  return known;
};

/**
 * A Tailwind class in the markup of a part that has a canonical form under the product's stylesheets, as
 * Tailwind IntelliSense reports it: `w-[420px]` that can be written as `w-2xl`. The root font size the
 * stylesheets set on `html` is the rem base.
 */
export const canonicalClassesOf = (product: ResolvedProduct & SharedDirs): Problem[] => {
  const stylesheets = stylesheetsOf(product);

  if (stylesheets.length === 0) return [];

  const target = resolve(dirname(product.configFile), '../..');
  const below = product.parts.filter((part) => part.origin !== 'base').flatMap(sourcesOf);
  const shared = ownSharedFilesOf(
    product,
    below.map(({ file }) => file),
  )
    .filter((file) => file.endsWith('.ts'))
    .map((file) => ({ file, source: readFileSync(file, 'utf8') }));
  const files = [...new Map([...below, ...shared].map((entry) => [entry.file, entry])).values()].sort((a, b) =>
    a.file.localeCompare(b.file),
  );
  const candidatesOf = new Map(files.map(({ file, source }) => [file, [...new Set(candidatesIn(textsOf(source)))]]));
  const css = stylesheets.map((file) => `@import ${JSON.stringify(file)};`).join('\n');
  let forms: Map<string, string>;

  try {
    forms = canonicalFormsOf({ target, css, rem: remOf(stylesheets), candidates: [...candidatesOf.values()].flat() });
  } catch (error) {
    const reason = (error as { stderr?: string }).stderr?.trim() || (error as Error).message;

    return [
      {
        rule: 'CANONICAL-CLASS',
        file: stylesheets[0] ?? product.dir,
        message: `no Tailwind design system - ${reason}`,
      },
    ];
  }

  return files.flatMap(({ file }) =>
    (candidatesOf.get(file) ?? []).flatMap((candidate) => {
      const canonical = forms.get(candidate);

      return canonical && canonical !== candidate
        ? [{ rule: 'CANONICAL-CLASS', file, message: `The class \`${candidate}\` can be written as \`${canonical}\`` }]
        : [];
    }),
  );
};
