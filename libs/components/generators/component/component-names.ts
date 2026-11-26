import { names } from '@nx/devkit';

export type ComponentNames = {
  /** `stat-tile` - folder and file base name. */
  fileName: string;
  /** `StatTile` - class name prefix. */
  className: string;
  /** `STAT_TILE` - imports barrel and error code prefix. */
  constantName: string;
  /** `et-stat-tile` - Tier 3 element selector and host class. */
  elementSelector: string;
  /** `etStatTile` - Tier 2 attribute selector. */
  attributeSelector: string;
  /** `Stat tile` - Storybook title and docs heading. */
  title: string;
  /** `Data display` - Storybook category the story sits under, below `Components`. */
  category: string;
  /** `components-data-display-stat-tile` - Storybook story id prefix, for `<StoryEmbed>`. */
  storyIdPrefix: string;
};

const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

/** Every category under `Components/` in Storybook. A new domain has to join one of them. */
export const COMPONENT_CATEGORIES = [
  'Actions',
  'Data display',
  'Date & time',
  'Dev tools',
  'Feedback',
  'Forms',
  'Layout',
  'Media',
  'Navigation',
  'Overlays',
  'Sports',
] as const;

export type ComponentCategory = (typeof COMPONENT_CATEGORIES)[number];

/** Mirrors Storybook's own title-to-id slugify, so `storyIdPrefix` matches the id it will really get. */
const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export function componentNames(name: string, category: ComponentCategory = 'Layout'): ComponentNames {
  const { fileName, className, constantName } = names(name.trim());

  if (!KEBAB.test(fileName)) {
    throw new Error(`"${name}" is not a usable domain name. Use kebab-case, e.g. "stat-tile".`);
  }

  if (!COMPONENT_CATEGORIES.includes(category)) {
    throw new Error(`"${category}" is not a Storybook category. Use one of: ${COMPONENT_CATEGORIES.join(', ')}.`);
  }

  const words = fileName.replace(/-/g, ' ');

  return {
    fileName,
    className,
    constantName,
    elementSelector: `et-${fileName}`,
    attributeSelector: `et${className}`,
    title: words.charAt(0).toUpperCase() + words.slice(1),
    category,
    storyIdPrefix: `components-${slugify(category)}-${fileName}`,
  };
}
