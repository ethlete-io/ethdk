import iconButtonBase from '../src/lib/button/icon-button.component.css?inline';
import { CHEVRON_ICON } from '../src/lib/icon/headless/chevron-icon';
import iconBase from '../src/lib/icon/headless/icon-styles.component.css?inline';
import buttonsBase from '../src/lib/scrollable/headless/scrollable-buttons.component.css?inline';
import footerBase from '../src/lib/scrollable/headless/scrollable-footer.css?inline';
import masksBase from '../src/lib/scrollable/headless/scrollable-masks.component.css?inline';
import navigationBase from '../src/lib/scrollable/headless/scrollable-navigation.component.css?inline';
import scrollableBase from '../src/lib/scrollable/scrollable.component.css?inline';
import { buttonStyles } from './button';
import { iconMarkup } from './icon';

export type ScrollableMockItem = {
  /** The item's inner HTML. */
  content: string;
  /** Extra attributes on the item, e.g. a class, a style or design markers. */
  attributes?: string;
  /** The tag the consumer projects. Left out, `div`. */
  tag?: string;
  /** Draws `et-scrollable-item--not-intersecting`, as `etScrollableDarken` does for an item out of view. */
  notIntersecting?: boolean;
};

export type ScrollableMockOptions = {
  items: ScrollableMockItem[];
  direction?: 'horizontal' | 'vertical';
  /** Draws `et-scrollable--can-scroll`. Left out, the content overflows. */
  canScroll?: boolean;
  /** The scroll position the directive reads: it decides the start and end classes. Left out, `start`. */
  position?: 'start' | 'middle' | 'end';
  /** Draws `et-scrollable--has-partial-items`. Left out, true while the content can scroll and masks render. */
  partialItems?: boolean;
  /** Left out, the masks render, as `renderMasks` defaults to. */
  renderMasks?: boolean;
  maskVariant?: 'gradient' | 'border';
  /** Where `etScrollableButtons` renders its buttons. Left out, no buttons. */
  buttons?: 'inside' | 'footer';
  stickyButtons?: boolean;
  /** Extra attributes on the start button, e.g. design markers. */
  startButtonAttributes?: string;
  /** Extra attributes on the end button, e.g. design markers. */
  endButtonAttributes?: string;
  /** The dot index `etScrollableNavigation` marks active. Left out, no navigation. */
  navigationActive?: number;
  /** Draws `et-scrollable--darken-non-intersecting-items`, as `etScrollableDarken` does. */
  darken?: boolean;
  /** Draws the `snap` attributes `etScrollableSnap` sets. */
  snap?: boolean;
  /** A color theme name the app registers. Left out, the scrollable takes the color theme around it. */
  color?: string;
  /** The `itemSize` the scrollable lays its items out with. Left out, `auto`. */
  itemSize?: 'auto' | 'same' | 'full' | 'half' | 'third' | 'quarter';
  /** The gap between the items in px, as the directive reads it from the container. Left out, 0. */
  itemGap?: number;
  /** Extra classes on the host, e.g. the class a wrapping component puts on it. */
  class?: string;
  /** Extra attributes on the host, e.g. a style or design markers. */
  attributes?: string;
  /** Extra attributes on the scroll container, e.g. a style that offsets it to a scrolled position. */
  containerAttributes?: string;
};

/** The stylesheets `scrollable()` draws with: the real scrollable, masks, buttons, navigation and icon-button CSS. */
export const scrollableStyles = /* @__PURE__ */ [
  buttonStyles,
  iconBase,
  iconButtonBase,
  scrollableBase,
  masksBase,
  buttonsBase,
  navigationBase,
  footerBase,
].join('\n');

type ScrollButtonOptions = { edge: 'start' | 'end'; disabled: boolean; attributes?: string };

const scrollButton = ({ edge, disabled, attributes }: ScrollButtonOptions) => {
  const classes = [
    'et-scrollable-button',
    `et-scrollable-button--${edge}`,
    'et-icon-button',
    'et-color-interactive',
    'et-focus-ring',
    'et-color--inherited',
  ];
  const host = [
    attributes,
    disabled && 'disabled aria-disabled="true"',
    `class="${classes.join(' ')}"`,
    'aria-hidden="true"',
    'type="button"',
    'tabindex="-1"',
    'data-variant="transparent"',
    'data-size="xs"',
  ].filter(Boolean);

  return `<button ${host.join(' ')}><div class="et-icon-button-icon">${iconMarkup(CHEVRON_ICON)}</div></button>`;
};

type NavigationOptions = { count: number; active: number; horizontal: boolean };

const navigation = ({ count, active, horizontal }: NavigationOptions) => {
  const offset = count > 5 ? (active < 3 ? 0 : active >= count - 3 ? 5 - count : -(active - 2)) * 20 : 0;
  const dots = Array.from({ length: count }, (_, index) => {
    const distance = Math.abs(index - active);
    const classes = [
      'et-scrollable-navigation-item',
      distance === 0 && 'et-scrollable-navigation-item--active',
      distance === 1 && 'et-scrollable-navigation-item--close',
      distance > 1 && 'et-scrollable-navigation-item--far',
    ].filter(Boolean);

    return `<button active-offset="${distance}" class="${classes.join(' ')}" type="button" tabindex="-1" aria-hidden="true"></button>`;
  }).join('');

  const container = [
    'class="et-scrollable-dots-container"',
    `style="transform: translate${horizontal ? 'X' : 'Y'}(${offset}px)"`,
  ];

  return (
    `<et-scrollable-navigation class="et-scrollable-navigation" aria-hidden="true"><div class="et-scrollable-progress-bar">` +
    `<div ${container.join(' ')}>${dots}</div>` +
    `</div></et-scrollable-navigation>`
  );
};

/**
 * Draws `<et-scrollable>` as HTML: the scroll container with its observer elements and the projected items, the
 * edge masks, and the buttons and navigation dots its feature directives contribute. A scrolled position is
 * drawn by offsetting the container's content statically through `containerAttributes`.
 */
export const scrollable = (options: ScrollableMockOptions) => {
  const direction = options.direction ?? 'horizontal';
  const canScroll = options.canScroll ?? true;
  const position = canScroll ? (options.position ?? 'start') : 'start';
  const renderMasks = options.renderMasks ?? true;
  const atStart = !canScroll || position === 'start';
  const atEnd = !canScroll || position === 'end';
  const hasNavigation = options.navigationActive !== undefined;

  const classes = [
    'et-scrollable',
    `et-color--${options.color ?? 'inherited'}`,
    canScroll && 'et-scrollable--can-scroll',
    atStart && 'et-scrollable--is-at-start',
    atEnd && 'et-scrollable--is-at-end',
    (options.partialItems ?? (canScroll && renderMasks)) && 'et-scrollable--has-partial-items',
    options.darken && 'et-scrollable--darken-non-intersecting-items',
    options.stickyButtons && options.buttons === 'inside' && 'et-scrollable--sticky-buttons',
    options.class,
  ].filter(Boolean);

  const host = [
    options.attributes,
    `class="${classes.join(' ')}"`,
    `item-size="${options.itemSize ?? 'auto'}"`,
    `direction="${direction}"`,
    options.snap && 'snap="" snap-origin="auto"',
    `mask-variant="${options.maskVariant ?? 'gradient'}"`,
    `style="--item-count: ${options.items.length}; --item-gap: ${options.itemGap ?? 0}px; --_et-scrollable-scroll-margin: 0px"`,
  ].filter(Boolean);

  const itemMarkup = options.items
    .map((item) => {
      const tag = item.tag ?? 'div';
      const itemClasses = ['et-scrollable-item', item.notIntersecting && 'et-scrollable-item--not-intersecting'].filter(
        Boolean,
      );
      const attributes = item.attributes ?? '';
      const merged = /\bclass="/.test(attributes)
        ? attributes.replace(/\bclass="/, `class="${itemClasses.join(' ')} `)
        : `${attributes} class="${itemClasses.join(' ')}"`;

      return `<${tag} ${merged.trim()}>${item.content}</${tag}>`;
    })
    .join('');

  const buttons = (slot: 'overlay' | 'footer') =>
    `<et-scrollable-buttons class="et-scrollable-buttons et-scrollable-buttons--${slot === 'footer' ? 'footer' : 'inside'}">` +
    scrollButton({ edge: 'start', disabled: atStart, attributes: options.startButtonAttributes }) +
    scrollButton({ edge: 'end', disabled: atEnd, attributes: options.endButtonAttributes }) +
    `</et-scrollable-buttons>`;

  const footerParts = [
    options.buttons === 'footer' && buttons('footer'),
    hasNavigation &&
      navigation({
        count: options.items.length,
        active: options.navigationActive ?? 0,
        horizontal: direction === 'horizontal',
      }),
  ].filter(Boolean);

  const footerClasses = [
    'et-scrollable-footer',
    hasNavigation && 'et-scrollable-footer--with-navigation',
    options.buttons === 'footer' && 'et-scrollable-footer--with-buttons',
  ].filter(Boolean);

  const footer =
    footerParts.length && canScroll
      ? `<div class="${footerClasses.join(' ')}" aria-hidden="true">${footerParts.join('')}</div>`
      : '';

  return (
    `<et-scrollable ${host.join(' ')}><div class="et-scrollable-wrapper" role="presentation">` +
    `<div class="et-scrollable-container" ${options.containerAttributes ?? ''}>` +
    `<div class="et-scroll-observer-first-element" etscrollableignorechild=""></div>` +
    itemMarkup +
    `<div class="et-scroll-observer-last-element" etscrollableignorechild=""></div>` +
    `</div>` +
    (renderMasks
      ? `<et-scrollable-masks class="et-scrollable-masks"><div class="et-scrollable-mask et-scrollable-mask--start"></div><div class="et-scrollable-mask et-scrollable-mask--end"></div></et-scrollable-masks>`
      : '') +
    (options.buttons === 'inside' ? buttons('overlay') : '') +
    `</div>${footer}</et-scrollable>`
  );
};
