import badgeBase from '../src/lib/badge/badge.component.css?inline';
import iconBase from '../src/lib/icon/headless/icon-styles.component.css?inline';
import { IconDefinition } from '../src/lib/icon/headless/icon-definition';
import { iconMarkup } from './icon';

export type BadgeMockOptions = {
  label: string;
  variant?: 'filled' | 'tonal' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  icon?: IconDefinition;
  iconAlignment?: 'start' | 'end';
  /** A color theme name the app registers. Left out, the badge takes the color theme around it. */
  color?: string;
  /** Extra attributes on the badge, e.g. design markers. */
  attributes?: string;
};

/** The stylesheets `badge()` draws with: the real badge and icon CSS. */
export const badgeStyles = /* @__PURE__ */ [
  iconBase,
  badgeBase,
  `@layer components {
  .et-badge-mock-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
  }
}`,
].join('\n');

/** Draws an `et-badge` as the component renders it, as HTML. */
export const badge = (options: BadgeMockOptions) => {
  const alignment = options.iconAlignment ?? 'start';
  const icon = `<div class="et-badge-icon">${options.icon ? iconMarkup(options.icon) : ''}</div>`;
  const attributes = [
    options.attributes ?? '',
    `data-variant="${options.variant ?? 'tonal'}"`,
    `data-size="${options.size ?? 'md'}"`,
    `data-icon-alignment="${alignment}"`,
    `class="et-badge et-color--${options.color ?? 'inherited'}"`,
  ].filter(Boolean);

  return `<et-badge ${attributes.join(' ')}>${alignment === 'start' ? icon : ''}<span class="et-badge-label">${options.label}</span>${alignment === 'end' ? icon : ''}</et-badge>`;
};

/** Draws badges in a wrapping row. */
export const badgeRow = (badges: string[]) => `<div class="et-badge-mock-row">${badges.join('')}</div>`;
