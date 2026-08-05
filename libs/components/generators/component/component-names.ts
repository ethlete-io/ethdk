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
  /** `components-stat-tile` - Storybook story id prefix, for `<StoryEmbed>`. */
  storyIdPrefix: string;
};

const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

export function componentNames(name: string): ComponentNames {
  const { fileName, className, constantName } = names(name.trim());

  if (!KEBAB.test(fileName)) {
    throw new Error(`"${name}" is not a usable domain name. Use kebab-case, e.g. "stat-tile".`);
  }

  const words = fileName.replace(/-/g, ' ');

  return {
    fileName,
    className,
    constantName,
    elementSelector: `et-${fileName}`,
    attributeSelector: `et${className}`,
    title: words.charAt(0).toUpperCase() + words.slice(1),
    storyIdPrefix: `components-${fileName}`,
  };
}
