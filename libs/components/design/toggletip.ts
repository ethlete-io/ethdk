import { Placement } from '@floating-ui/dom';
import overlayContainer from '../src/lib/overlay/overlay-container.component.css?inline';
import floatingTip from '../src/lib/overlay/floating-tip-styles.component.css?inline';
import overlayArrow from '../src/lib/overlay/strategies/overlay-arrow-styles.component.css?inline';
import toggletipBase from '../src/lib/toggletip/toggletip.component.css?inline';

export type ToggletipMockOptions = {
  /** The toggletip text, as HTML. Drawn like a string `etToggletip`. */
  text?: string;
  /** Template content, as HTML. Drawn like a `TemplateRef` `etToggletip`; wins over `text`. */
  content?: string;
  /** The side the pane opened on; the arrow points back at the trigger. Defaults to `top`, as `etToggletip` does. */
  placement?: Placement;
  /** A surface theme name the app registers. Left out, the pane takes the surface one elevation above its parent. */
  surface?: string;
  /**
   * A CSS selector of the drawn trigger. The design frame places the pane and aims the arrow at its centre on whole
   * pixels, as the overlay runtime does.
   */
  anchor?: string;
  /** The accessible name of the dialog, as `etToggletipAriaLabel` sets it. */
  ariaLabel?: string;
};

/** The stylesheets `toggletip()` draws with: the real `et-toggletip`, floating tip, overlay pane and arrow CSS. */
export const toggletipStyles = /* @__PURE__ */ [
  overlayContainer,
  overlayArrow,
  floatingTip,
  toggletipBase,
  `@layer components.sdk {
  .et-toggletip-mock-pane {
    --_et-overlay-arrow-pane-border-width: 1px;
    inline-size: calc-size(max-content, round(up, size, 1px));
    block-size: calc-size(auto, round(up, size, 1px));
    transform: translate3d(0, 0, 0);
  }
  .et-toggletip-mock-pane:is([data-overlay-placement^='top'], [data-overlay-placement^='bottom']) > .et-overlay-arrow {
    left: calc(round(down, 50%, 1px) - 10px);
  }
  .et-toggletip-mock-pane:is([data-overlay-placement^='left'], [data-overlay-placement^='right']) > .et-overlay-arrow {
    top: calc(round(down, 50%, 1px) - 10px);
  }
  .et-toggletip-mock-pane:is([data-overlay-placement^='top-start'], [data-overlay-placement^='bottom-start']) > .et-overlay-arrow {
    left: 20px;
  }
  .et-toggletip-mock-pane:is([data-overlay-placement^='top-end'], [data-overlay-placement^='bottom-end']) > .et-overlay-arrow {
    left: calc(100% - 40px);
  }
  .et-toggletip-mock-pane:is([data-overlay-placement^='left-start'], [data-overlay-placement^='right-start']) > .et-overlay-arrow {
    top: 20px;
  }
  .et-toggletip-mock-pane:is([data-overlay-placement^='left-end'], [data-overlay-placement^='right-end']) > .et-overlay-arrow {
    top: calc(100% - 40px);
  }
}`,
].join('\n');

/**
 * Draws an open `et-toggletip` in its overlay pane, with the arrow, as HTML. The pane sits in flow, so place it next to
 * the drawn trigger.
 */
export const toggletip = (options: ToggletipMockOptions = {}) => {
  const { placement = 'top' } = options;
  const surface = options.surface && `et-surface--${options.surface}`;

  const paneClasses = [
    'et-overlay',
    'et-overlay-runtime-pane',
    'et-toggletip-panel',
    'et-overlay--toggletip',
    'et-floating-panel',
    'et-color--inherited',
    surface,
    'et-with-default-animation',
    'et-animation-enter-done',
    'et-toggletip-mock-pane',
  ].filter(Boolean);

  const anchorAttribute = options.anchor ? ` data-et-arrow-anchor="${options.anchor.replaceAll('"', '&quot;')}"` : '';
  const labelAttribute = options.ariaLabel ? ` aria-label="${options.ariaLabel.replaceAll('"', '&quot;')}"` : '';
  const body = options.content ?? `<p class="et-toggletip__text">${options.text ?? ''}</p>`;

  return `<div class="${paneClasses.join(' ')}" data-overlay-placement="${placement}"${anchorAttribute}${surface ? '' : ' data-et-auto-surface'}><et-toggletip class="et-toggletip et-color--inherited ${surface ?? 'et-surface--inherited'}" role="dialog"${labelAttribute}><div class="et-toggletip__surface"><div class="et-toggletip__content">${body}</div></div></et-toggletip><div et-floating-arrow class="et-overlay-arrow"></div></div>`;
};
