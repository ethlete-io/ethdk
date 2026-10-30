import { existsSync, readdirSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import postcss from 'postcss';
import { ProductSource } from '../base';
import { cssBlocksOf, declarationValueOf } from '../css-source';
import { ownSharedFilesOf, SharedDirs } from '../imports';
import { Problem } from '../problem';
import { ResolvedProduct } from '../resolve-product';
import { textsOf } from '../ts-source';

const ALIGN = ['start', 'end', 'center', 'stretch', 'baseline', 'flex-start', 'flex-end', 'normal'];
const DISTRIBUTE = [...ALIGN, 'space-between', 'space-around', 'space-evenly'];
const OVERFLOW = ['auto', 'hidden', 'visible', 'scroll', 'clip'];
const SIZE = ['100%', 'auto', 'fit-content', 'min-content', 'max-content', '100vw', '100vh', '100dvh'];

const KEYWORDS: Record<string, string[]> = {
  display: [
    'flex',
    'inline-flex',
    'grid',
    'inline-grid',
    'block',
    'inline-block',
    'inline',
    'none',
    'contents',
    'flow-root',
  ],
  position: ['static', 'relative', 'absolute', 'fixed', 'sticky'],
  'flex-direction': ['row', 'row-reverse', 'column', 'column-reverse'],
  'flex-wrap': ['wrap', 'nowrap', 'wrap-reverse'],
  flex: ['1', 'auto', 'none', 'initial'],
  'flex-grow': ['0', '1'],
  'flex-shrink': ['0', '1'],
  'align-items': ALIGN,
  'align-self': [...ALIGN, 'auto'],
  'align-content': DISTRIBUTE,
  'justify-content': DISTRIBUTE,
  'justify-items': ALIGN,
  'justify-self': [...ALIGN, 'auto'],
  'place-items': ALIGN,
  'place-content': DISTRIBUTE,
  overflow: OVERFLOW,
  'overflow-x': OVERFLOW,
  'overflow-y': OVERFLOW,
  'text-align': ['left', 'center', 'right', 'justify', 'start', 'end'],
  'white-space': ['normal', 'nowrap', 'pre', 'pre-line', 'pre-wrap', 'break-spaces'],
  'text-overflow': ['ellipsis', 'clip'],
  'text-transform': ['uppercase', 'lowercase', 'capitalize', 'none'],
  'font-style': ['italic', 'normal'],
  'pointer-events': ['none', 'auto'],
  'user-select': ['none', 'text', 'all', 'auto'],
  visibility: ['visible', 'hidden', 'collapse'],
  'box-sizing': ['border-box', 'content-box'],
  cursor: ['pointer', 'default', 'not-allowed', 'text', 'move', 'grab', 'grabbing', 'wait', 'help', 'none', 'auto'],
  width: SIZE,
  height: SIZE,
  'min-width': SIZE,
  'min-height': SIZE,
  'max-width': SIZE,
  'max-height': SIZE,
};

const SPACING = [
  'gap',
  'row-gap',
  'column-gap',
  'padding',
  'padding-top',
  'padding-right',
  'padding-bottom',
  'padding-left',
  'padding-inline',
  'padding-block',
  'margin',
  'margin-top',
  'margin-right',
  'margin-bottom',
  'margin-left',
  'margin-inline',
  'margin-block',
  'inset',
  'top',
  'right',
  'bottom',
  'left',
  'width',
  'height',
  'min-width',
  'min-height',
  'max-width',
  'max-height',
];

const COLOUR = [
  'color',
  'background',
  'background-color',
  'border-color',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'outline-color',
  'text-decoration-color',
  'caret-color',
  'accent-color',
  'fill',
  'stroke',
];

const RADIUS = [
  'border-radius',
  'border-top-left-radius',
  'border-top-right-radius',
  'border-bottom-left-radius',
  'border-bottom-right-radius',
];

const NAMESPACES: [prefix: string, properties: string[]][] = [
  ['--color-', COLOUR],
  ['--spacing-', SPACING],
  ['--font-weight-', ['font-weight']],
  ['--font-', ['font-family']],
  ['--text-', ['font-size']],
  ['--leading-', ['line-height']],
  ['--tracking-', ['letter-spacing']],
  ['--radius-', RADIUS],
  ['--shadow-', ['box-shadow']],
];

type Utilities = { values: Map<string, Set<string>>; spacingScale: boolean; tailwind: boolean };

const stylesheetImportsOf = (file: string, css: string) => {
  const files: string[] = [];
  let tailwind = false;

  postcss.parse(css).walkAtRules('import', (rule) => {
    const specifier = /^(?:url\(\s*)?['"]?([^'"\s)]+)/u.exec(rule.params.trim())?.[1];

    if (specifier?.startsWith('.')) files.push(resolve(dirname(file), specifier));
    if (specifier === 'tailwindcss' || specifier?.startsWith('tailwindcss/')) tailwind = true;
  });

  return { files, tailwind };
};

const themeDeclarationsOf = (sources: ProductSource[]) => {
  const root = (source: ProductSource) => resolve(dirname(source.configFile), '../..');
  const queue = sources.flatMap((source) => (source.config.styles ?? []).map((style) => resolve(root(source), style)));
  const seen = new Set<string>();
  const declarations: [name: string, value: string][] = [];
  let tailwind = false;

  for (let file = queue.shift(); file !== undefined; file = queue.shift()) {
    if (seen.has(file) || !existsSync(file)) continue;
    seen.add(file);

    const css = readFileSync(file, 'utf8');

    try {
      const imports = stylesheetImportsOf(file, css);

      queue.push(...imports.files);
      tailwind ||= imports.tailwind;
      postcss.parse(css).walkAtRules('theme', (rule) =>
        rule.walkDecls((declaration) => {
          declarations.push([declaration.prop, declaration.value.trim()]);
        }),
      );
    } catch {
      continue;
    }
  }

  return { declarations, tailwind };
};

const utilitiesOf = (product: ResolvedProduct): Utilities => {
  const values = new Map<string, Set<string>>();
  let spacingScale = false;
  const { declarations, tailwind } = themeDeclarationsOf([product, ...(product.base ? [product.base] : [])]);

  const add = (properties: string[], value: string) => {
    for (const property of properties) values.set(property, (values.get(property) ?? new Set()).add(value));
  };

  for (const [name, value] of declarations) {
    if (name === '--spacing') spacingScale = true;

    const namespace = NAMESPACES.find(([prefix]) => name.startsWith(prefix));

    if (!namespace || name.includes('*') || value === 'initial') {
      continue;
    }

    add(namespace[1], `var(${name})`);
    if (/^var\(--[\w-]+\)$/u.test(value)) add(namespace[1], value);
  }

  return { values, spacingScale, tailwind };
};

const topLevelPartsOf = (value: string) => {
  const parts: string[] = [];
  let depth = 0;
  let part = '';

  for (const char of value) {
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (char === ' ' && depth === 0) {
      if (part) parts.push(part);
      part = '';
    } else part += char;
  }

  return part ? [...parts, part] : parts;
};

type Declaration = { property: string; value: string };

const isSpacing = (utilities: Utilities, { property, value }: Declaration) =>
  value === '0' ||
  !!utilities.values.get(property)?.has(value) ||
  (utilities.spacingScale &&
    /^(?:var\(--spacing\)|calc\(var\(--spacing\)\*-?\d*\.?\d+\))$/u.test(value.replace(/ /g, '')));

const hasUtility = (utilities: Utilities, { property, value }: Declaration) => {
  if (KEYWORDS[property]?.includes(value)) return true;
  if (COLOUR.includes(property) && ['transparent', 'currentcolor'].includes(value)) return true;
  if (SPACING.includes(property)) {
    const parts = topLevelPartsOf(value);

    if (parts.length <= 4 && parts.every((part) => isSpacing(utilities, { property, value: part }))) return true;
  }

  return !!utilities.values.get(property)?.has(value);
};

const withoutKeyframes = (css: string) => css.replace(/@keyframes[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/gu, '');

const lastCompoundOf = (selector: string) =>
  selector
    .trim()
    .split(/[\s>+~]+/u)
    .pop() ?? '';

const withoutSdkElementRules = (css: string) => {
  try {
    const root = postcss.parse(css);

    root.walkRules((rule) => {
      if (rule.selectors.every((selector) => /\.et-[\w-]/u.test(lastCompoundOf(selector)))) rule.remove();
    });

    return root.toString();
  } catch {
    return css;
  }
};

const expressibleDeclarationsOf = (utilities: Utilities, css: string) =>
  cssBlocksOf(withoutSdkElementRules(withoutKeyframes(css))).declarations.flatMap((declaration) => {
    const property = declaration.slice(0, declaration.indexOf(':')).trim().toLowerCase();
    const value = (declarationValueOf(declaration) ?? '')
      .replace(/!important/u, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    return value && hasUtility(utilities, { property, value }) ? [`${property}: ${value}`] : [];
  });

const utilityProblemsOf = (file: string, declarations: string[]): Problem[] =>
  [...new Set(declarations)].map((declaration) => ({
    rule: 'UTILITY-CSS',
    file,
    message: `${declaration} outside foundations - a Tailwind utility in the markup draws it`,
  }));

const sourceFilesIn = (dir: string) =>
  existsSync(dir)
    ? (readdirSync(dir, { recursive: true }) as string[])
        .filter((path) => /\.(ts|css)$/u.test(path) && !path.endsWith('.d.ts'))
        .map((path) => resolve(dir, path))
    : [];

/**
 * A declaration that a Tailwind utility of the product draws, in a CSS file below the folder of a part outside
 * foundations or in the CSS of a TS file there: a core layout keyword such as `display: flex`, or a value of a
 * spacing, colour, type, radius or shadow token that a `@theme` block of the product's stylesheets registers. A rule
 * whose selectors all end on an SDK `.et-*` element passes: the part's markup cannot put a utility there. A product
 * whose stylesheets import no `tailwindcss` has no utilities, so nothing is flagged.
 */
export const utilityCssOf = (product: ResolvedProduct & SharedDirs): Problem[] => {
  const utilities = utilitiesOf(product);

  if (!utilities.tailwind) return [];

  const below = product.parts
    .filter((part) => part.layer !== 'foundations')
    .flatMap((part) => sourceFilesIn(dirname(part.file)));
  const files = new Set([...below, ...ownSharedFilesOf(product, below)]);

  return [...files].sort().flatMap((file) => {
    const source = readFileSync(file, 'utf8');
    const texts = file.endsWith('.css') ? [source] : textsOf(source);

    return utilityProblemsOf(
      file,
      texts.flatMap((text) => expressibleDeclarationsOf(utilities, text)),
    );
  });
};
