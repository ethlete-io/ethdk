import { Placement } from '@floating-ui/dom';
import overlayContainer from '../src/lib/overlay/overlay-container.component.css?inline';
import overlayMain from '../src/lib/overlay/overlay-main-styles.component.css?inline';
import anchoredDialogStrategy from '../src/lib/overlay/strategies/anchored-dialog-styles.component.css?inline';
import overlayArrow from '../src/lib/overlay/strategies/overlay-arrow-styles.component.css?inline';

export type AnchoredDialogMockOptions = {
  /** The pane's content, as HTML. */
  content: string;
  /** Draws the `et-overlay-arrow` pointing back at the trigger. Defaults to `true`, like `anchoredDialogOverlayStrategy`. */
  arrow?: boolean;
  /** The side the pane opened on, which places the arrow. Defaults to `bottom-end`, the strategy's default. */
  placement?: Placement;
  /** The pane's role. Defaults to `dialog`. */
  role?: 'dialog' | 'alertdialog';
  /** Draws `aria-modal="true"`. Defaults to `true`, as for a modal overlay; `false` for `mode: 'non-modal'`. */
  modal?: boolean;
  /** The id of the element that labels the pane. */
  labelledBy?: string;
  /** An `aria-label` for a pane without a visible title. */
  label?: string;
  /** A surface theme name the app registers. Left out, the pane takes the surface one elevation above its parent. */
  surface?: string;
  /** Extra attributes on the pane, e.g. design markers. */
  attributes?: string;
};

/** The stylesheets `anchoredDialog()` draws with: the real overlay pane, anchored-dialog strategy and arrow CSS. */
export const anchoredDialogStyles = /* @__PURE__ */ [
  overlayContainer,
  overlayMain,
  anchoredDialogStrategy,
  overlayArrow,
  `@layer components {
  .et-anchored-dialog-mock {
    --_et-overlay-arrow-pane-border-width: var(--et-overlay-surface-border-width);
    inline-size: max-content;
    min-inline-size: 288px;
    max-inline-size: 80vw;
  }
  .et-anchored-dialog-mock:is([data-overlay-placement^='top'], [data-overlay-placement^='bottom']) > .et-overlay-arrow {
    left: calc(50% - 10px);
  }
  .et-anchored-dialog-mock:is([data-overlay-placement^='left'], [data-overlay-placement^='right']) > .et-overlay-arrow {
    top: calc(50% - 10px);
  }
  .et-anchored-dialog-mock:is([data-overlay-placement$='-start']):is([data-overlay-placement^='top'], [data-overlay-placement^='bottom']) > .et-overlay-arrow {
    left: 16px;
  }
  .et-anchored-dialog-mock:is([data-overlay-placement$='-end']):is([data-overlay-placement^='top'], [data-overlay-placement^='bottom']) > .et-overlay-arrow {
    left: calc(100% - 36px);
  }
  .et-anchored-dialog-mock:is([data-overlay-placement$='-start']):is([data-overlay-placement^='left'], [data-overlay-placement^='right']) > .et-overlay-arrow {
    top: 16px;
  }
  .et-anchored-dialog-mock:is([data-overlay-placement$='-end']):is([data-overlay-placement^='left'], [data-overlay-placement^='right']) > .et-overlay-arrow {
    top: calc(100% - 36px);
  }
}`,
].join('\n');

/**
 * Draws an open anchored dialog pane (`anchoredDialogOverlayStrategy`) around `content`, as HTML. The pane
 * sits in flow instead of where the overlay runtime would position it, so place it next to the drawn trigger.
 */
export const anchoredDialog = (options: AnchoredDialogMockOptions) => {
  const { placement = 'bottom-end', arrow = true, role = 'dialog', modal = true } = options;
  const classes = [
    'et-overlay',
    'et-overlay-runtime-pane',
    'et-overlay--anchored-dialog',
    'et-anchored-dialog-mock',
    'et-color--inherited',
    options.surface && `et-surface--${options.surface}`,
    'et-with-default-animation',
    'et-animation-enter-done',
  ].filter(Boolean);
  const attributes = [
    options.attributes,
    !options.surface && 'data-et-auto-surface',
    `role="${role}"`,
    modal && 'aria-modal="true"',
    'tabindex="-1"',
    options.labelledBy && `aria-labelledby="${options.labelledBy}"`,
    options.label && `aria-label="${options.label}"`,
    `data-overlay-placement="${placement}"`,
    `class="${classes.join(' ')}"`,
  ].filter(Boolean);
  const arrowMarkup = arrow ? '<div class="et-overlay-arrow" et-floating-arrow></div>' : '';

  return `<et-overlay-container ${attributes.join(' ')}><div>${options.content}</div>${arrowMarkup}</et-overlay-container>`;
};
