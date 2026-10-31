import bannerBase from '../src/lib/banner/banner.component.css?inline';
import iconButtonBase from '../src/lib/button/icon-button.component.css?inline';
import textButtonBase from '../src/lib/button/text-button.component.css?inline';
import { CIRCLE_CHECK_ICON } from '../src/lib/icon/headless/circle-check-icon';
import { CIRCLE_INFO_ICON } from '../src/lib/icon/headless/circle-info-icon';
import iconBase from '../src/lib/icon/headless/icon-styles.component.css?inline';
import { TIMES_ICON } from '../src/lib/icon/headless/times-icon';
import { TRIANGLE_EXCLAMATION_ICON } from '../src/lib/icon/headless/triangle-exclamation-icon';
import { buttonStyles } from './button';
import { iconMarkup } from './icon';

export type BannerMockType = 'info' | 'success' | 'warning' | 'error';

export type BannerMockOptions = {
  type?: BannerMockType;
  heading?: string;
  description?: string;
  /** The projected `[etIcon]`. Left out, the type's usual icon; `false` draws none. */
  icon?: 'info' | 'check' | 'triangle' | false;
  /** The label of a projected `et-text-button etBannerAction`. Left out, no action. */
  action?: string;
  /** Extra attributes on the action button, e.g. design markers. */
  actionAttributes?: string;
  dismissible?: boolean;
  /** Extra attributes on the dismiss button, e.g. design markers. */
  dismissAttributes?: string;
  /**
   * The color theme name the banner forces: the `color` input, else the app's semantic theme for `success`,
   * `warning` and `error`. Left out, the banner takes the color theme around it, as `info` does.
   */
  color?: string;
  /** Extra attributes on the banner, e.g. design markers. */
  attributes?: string;
};

const ICONS = {
  info: CIRCLE_INFO_ICON,
  check: CIRCLE_CHECK_ICON,
  triangle: TRIANGLE_EXCLAMATION_ICON,
} as const;

const TYPE_ICONS: Record<BannerMockType, keyof typeof ICONS> = {
  info: 'info',
  success: 'check',
  warning: 'triangle',
  error: 'triangle',
};

/** The stylesheets `banner()` draws with: the real banner, icon button, text button and icon CSS. */
export const bannerStyles = /* @__PURE__ */ [buttonStyles, iconBase, iconButtonBase, textButtonBase, bannerBase].join(
  '\n',
);

const dismissButton = (attributes?: string) =>
  `<button ${attributes ?? ''} aria-label="Dismiss" type="button" class="et-banner-dismiss-btn et-surface-interactive et-color-interactive et-icon-button et-focus-ring et-color--inherited" data-variant="transparent" data-size="xs"><div class="et-icon-button-icon">${iconMarkup(TIMES_ICON)}</div></button>`;

const actionButton = (label: string, attributes?: string) =>
  `<button ${attributes ?? ''} etBannerAction type="button" class="et-text-button et-color-interactive et-focus-ring et-color--inherited" data-icon-alignment="start" data-size="md"><div class="et-text-button-contents">${label}</div></button>`;

/** Draws an `et-banner` with its projected icon and action as the component renders it, as HTML. */
export const banner = (options: BannerMockOptions) => {
  const type = options.type ?? 'info';
  const icon = options.icon === false ? '' : iconMarkup(ICONS[options.icon ?? TYPE_ICONS[type]]);
  const heading = options.heading ? `<p class="et-banner-heading">${options.heading}</p>` : '';
  const description = options.description ? `<p class="et-banner-description">${options.description}</p>` : '';
  const action = options.action ? actionButton(options.action, options.actionAttributes) : '';
  const dismiss = options.dismissible ? dismissButton(options.dismissAttributes) : '';
  const role = type === 'warning' || type === 'error' ? 'alert' : 'status';
  const attributes = [
    options.attributes,
    `class="et-color--${options.color ?? 'inherited'} et-banner"`,
    `role="${role}"`,
    `data-type="${type}"`,
  ].filter(Boolean);

  return `<et-banner ${attributes.join(' ')}>${icon}<div class="et-banner-content">${heading}${description}${action}</div>${dismiss}</et-banner>`;
};
