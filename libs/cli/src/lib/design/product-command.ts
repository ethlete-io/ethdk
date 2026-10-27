import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { configPathOf, DesignConfig, DesignProduct, readConfig } from './paths';
import { LAYERS } from './system/layers';
import { productDirOf } from './system/product';

const PRESETS = { phone: { width: 390, height: 844 }, desktop: { width: 1440, height: 900 } };
const FROM_PROJECT_KEYS = ['styles', 'head', 'providers', 'themes'] as const;

const valueOf = (argv: string[], flag: string) => {
  const index = argv.indexOf(flag);

  return index === -1 ? null : (argv[index + 1] ?? null);
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

  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
    console.error(`BAD NAME "${name}" - use lowercase letters, digits and dashes.`);

    return 1;
  }

  const flags = argv.slice(2);
  const base = valueOf(flags, '--base');
  const fromProject = valueOf(flags, '--from-project');

  if ((flags.includes('--base') && !base) || (flags.includes('--from-project') && !fromProject)) {
    console.error('A flag is missing its value.');

    return 1;
  }

  const config: DesignConfig = readConfig(target) ?? {};
  const dir = productDirOf({ target, product: name });

  if (config.products?.[name] || existsSync(dir)) {
    console.error(`PRODUCT EXISTS - ${name} is declared in config.json or its folder exists; nothing was changed.`);

    return 1;
  }

  const entry: DesignProduct = {};

  if (fromProject) {
    const project = config.projects?.[fromProject];

    if (!project) {
      console.error(
        `NO PROJECT "${fromProject}" - config.json declares ${Object.keys(config.projects ?? {}).join(', ') || 'none'}.`,
      );

      return 1;
    }

    for (const key of FROM_PROJECT_KEYS) {
      if (project[key] !== undefined) Object.assign(entry, { [key]: JSON.parse(JSON.stringify(project[key])) });
    }
  }

  if (base) entry.base = base;
  else entry.presets = JSON.parse(JSON.stringify(PRESETS));

  const configPath = configPathOf(target);

  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(
    configPath,
    `${JSON.stringify({ ...config, products: { ...config.products, [name]: entry } }, null, 2)}\n`,
  );

  for (const layer of LAYERS) mkdirSync(`${dir}/${layer}`, { recursive: true });

  writeFileSync(`${dir}/fixtures.ts`, '');
  console.log(`Created product ${name}.`);

  return 0;
};
