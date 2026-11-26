export type TokenKind = 'triplet' | 'color' | 'opacity' | 'dropped-opacity' | 'dropped';

export type TokenRename = {
  old: string;
  new: string | null;
  kind: TokenKind;
};

const STATES = ['hover', 'focus', 'active', 'disabled'] as const;

const SURFACE_RENAMED: readonly (readonly [string, string])[] = [
  ['background', 'background'],
  ['color', 'text'],
  ['color-muted', 'text-muted'],
  ['color-subtle', 'text-subtle'],
  ['border', 'border'],
];

const SURFACE_INTERACTION_FAMILIES = ['interaction', 'on-interaction', 'interaction-ink'] as const;

const TONE_FAMILIES: readonly (readonly [string, string, string])[] = [
  ['primary', 'primary', 'fill'],
  ['on-primary', 'on-primary', 'on-fill'],
  ['primary-ink', 'ink', 'text'],
];

const DROPPED_TONE_FAMILIES = ['secondary', 'tertiary', 'on-secondary', 'on-tertiary', 'secondary-ink', 'tertiary-ink'];

const COMPONENT_TRIPLETS: readonly (readonly [string, string])[] = [
  ['--et-shadow-color-rgb', '--et-shadow-color'],
  ['--et-scrim-color-rgb', '--et-scrim-color'],
  ['--et-on-scrim-color-rgb', '--et-on-scrim-color'],
  ['--et-button-filled-hover-rgb', '--et-button-filled-hover'],
];

const buildTable = () => {
  const table: TokenRename[] = [];
  const add = (old: string, next: string | null, kind: TokenKind) => table.push({ old, new: next, kind });

  const addSurface = (oldBase: string, newBase: string) => {
    add(oldBase, newBase, 'triplet');
    add(`${oldBase}-rgb`, newBase, 'triplet');
    add(`${oldBase}-solid`, newBase, 'color');
  };

  for (const [oldWord, newWord] of SURFACE_RENAMED) {
    addSurface(`--et-surface-${oldWord}`, `--et-surface-${newWord}`);
  }

  for (const family of SURFACE_INTERACTION_FAMILIES) {
    addSurface(`--et-surface-${family}`, `--et-surface-${family}`);

    for (const state of STATES) {
      addSurface(`--et-surface-${family}-${state}`, `--et-surface-${family}-${state}`);
    }
  }

  for (const [themeWord, liveWord, toneWord] of TONE_FAMILIES) {
    add(`--et-color-${themeWord}`, `--et-tone-${toneWord}-rest`, 'triplet');

    for (const state of STATES) {
      add(`--et-color-${themeWord}-${state}`, `--et-tone-${toneWord}-${state}`, 'triplet');
    }

    add(`--et-theme-color-${liveWord}`, `--et-tone-${toneWord}`, 'color');
    add(`--et-theme-color-${liveWord}-rgb`, `--et-tone-${toneWord}`, 'triplet');
    add(`--et-theme-color-${liveWord}-solid`, `--et-tone-${toneWord}`, 'color');
    add(
      `--et-theme-color-${liveWord}-opacity`,
      liveWord === 'primary' ? '--_et-tone-fill-opacity' : null,
      liveWord === 'primary' ? 'opacity' : 'dropped-opacity',
    );
  }

  for (const family of DROPPED_TONE_FAMILIES) {
    add(`--et-color-${family}`, null, 'dropped');

    for (const state of STATES) {
      add(`--et-color-${family}-${state}`, null, 'dropped');
    }
  }

  for (const [old, next] of COMPONENT_TRIPLETS) {
    add(old, next, 'triplet');
  }

  return table;
};

/** Every CSS custom property the theming revision renames, with its new name and the old value type. */
export const THEME_TOKEN_RENAMES: readonly TokenRename[] = buildTable();

export const THEME_TOKEN_RENAME_BY_OLD: ReadonlyMap<string, TokenRename> = new Map(
  THEME_TOKEN_RENAMES.map((entry) => [entry.old, entry]),
);

/** Every old name the table renames or removes, as a whole name. */
export const RENAMED_TOKEN_LEFT = new RegExp(
  `(?<![\\w-])(?:${THEME_TOKEN_RENAMES.filter((entry) => entry.old !== entry.new)
    .map((entry) => entry.old)
    .sort((a, b) => b.length - a.length)
    .join('|')})(?![\\w-])`,
  'g',
);

/**
 * Names that are not in the table but belong to a retired family: an unknown `-rgb`/`-solid` surface name, any
 * `--et-theme-color-*`, and the tone families of `--et-color-*`.
 */
export const RETIRED_TOKEN_FAMILY =
  /--et-(?:surface-[a-z0-9-]+-(?:rgb|solid)(?![\w-])|theme-color-[\w$-]*|color-(?:primary|on-primary|secondary|on-secondary|tertiary|on-tertiary)(?![a-z0-9]))/g;

export const SURFACE_TRIPLET_READ =
  /\brgba?\(\s*var\(\s*--et-surface-(?:background|border|interaction|on-interaction|interaction-ink)(?:-(?:hover|focus|active|disabled))?\s*[,)]/g;

export type TailwindRename = { old: string; new: string };

const TONE_UTILITY_FAMILIES: readonly (readonly [string, string])[] = [
  ['', 'fill'],
  ['on-', 'on-fill'],
  ['-ink', 'text'],
];

const SURFACE_UTILITY_SUFFIXES: readonly (readonly [string, string])[] = [
  ['-bg', '-background'],
  ['', '-text'],
  ['-muted', '-text-muted'],
  ['-subtle', '-text-subtle'],
];

const withStates = (old: string, next: string): TailwindRename[] => [
  { old, new: next },
  ...STATES.map((state) => ({ old: `${old}-${state}`, new: `${next}-${state}` })),
];

/** Tailwind color names (without `--color-` or a utility) the theming revision renames for one prefix. */
export const tailwindColorRenames = (prefix: string, themeNames: readonly string[]): TailwindRename[] =>
  ['theme', ...themeNames].flatMap((theme) => {
    const toneBase = theme === 'theme' ? `${prefix}-tone` : `${prefix}-tone-${theme}`;

    return TONE_UTILITY_FAMILIES.flatMap(([marker, toneWord]) => {
      const old =
        marker === 'on-'
          ? `${prefix}-on-${theme}`
          : marker === '-ink'
            ? `${prefix}-${theme}-ink`
            : `${prefix}-${theme}`;

      return withStates(old, `${toneBase}-${toneWord}`);
    });
  });

/** Tailwind surface color names the theming revision renames for one prefix. */
export const tailwindSurfaceRenames = (prefix: string, surfaceNames: readonly string[]): TailwindRename[] =>
  ['', ...surfaceNames.map((name) => `-${name}`)].flatMap((surface) =>
    SURFACE_UTILITY_SUFFIXES.map(([oldSuffix, newSuffix]) => ({
      old: `${prefix}-surface${surface}${oldSuffix}`,
      new: `${prefix}-surface${surface}${newSuffix}`,
    })),
  );
