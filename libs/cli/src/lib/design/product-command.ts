import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { IncomingMessage } from 'http';
import { dirname, relative } from 'path';
import { jsonLayoutOf } from './json-layout';
import { configPathOf, DesignConfig, DesignProduct, readConfig } from './paths';
import { isBuiltInBase } from './system/base';
import { LAYERS } from './system/layers';
import { productDirOf } from './system/product';

export const PRODUCT_PATH = '/__design/product';

const FROM_PROJECT_KEYS = ['styles', 'head', 'providers', 'themes'] as const;

const valueOf = (argv: string[], flag: string) => {
  const index = argv.indexOf(flag);

  return index === -1 ? null : (argv[index + 1] ?? null);
};

/** Writes a product's `config.json` entry and its empty layer folders; answers with why it refused, or null. */
export const createProduct = (options: {
  target: string;
  name: string;
  base?: string | null;
  fromProject?: string | null;
}): string | null => {
  const { target, name, base, fromProject } = options;

  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) return `BAD NAME "${name}" - use lowercase letters, digits and dashes.`;

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

  const configPath = configPathOf(target);

  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, jsonLayoutOf({ ...config, products: { ...config.products, [name]: entry } }));

  for (const layer of LAYERS) mkdirSync(`${dir}/${layer}`, { recursive: true });

  if (!base) writeFileSync(`${dir}/fixtures.ts`, '');

  return null;
};

/**
 * `et design product new <name> [--base <path|@ethlete/components>] [--from-project <name>]` writes the
 * product's `config.json` entry and its empty layer folders.
 */
export const designProduct = (options: { target: string; argv: string[]; invocation: string }) => {
  const { target, argv, invocation } = options;
  const [verb, name] = argv;

  if (verb !== 'new' || !name || name.startsWith('--')) {
    console.error(`USAGE ${invocation} product new <name> [--base <path|@ethlete/components>] [--from-project <name>]`);

    return 1;
  }

  const flags = argv.slice(2);
  const base = valueOf(flags, '--base');
  const fromProject = valueOf(flags, '--from-project');

  if ((flags.includes('--base') && !base) || (flags.includes('--from-project') && !fromProject)) {
    console.error('A flag is missing its value.');

    return 1;
  }

  const refused = createProduct({ target, name, base, fromProject });

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
 * POST `/__design/product` with `{ name, base? }` creates a product as `et design product new` does. `base` names
 * another product of the checkout, or `@ethlete/components`. Answers 201 with `{ name }`, or 400/409 with `{ error }`.
 */
export const newProductAnswer = async (options: { target: string; request: IncomingMessage }) => {
  const { target, request } = options;

  if (request.method !== 'POST') return { status: 405, body: { error: 'POST only' } };

  const body = await jsonBodyOf(request);
  const name = typeof body?.['name'] === 'string' ? body['name'].trim() : '';
  const base = typeof body?.['base'] === 'string' && body['base'] !== '' ? body['base'] : null;

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
  });

  if (refused) return { status: refused.startsWith('PRODUCT EXISTS') ? 409 : 400, body: { error: refused } };

  return { status: 201, body: { name } };
};
