import { writeDesignFile } from './system/design-file';
import { existsSync, mkdirSync } from 'fs';
import { IncomingMessage } from 'http';
import { dirname, relative } from 'path';
import { jsonLayoutOf } from './json-layout';
import { configPathOf, DesignConfig, DesignProduct, readConfig } from './design-config';
import { isBuiltInBase } from './system/base';
import { argsOf } from './system/sketch/cli-args';
import { COLOR_SCHEMES, ColorScheme, colorsSkeletonOf, isHexColor } from './system/sketch/colors-skeleton';
import { LAYERS } from './system/layers';
import { productDirOf } from './system/product';

export const PRODUCT_PATH = '/__design/product';

export const PRODUCT_BASE_PATH = '/__design/product-base';

const FROM_PROJECT_KEYS = ['styles', 'head', 'providers', 'themes'] as const;

/**
 * Writes a product's `config.json` entry and its empty layer folders, plus a colors foundation when `colors` or
 * `accent` is given; answers with why it refused, or null.
 */
export const createProduct = (options: {
  target: string;
  name: string;
  base?: string | null;
  fromProject?: string | null;
  colors?: string | null;
  accent?: string | null;
}): string | null => {
  const { target, name, base, fromProject, colors, accent } = options;

  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) return `BAD NAME "${name}" - use lowercase letters, digits and dashes.`;
  if (colors && !COLOR_SCHEMES.includes(colors as ColorScheme)) {
    return `BAD COLORS "${colors}" - use ${COLOR_SCHEMES.join(', ')}.`;
  }
  if (accent && !isHexColor(accent)) return `BAD ACCENT "${accent}" - use a hex colour like #e50914.`;

  const config: DesignConfig = readConfig(target) ?? {};
  const dir = productDirOf({ target, product: name });

  if (config.products?.[name] || existsSync(dir)) {
    return `PRODUCT EXISTS - ${name} is declared in config.json or its folder exists; nothing was changed.`;
  }

  const entry: DesignProduct = {};

  if (fromProject) {
    const project = config.projects?.[fromProject];

    if (!project) {
      return `NO PROJECT "${fromProject}" - config.json declares ${Object.keys(config.projects ?? {}).join(', ') || 'none'}.`;
    }

    for (const key of FROM_PROJECT_KEYS) {
      if (project[key] !== undefined) Object.assign(entry, { [key]: project[key] });
    }
  }

  if (base) entry.base = base;
  else entry.presets = { phone: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } };

  if (colors === 'light' || colors === 'dark') entry.schemes = [colors];
  if (accent) entry.accent = accent;

  const configPath = configPathOf(target);

  mkdirSync(dirname(configPath), { recursive: true });
  writeDesignFile(configPath, jsonLayoutOf({ ...config, products: { ...config.products, [name]: entry } }));

  for (const layer of LAYERS) mkdirSync(`${dir}/${layer}`, { recursive: true });

  if (!base) writeDesignFile(`${dir}/fixtures.ts`, '');

  if (colors || accent) {
    const skeleton = colorsSkeletonOf({ scheme: (colors as ColorScheme | null | undefined) ?? 'both', accent });

    mkdirSync(`${dir}/foundations/colors`, { recursive: true });

    for (const [file, source] of Object.entries(skeleton.files)) {
      writeDesignFile(`${dir}/foundations/colors/${file}`, source);
    }
  }

  return null;
};

const setProductKey = (options: {
  target: string;
  name: string;
  key: 'base' | 'accent';
  value: string;
}): string | null => {
  const { target, name, key, value } = options;
  const config: DesignConfig = readConfig(target) ?? {};
  const entry = config.products?.[name];

  if (!entry) {
    return `NO PRODUCT "${name}" - config.json declares ${Object.keys(config.products ?? {}).join(', ') || 'none'}.`;
  }

  const { [key]: _previous, ...rest } = entry;
  const next: DesignProduct = value === 'none' ? rest : { ...rest, [key]: value };

  writeDesignFile(configPathOf(target), jsonLayoutOf({ ...config, products: { ...config.products, [name]: next } }));

  return null;
};

/**
 * Sets or, with `none`, removes the `base` of a declared product in `config.json`; answers with why it refused, or null.
 */
export const setProductBase = (options: { target: string; name: string; base: string }): string | null =>
  setProductKey({ target: options.target, name: options.name, key: 'base', value: options.base });

/**
 * Sets or, with `none`, removes the chosen `accent` of a declared product in `config.json`; answers with why it refused, or null.
 */
export const setProductAccent = (options: { target: string; name: string; accent: string }): string | null => {
  const { accent } = options;

  if (accent !== 'none' && !isHexColor(accent))
    return `BAD ACCENT "${accent}" - use a hex colour like #e50914, or none.`;

  return setProductKey({ target: options.target, name: options.name, key: 'accent', value: accent });
};

/**
 * `et design product new <name> [--base <path|@ethlete/components>] [--from-project <name>] [--colors light|dark|both] [--accent <#hex>]` writes the
 * product's `config.json` entry and its empty layer folders. `--colors` and `--accent` start its colors foundation
 * with those surfaces and that primary colour, and the accent is recorded as the product's binding primary; `--colors` defaults to both.
 * `et design product set <name> --base <path|@ethlete/components|none>` changes the base of an existing product, `--accent <#hex|none>` its accent.
 */
export const designProduct = (options: { target: string; argv: string[]; invocation: string }) => {
  const { target, argv, invocation } = options;
  const usage = [
    `USAGE ${invocation} product new <name> [--base <path|@ethlete/components>] [--from-project <name>] [--colors light|dark|both] [--accent <#hex>]`,
    `      ${invocation} product set <name> --base <path|@ethlete/components|none>`,
    `      ${invocation} product set <name> --accent <#hex|none>`,
  ].join('\n');
  const args = argsOf(argv, { values: ['--base', '--from-project', '--colors', '--accent'], switches: [] });

  if (typeof args === 'string') {
    console.error(`${args}\n${usage}`);

    return 2;
  }

  const [verb, name] = args.positional;

  if ((verb !== 'new' && verb !== 'set') || !name || args.positional.length > 2) {
    console.error(usage);

    return 1;
  }

  if (verb === 'set') {
    const base = args.values['--base'];
    const accent = args.values['--accent'];

    if ((!base && !accent) || Object.keys(args.values).length > 1) {
      console.error(usage);

      return 1;
    }

    const refused = base
      ? setProductBase({ target, name, base })
      : setProductAccent({ target, name, accent: accent ?? '' });

    if (refused) {
      console.error(refused);

      return 1;
    }

    if (base) console.log(base === 'none' ? `${name} inherits from no base.` : `${name} inherits from ${base}.`);
    else console.log(accent === 'none' ? `${name} has no chosen accent.` : `${name} keeps ${accent} as its primary.`);

    return 0;
  }

  const base = args.values['--base'] ?? null;
  const fromProject = args.values['--from-project'] ?? null;

  const colors = args.values['--colors'] ?? 'both';
  const accent = args.values['--accent'] ?? null;

  const refused = createProduct({ target, name, base, fromProject, colors, accent });

  if (refused) {
    console.error(refused);

    return 1;
  }

  console.log(`Created product ${name}.`);

  return 0;
};

const jsonBodyOf = async (request: IncomingMessage): Promise<Record<string, unknown> | null> => {
  const chunks: Buffer[] = [];

  for await (const chunk of request) chunks.push(Buffer.from(chunk as Uint8Array));

  try {
    const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');

    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

/**
 * POST `/__design/product` with `{ name, base?, colors?, accent? }` creates a product as `et design product new` does, `colors` defaulting to both. `base` names
 * another product of the checkout, or `@ethlete/components`. Answers 201 with `{ name }`, or 400/409 with `{ error }`.
 */
export const newProductAnswer = async (options: { target: string; request: IncomingMessage }) => {
  const { target, request } = options;

  if (request.method !== 'POST') return { status: 405, body: { error: 'POST only' } };

  const body = await jsonBodyOf(request);
  const name = typeof body?.['name'] === 'string' ? body['name'].trim() : '';
  const stringOf = (key: string) => {
    const value = body?.[key];

    return typeof value === 'string' && value !== '' ? value : null;
  };
  const base = stringOf('base');

  if (!name) return { status: 400, body: { error: 'A name is required.' } };

  const config = readConfig(target) ?? {};
  const builtIn = base !== null && isBuiltInBase(base);
  const baseConfig = base && !builtIn ? config.products?.[base] : undefined;

  if (base && !builtIn && !baseConfig) return { status: 400, body: { error: `NO PRODUCT "${base}" to inherit from.` } };
  if (baseConfig?.base) {
    return { status: 400, body: { error: `"${base}" inherits from another product, so it can not be a base.` } };
  }

  const refused = createProduct({
    target,
    name,
    base: base ? (builtIn ? base : relative(target, productDirOf({ target, product: base }))) : null,
    colors: stringOf('colors') ?? 'both',
    accent: stringOf('accent'),
  });

  if (refused) return { status: refused.startsWith('PRODUCT EXISTS') ? 409 : 400, body: { error: refused } };

  return { status: 201, body: { name } };
};

/**
 * POST `/__design/product-base` with `{ name, base }` sets the base of an existing product as `et design product set` does;
 * `none` removes it. Answers 200 with `{ name, base }`, or 400 with `{ error }`.
 */
export const productBaseAnswer = async (options: { target: string; request: IncomingMessage }) => {
  const { target, request } = options;

  if (request.method !== 'POST') return { status: 405, body: { error: 'POST only' } };

  const body = await jsonBodyOf(request);
  const name = typeof body?.['name'] === 'string' ? body['name'] : '';
  const base = typeof body?.['base'] === 'string' ? body['base'] : '';

  if (!name || !base) return { status: 400, body: { error: 'A name and a base are required.' } };

  const refused = setProductBase({ target, name, base });

  if (refused) return { status: 400, body: { error: refused } };

  return { status: 200, body: { name, base } };
};
