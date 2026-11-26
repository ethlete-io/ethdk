import scrollbarBase from '../src/lib/scrollbar/scrollbar.component.css?inline';

export type ScrollbarMockOptions = {
  orientation?: 'vertical' | 'horizontal';
  /** The thumb length in px, as the directive computes it from the container's scroll size. */
  thumbSize: number;
  /** The thumb distance from the track start in px, as the directive computes it from the scroll position. */
  thumbOffset?: number;
  /** Draws the `et-scrollbar--visible` class. Left out, visible, as without `autoHide`. */
  visible?: boolean;
  /** Draws the `et-scrollbar--dragging` class, as while the thumb is held. */
  dragging?: boolean;
  /** Draws the host's `data-direction="rtl"`, read off a right-to-left container. */
  rtl?: boolean;
  /** Extra attributes on the host, e.g. a style or design markers. */
  attributes?: string;
  /** Extra attributes on the thumb, e.g. design markers. */
  thumbAttributes?: string;
};

/** The stylesheets `scrollbar()` draws with: the real scrollbar CSS. */
export const scrollbarStyles = /* @__PURE__ */ [scrollbarBase].join('\n');

/** The class the directive puts on the scroll container to hide its native scrollbar. */
export const scrollbarHostClass = 'et-scrollbar-host';

/**
 * Draws `<et-scrollbar>` as HTML: the track over the end edge of its positioned wrapper and the thumb at the given
 * size and offset. Place it next to a container with `scrollbarHostClass` inside a `position: relative` wrapper.
 */
export const scrollbar = (options: ScrollbarMockOptions) => {
  const classes = [
    'et-scrollbar',
    (options.visible ?? true) && 'et-scrollbar--visible',
    options.dragging && 'et-scrollbar--dragging',
  ].filter(Boolean);
  const host = [
    options.attributes,
    `class="${classes.join(' ')}"`,
    `data-orientation="${options.orientation ?? 'vertical'}"`,
    options.rtl && 'data-direction="rtl"',
    `style="--_et-scrollbar-thumb-size: ${options.thumbSize}px; --_et-scrollbar-thumb-offset: ${options.thumbOffset ?? 0}px"`,
  ].filter(Boolean);
  const thumb = [options.thumbAttributes, 'class="et-scrollbar-thumb"', 'etscrollbarthumb=""'].filter(Boolean);

  return `<et-scrollbar ${host.join(' ')}><div ${thumb.join(' ')}></div></et-scrollbar>`;
};
