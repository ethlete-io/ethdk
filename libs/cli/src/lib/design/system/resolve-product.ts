import { existsSync, readFileSync } from 'fs';
import { configPathOf, DesignColorScheme, DesignPreset, DesignProduct } from '../paths';
import { loadBase, ProductSource } from './base';
import { harnessProblemOf } from './harness-config';
import { LAYERS } from './layers';
import { fixturesOf, PartFile, partFilesOf, productDirOf } from './product';
import { Problem } from './problem';

export type PartOrigin = 'product' | 'base' | 'overridden';

export type ResolvedPart = PartFile & { origin: PartOrigin; source: string; cssSource: string | null };

export type ResolvedProduct = ProductSource & {
  base: ProductSource | null;
  parts: ResolvedPart[];
  fixtures: string | null;
  presets: Record<string, DesignPreset>;
  schemes: DesignColorScheme[];
  tokens: string[];
  problems: Problem[];
};

const DEFAULT_TOKEN_PARTS = ['foundations/tokens'];

const COLOR_SCHEMES: DesignColorScheme[] = ['light', 'dark'];

const isSchemeList = (schemes: unknown): schemes is DesignColorScheme[] =>
  Array.isArray(schemes) &&
  schemes.length > 0 &&
  new Set(schemes).size === schemes.length &&
  schemes.every((scheme) => COLOR_SCHEMES.includes(scheme));

export const partKeyOf = (part: { layer: string; name: string }) => `${part.layer}/${part.name}`;

const read = (file: PartFile, origin: PartOrigin): ResolvedPart => ({
  ...file,
  origin,
  source: readFileSync(file.file, 'utf8'),
  cssSource: file.css && existsSync(file.css) ? readFileSync(file.css, 'utf8') : null,
});

const hasPresets = (presets: Record<string, DesignPreset> | undefined): presets is Record<string, DesignPreset> =>
  !!presets && Object.keys(presets).length > 0;

/**
 * A product's design system as it draws: its own parts, the base parts it does not override, the
 * fixture set, the viewport presets and the token parts, each taken from the product first and from the base second.
 */
export const resolveProduct = (options: { target: string; name: string; config: DesignProduct }): ResolvedProduct => {
  const { target, name, config } = options;
  const configFile = configPathOf(target);
  const dir = productDirOf({ target, product: name });
  const own = partFilesOf(dir);
  const loaded = config.base ? loadBase({ target, base: config.base, configFile }) : { base: null, problems: [] };
  const base = loaded.base;
  const inherited = base ? partFilesOf(base.dir) : { parts: [], problems: [] };
  const hidden = new Set(config.hideBaseParts ?? []);
  const ownKeys = new Set(own.parts.map(partKeyOf));
  const baseKeys = new Set(inherited.parts.map(partKeyOf));
  const parts = [
    ...own.parts.map((part) => read(part, baseKeys.has(partKeyOf(part)) ? 'overridden' : 'product')),
    ...inherited.parts
      .filter((part) => !ownKeys.has(partKeyOf(part)) && !hidden.has(partKeyOf(part)))
      .map((part) => read(part, 'base')),
  ].sort((a, b) => LAYERS.indexOf(a.layer) - LAYERS.indexOf(b.layer) || a.name.localeCompare(b.name));
  const basePresets = base?.config.presets;
  const presets = hasPresets(config.presets) ? config.presets : hasPresets(basePresets) ? basePresets : {};
  const problems = [...own.problems, ...loaded.problems, ...inherited.problems];
  const declaredSchemes = config.schemes ?? base?.config.schemes;
  const schemes = isSchemeList(declaredSchemes)
    ? COLOR_SCHEMES.filter((scheme) => declaredSchemes.includes(scheme))
    : COLOR_SCHEMES;

  if (declaredSchemes !== undefined && !isSchemeList(declaredSchemes)) {
    problems.push({
      rule: 'SCHEMES',
      file: configFile,
      message: `product "${name}" declares schemes ${JSON.stringify(declaredSchemes)}; use "light", "dark" or both`,
    });
  }

  const harnessProblem = config.harness === undefined ? null : harnessProblemOf(config.harness);

  if (harnessProblem !== null) {
    problems.push({ rule: 'HARNESS', file: configFile, message: `product "${name}": ${harnessProblem}` });
  }

  if (!hasPresets(presets)) {
    problems.push({
      rule: 'PRESETS',
      file: configFile,
      message: `product "${name}" declares no viewport presets, nor does its base`,
    });
  }

  return {
    name,
    dir,
    config,
    configFile,
    base,
    parts,
    fixtures: fixturesOf(dir) ?? (base ? fixturesOf(base.dir) : null),
    presets,
    schemes,
    tokens: config.tokens ?? base?.config.tokens ?? DEFAULT_TOKEN_PARTS,
    problems,
  };
};
