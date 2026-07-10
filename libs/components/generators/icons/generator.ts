import { formatFiles, logger, Tree, workspaceRoot } from '@nx/devkit';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

//#region Types

type IconEntry = string | { name: string; variant?: string; variants?: string[] };

type IconsConfig = {
  /** Source package override. Falls back to the generator's `source` option, then auto-detection. */
  source?: string;
  /**
   * Default variant(s) generated for icons that don't specify their own — i.e. shorthand string
   * entries and object entries without a `variant`/`variants`. Defaults to `['solid']`. List more
   * than one to emit several styles per icon by default (e.g. `['solid', 'light']`).
   */
  variants?: string[];
  icons: IconEntry[];
};

type ResolvedIcon = { name: string; variant: string };

type GeneratorSchema = {
  configPath?: string;
  outputPath?: string;
  typesOutputPath?: string;
  source?: string;
  skipFormat?: boolean;
};

//#endregion

//#region Constants

// Known SVG sources, tried in order during auto-detection. All use a `svgs/<variant>/<name>.svg` layout.
const KNOWN_SOURCES = ['@fortawesome/fontawesome-pro', '@fortawesome/fontawesome-free'];

const DEFAULT_CONFIG_PATH = 'src/icons.json';
const DEFAULT_OUTPUT_PATH = 'src/generated/et-icons.ts';
const DEFAULT_VARIANTS = ['solid'];

//#endregion

export default async function generate(tree: Tree, schema: GeneratorSchema) {
  logger.log('\n🎨 Starting Ethlete icon generator...\n');

  const configPath = schema.configPath || DEFAULT_CONFIG_PATH;
  const outputPath = schema.outputPath || DEFAULT_OUTPUT_PATH;
  const typesOutputPath = schema.typesOutputPath || join(dirname(outputPath), 'et-icon-registry.d.ts');

  // Step 1: Read the icons config.
  if (!tree.exists(configPath)) {
    logger.error(`❌ Icons config not found at: ${configPath}`);
    logger.log(`\nCreate one, or point to it with --configPath. Example ${configPath}:`);
    logger.log(
      `  { "variants": ["solid"], "icons": ["plus", { "name": "shield", "variants": ["light", "solid"] }] }\n`,
    );

    return;
  }

  let config: IconsConfig;
  try {
    config = JSON.parse(tree.read(configPath, 'utf-8') || '') as IconsConfig;
  } catch (error) {
    logger.error(`❌ Failed to parse ${configPath}: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }

  if (!Array.isArray(config.icons) || config.icons.length === 0) {
    logger.error(`❌ ${configPath} must contain a non-empty "icons" array.`);

    return;
  }

  // Prefer the `variants` list; fall back to `['solid']`.
  const defaultVariants = config.variants?.length ? config.variants : DEFAULT_VARIANTS;

  // Step 2: Resolve the SVG source package. `'auto'` (the default, from the option or the
  // config) means auto-detect; an explicit package name overrides it.
  const configuredSource = schema.source && schema.source !== 'auto' ? schema.source : config.source;
  const requestedSource = configuredSource && configuredSource !== 'auto' ? configuredSource : undefined;
  const source = resolveSource(requestedSource);

  if (!source) {
    logger.error('❌ Could not find an icon source. Install @fortawesome/fontawesome-pro (or -free), or set "source".');

    return;
  }

  logger.log(`📦 Using icon source: ${source.package}`);

  // Step 3: Read + transform each icon's SVG.
  const requested = normalizeIcons(config.icons, defaultVariants);
  const resolved: (ResolvedIcon & { data: string })[] = [];
  const missing: string[] = [];

  for (const icon of requested) {
    const svgPath = join(source.svgsDir, icon.variant, `${icon.name}.svg`);

    if (!existsSync(svgPath)) {
      missing.push(`${icon.name} (${icon.variant})`);
      continue;
    }

    resolved.push({ ...icon, data: toIconData(readFileSync(svgPath, 'utf-8')) });
  }

  if (missing.length) {
    logger.warn(
      `⚠️  ${missing.length} icon(s) not found in ${source.package} and skipped:\n   - ${missing.join('\n   - ')}`,
    );
  }

  if (resolved.length === 0) {
    logger.error('❌ No icons could be resolved. Nothing was written.');

    return;
  }

  // Step 4: Write the IconDefinition constants.
  tree.write(outputPath, generateIconsFile(resolved, schema, source.package));
  logger.log(`✅ Generated ${resolved.length} icon(s) at: ${outputPath}`);

  // Step 5: Write the type augmentation so `etIcon`/`variant` are checked against these names.
  tree.write(typesOutputPath, generateTypesFile(resolved, schema));
  logger.log(`✅ Generated icon name types at: ${typesOutputPath}`);

  if (!schema.skipFormat) {
    await formatFiles(tree);
  }

  logger.log('\n✅ Icon generation completed successfully!\n');
}

//#region Helpers

function resolveSource(requested?: string): { package: string; svgsDir: string } | null {
  const candidates = requested ? [requested] : KNOWN_SOURCES;

  for (const pkg of candidates) {
    const svgsDir = join(workspaceRoot, 'node_modules', pkg, 'svgs');

    if (existsSync(svgsDir)) {
      return { package: pkg, svgsDir };
    }
  }

  return null;
}

function normalizeIcons(entries: IconEntry[], defaultVariants: string[]): ResolvedIcon[] {
  const seen = new Set<string>();
  const result: ResolvedIcon[] = [];

  const add = (name: string, variant: string) => {
    const key = `${name}::${variant}`;

    if (!seen.has(key)) {
      seen.add(key);
      result.push({ name, variant });
    }
  };

  for (const entry of entries) {
    // A bare string uses the config's default variants. An object may override with its own
    // `variants` list (or the singular `variant`); otherwise it also gets the defaults.
    const variants =
      typeof entry === 'string'
        ? defaultVariants
        : (entry.variants ?? (entry.variant ? [entry.variant] : defaultVariants));
    const name = typeof entry === 'string' ? entry : entry.name;

    for (const variant of variants) {
      add(name, variant);
    }
  }

  // Stable ordering keeps regeneration diffs minimal.
  return result.sort((a, b) => `${a.name}::${a.variant}`.localeCompare(`${b.name}::${b.variant}`));
}

/** Make a raw SVG etIcon-compatible: fill its host, inherit currentColor, drop the license comment. */
function toIconData(rawSvg: string): string {
  return rawSvg
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace('<svg ', '<svg width="100%" height="100%" fill="currentColor" ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** `shield` + `light` -> `SHIELD_LIGHT` */
function constName(name: string, variant: string): string {
  return `${name}_${variant}`.replace(/[^a-z0-9]+/gi, '_').toUpperCase();
}

function regenerateCommand(schema: GeneratorSchema): string {
  const parts = ['nx g @ethlete/components:icons'];

  if (schema.configPath) parts.push(`--configPath=${schema.configPath}`);
  if (schema.outputPath) parts.push(`--outputPath=${schema.outputPath}`);
  if (schema.typesOutputPath) parts.push(`--typesOutputPath=${schema.typesOutputPath}`);
  if (schema.source && schema.source !== 'auto') parts.push(`--source=${schema.source}`);

  return parts.join(' ');
}

function generateIconsFile(
  icons: (ResolvedIcon & { data: string })[],
  schema: GeneratorSchema,
  source: string,
): string {
  const header = `/* eslint-disable */
/*
 * Auto-generated by @ethlete/components:icons from "${source}"
 * DO NOT EDIT THIS FILE MANUALLY
 *
 * Regenerate by running:
 * ${regenerateCommand(schema)}
 */
import type { IconDefinition } from '@ethlete/components';
`;

  const consts = icons
    .map(
      (icon) =>
        `export const ${constName(icon.name, icon.variant)}: IconDefinition = {\n` +
        `  name: '${icon.name}',\n` +
        `  variant: '${icon.variant}',\n` +
        `  data: \`${icon.data}\`,\n` +
        `};`,
    )
    .join('\n\n');

  const aggregate = `export const GENERATED_ICONS = [\n${icons
    .map((icon) => `  ${constName(icon.name, icon.variant)},`)
    .join('\n')}\n] as const;`;

  return `${header}\n${consts}\n\n${aggregate}\n`;
}

function generateTypesFile(icons: ResolvedIcon[], schema: GeneratorSchema): string {
  const names = [...new Set(icons.map((i) => i.name))]
    .sort()
    .map((n) => `'${n}'`)
    .join(' | ');
  const variants = [...new Set(icons.map((i) => i.variant))]
    .sort()
    .map((v) => `'${v}'`)
    .join(' | ');

  return `/*
 * Auto-generated by @ethlete/components:icons
 * DO NOT EDIT THIS FILE MANUALLY
 *
 * Regenerate by running:
 * ${regenerateCommand(schema)}
 */

declare module '@ethlete/components' {
  interface EthleteIconNameRegistry {
    name: ${names};
  }

  interface EthleteIconVariantRegistry {
    name: ${variants};
  }
}

export {};
`;
}

//#endregion
