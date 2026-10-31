import { Placement } from '@floating-ui/dom';
import overlayContainer from '../src/lib/overlay/overlay-container.component.css?inline';
import floatingTip from '../src/lib/overlay/floating-tip-styles.component.css?inline';
import overlayArrow from '../src/lib/overlay/strategies/overlay-arrow-styles.component.css?inline';
import tooltipBase from '../src/lib/tooltip/tooltip.component.css?inline';

export type TooltipMockOptions = {
  /** The tooltip text, as HTML. Drawn like a string `etTooltip`. */
  text?: string;
  /** Template content, as HTML. Drawn like a `TemplateRef` `etTooltip`; wins over `text`. */
  content?: string;
  /** The side the pane opened on; the arrow points back at the trigger. Defaults to `top`. */
  placement?: Placement;
  /** A surface theme name the app registers. */
  surface?: string;
  /** The tooltip id, which the trigger's `aria-describedby` points at. */
  id?: string;
  /** Extra attributes on the `<et-tooltip>`, e.g. design markers. */
  attributes?: string;
};

/** The stylesheets `tooltip()` draws with: the real `et-tooltip`, floating tip, overlay pane and arrow CSS. */
export const tooltipStyles = /* @__PURE__ */ [
  overlayContainer,
  overlayArrow,
  floatingTip,
  tooltipBase,
  `@layer components {
  .et-tooltip-mock-frame > .et-tooltip-panel {
    --_et-overlay-arrow-pane-border-width: 1px;
    inline-size: max-content;
  }
  .et-tooltip-mock-frame > .et-tooltip-panel:is([data-overlay-placement^='top'], [data-overlay-placement^='bottom']) > .et-overlay-arrow {
    left: calc(50% - 10px);
  }
  .et-tooltip-mock-frame > .et-tooltip-panel:is([data-overlay-placement^='left'], [data-overlay-placement^='right']) > .et-overlay-arrow {
    top: calc(50% - 10px);
  }
  .et-tooltip-mock-frame > .et-tooltip-panel:is([data-overlay-placement^='top-start'], [data-overlay-placement^='bottom-start']) > .et-overlay-arrow {
    left: 20px;
  }
  .et-tooltip-mock-frame > .et-tooltip-panel:is([data-overlay-placement^='top-end'], [data-overlay-placement^='bottom-end']) > .et-overlay-arrow {
    left: calc(100% - 40px);
  }
  .et-tooltip-mock-frame > .et-tooltip-panel:is([data-overlay-placement^='left-start'], [data-overlay-placement^='right-start']) > .et-overlay-arrow {
    top: 20px;
  }
  .et-tooltip-mock-frame > .et-tooltip-panel:is([data-overlay-placement^='left-end'], [data-overlay-placement^='right-end']) > .et-overlay-arrow {
    top: calc(100% - 40px);
  }
}`,
].join('\n');

/**
 * Draws an open `et-tooltip` in its overlay pane, with the arrow, as HTML. The pane sits in flow,
 * wrapped in a frame that centers the arrow on its side, instead of where the overlay runtime would
 * position it, so place it next to the drawn trigger.
 */
export const tooltip = (options: TooltipMockOptions = {}) => {
  const { placement = 'top', id = 'et-tooltip-1' } = options;
  const surface = `et-surface--${options.surface ?? 'inherited'}`;
  const hasTemplate = options.content !== undefined;

  const paneClasses = [
    'et-overlay',
    'et-overlay-runtime-pane',
    'et-tooltip-panel',
    'et-overlay--tooltip',
    'et-floating-panel',
    'et-color--inherited',
    surface,
    'et-with-default-animation',
    'et-animation-enter-done',
  ];

  const tooltipAttributes = [
    options.attributes,
    'role="tooltip"',
    `class="et-tooltip et-color--inherited ${surface}"`,
    `id="${id}"`,
    hasTemplate && 'data-has-template="true"',
  ].filter(Boolean);

  const body = hasTemplate ? options.content : `<p class="et-tooltip__text">${options.text ?? ''}</p>`;

  return `<div class="et-tooltip-mock-frame"><div class="${paneClasses.join(' ')}" data-overlay-placement="${placement}"><et-tooltip ${tooltipAttributes.join(' ')}><div class="et-tooltip__surface"><div class="et-tooltip__content">${body}</div></div></et-tooltip><div et-floating-arrow class="et-overlay-arrow"></div></div></div>`;
};
