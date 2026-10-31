import breadcrumbOverflowBase from '../src/lib/breadcrumb/breadcrumb-overflow.component.css?inline';
import breadcrumbBase from '../src/lib/breadcrumb/breadcrumb.component.css?inline';
import iconButtonBase from '../src/lib/button/icon-button.component.css?inline';
import { CHEVRON_ICON } from '../src/lib/icon/headless/chevron-icon';
import { ELLIPSIS_ICON } from '../src/lib/icon/headless/ellipsis-icon';
import iconBase from '../src/lib/icon/headless/icon-styles.component.css?inline';
import overlayContainer from '../src/lib/overlay/overlay-container.component.css?inline';
import floatingTip from '../src/lib/overlay/floating-tip-styles.component.css?inline';
import overlayArrow from '../src/lib/overlay/strategies/overlay-arrow-styles.component.css?inline';
import toggletipBase from '../src/lib/toggletip/toggletip.component.css?inline';
import { buttonStyles } from './button';
import { iconMarkup } from './icon';

export type BreadcrumbMockCrumb = {
  /** The crumb content, as HTML. */
  label: string;
  /** Draws the crumb as a link. Left out, it is a plain `<span>`, as the page you are on. */
  href?: string;
  /** Extra attributes on the crumb, e.g. design markers. */
  attributes?: string;
};

export type BreadcrumbMockOptions = {
  crumbs: BreadcrumbMockCrumb[];
  /**
   * Draws the collapsed trail: the crumbs at these indexes move behind the overflow trigger. First and
   * last must stay, as the component keeps them.
   */
  collapsed?: number[];
  /** Extra attributes on the overflow trigger, e.g. design markers. */
  overflowAttributes?: string;
  /** Overrides the navigation and overflow labels. */
  labels?: { navigation?: string; overflow?: string };
  /** Extra attributes on the breadcrumb, e.g. design markers. */
  attributes?: string;
};

/** The stylesheets `breadcrumb()` and `breadcrumbOverflowPanel()` draw with: the real breadcrumb, icon button, toggletip and overlay pane CSS. */
export const breadcrumbStyles = /* @__PURE__ */ [
  buttonStyles,
  iconBase,
  iconButtonBase,
  overlayContainer,
  overlayArrow,
  floatingTip,
  toggletipBase,
  breadcrumbBase,
  breadcrumbOverflowBase,
  `@layer components {
  .et-breadcrumb-mock-pane {
    --_et-overlay-arrow-pane-border-width: 1px;
    inline-size: max-content;
  }
  .et-breadcrumb-mock-pane > .et-overlay-arrow {
    left: 20px;
  }
}`,
].join('\n');

const crumb = (item: BreadcrumbMockCrumb, isCurrent: boolean) => {
  const tag = item.href !== undefined ? 'a' : 'span';
  const attributes = [
    item.attributes,
    'etbreadcrumbitem=""',
    'class="et-breadcrumb-item"',
    item.href !== undefined && `href="${item.href}"`,
    isCurrent && 'aria-current="page"',
  ].filter(Boolean);

  return `<${tag} ${attributes.join(' ')}>${item.label}</${tag}>`;
};

const separator = `<span class="et-breadcrumb-separator" aria-hidden="true">${/* @__PURE__ */ iconMarkup(CHEVRON_ICON, 'et-breadcrumb-chevron')}</span>`;

const overflowTrigger = (label: string, attributes?: string) => {
  const classes = [
    'et-surface-interactive',
    'et-color-interactive',
    'et-icon-button',
    'et-focus-ring',
    'et-color--surface',
    'et-breadcrumb-overflow-trigger',
  ];

  return `<et-breadcrumb-overflow class="et-breadcrumb-overflow"><button ${attributes ?? ''} ettoggletiptrigger="" type="button" aria-label="${label}" aria-haspopup="dialog" aria-expanded="false" class="${classes.join(' ')}" data-variant="transparent" data-size="xs"><div class="et-icon-button-icon">${iconMarkup(ELLIPSIS_ICON)}</div></button></et-breadcrumb-overflow>`;
};

/** Draws an `et-breadcrumb` as the component renders it, as HTML: a chevron between crumbs, the last one marked as the current page. */
export const breadcrumb = (options: BreadcrumbMockOptions) => {
  const { crumbs, collapsed = [] } = options;
  const hidden = new Set(collapsed.filter((index) => index > 0 && index < crumbs.length - 1));
  const overflowLabel = options.labels?.overflow ?? 'Show hidden levels';

  const slots: string[] = [];
  let overflowDrawn = false;

  crumbs.forEach((item, index) => {
    if (hidden.has(index)) {
      if (overflowDrawn) return;
      overflowDrawn = true;
      slots.push(
        `<li data-type="overflow" class="et-breadcrumb-slot">${overflowTrigger(overflowLabel, options.overflowAttributes)}`,
      );

      return;
    }

    slots.push(`<li data-type="item" class="et-breadcrumb-slot">${crumb(item, index === crumbs.length - 1)}`);
  });

  const list = slots.map((slot, index) => `${slot}${index < slots.length - 1 ? separator : ''}</li>`).join('');

  const hostAttributes = [
    options.attributes,
    'class="et-breadcrumb"',
    'role="navigation"',
    `aria-label="${options.labels?.navigation ?? 'Breadcrumb'}"`,
    hidden.size > 0 && 'data-collapsed=""',
  ].filter(Boolean);

  return `<et-breadcrumb ${hostAttributes.join(' ')}><ol class="et-breadcrumb-list">${list}</ol></et-breadcrumb>`;
};

/**
 * Draws the open overflow toggletip with the hidden crumbs, in its overlay pane above the trigger, as HTML.
 * The pane sits in flow with its arrow 20px from the start, so place it over the drawn trigger.
 */
export const breadcrumbOverflowPanel = (crumbs: BreadcrumbMockCrumb[], surface?: string) => {
  const surfaceClass = `et-surface--${surface ?? 'inherited'}`;
  const paneClasses = [
    'et-overlay',
    'et-overlay-runtime-pane',
    'et-toggletip-panel',
    'et-overlay--toggletip',
    'et-floating-panel',
    'et-color--inherited',
    surfaceClass,
    'et-with-default-animation',
    'et-animation-enter-done',
    'et-breadcrumb-mock-pane',
  ];
  const list = crumbs.map((item) => `<li>${crumb(item, false)}</li>`).join('');

  return `<div class="${paneClasses.join(' ')}" data-overlay-placement="top-start"><et-toggletip class="et-toggletip et-color--inherited ${surfaceClass}" role="dialog"><div class="et-toggletip__surface"><div class="et-toggletip__content"><ol class="et-breadcrumb-overflow-list" data-toggletip-hug="">${list}</ol></div></div></et-toggletip><div et-floating-arrow class="et-overlay-arrow"></div></div>`;
};
