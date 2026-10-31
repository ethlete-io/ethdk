import iconButtonBase from '../src/lib/button/icon-button.component.css?inline';
import { TIMES_ICON } from '../src/lib/icon/headless/times-icon';
import iconBase from '../src/lib/icon/headless/icon-styles.component.css?inline';
import alertDialogBase from '../src/lib/overlay/alert-dialog/alert-dialog.component.css?inline';
import overlayContainer from '../src/lib/overlay/overlay-container.component.css?inline';
import overlayMain from '../src/lib/overlay/overlay-main-styles.component.css?inline';
import dialogStrategy from '../src/lib/overlay/strategies/dialog-styles.component.css?inline';
import { button, buttonStyles } from './button';
import { iconMarkup } from './icon';

export type DialogMockButton = {
  label: string;
  variant?: 'filled' | 'outline' | 'tonal' | 'transparent';
  /** A color theme name the app registers. Left out, the button takes the dialog's color theme. */
  color?: string;
  /** Extra attributes on the button, e.g. design markers. */
  attributes?: string;
};

export type DialogMockOptions = {
  /** The title, as HTML. */
  title: string;
  /** The body content, as HTML. */
  body: string;
  /** The footer buttons, in order. Leave it out for a dialog without a footer. */
  actions?: DialogMockButton[];
  /** Draws an `et-icon-button` with `etOverlayClose` in the header; the string adds attributes to it. */
  close?: boolean | string;
  /** As the body's `dividers` input. `dynamic` draws the body scrolled to its start. */
  dividers?: false | 'static' | 'dynamic';
  /** A surface theme name the app registers, for the pane. Left out, the pane takes the surface one elevation above its parent. */
  surface?: string;
  /** Extra attributes on the pane, e.g. design markers. */
  attributes?: string;
  /** Unique per frame: the title id derives from it. */
  id?: string;
};

export type AlertDialogMockOptions = {
  kind: 'alert' | 'confirm';
  title: string;
  message?: string;
  /** The confirm button's color theme name, as `confirmColor` sets it. */
  confirmColor?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  acknowledgeLabel?: string;
  /** Extra attributes on the confirm (or acknowledge) button. */
  confirmAttributes?: string;
  /** Extra attributes on the cancel button. */
  cancelAttributes?: string;
  /** A surface theme name the app registers, for the pane. Left out, the pane takes the surface one elevation above its parent. */
  surface?: string;
  attributes?: string;
  id?: string;
};

/** The stylesheets `dialog()` and `alertDialog()` draw with: the real overlay pane, dialog, button and icon button CSS. */
export const dialogStyles = /* @__PURE__ */ [
  buttonStyles,
  iconBase,
  iconButtonBase,
  overlayContainer,
  overlayMain,
  dialogStrategy,
  alertDialogBase,
  `@layer components {
  .et-dialog-mock-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.2rem;
  }
  .et-dialog-mock-title {
    margin: 0;
    font-size: 1.8rem;
    font-weight: 600;
  }
  .et-dialog-mock-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 0.8rem;
  }
  .et-dialog-mock-scene {
    position: relative;
    display: grid;
    place-items: center;
    padding: 4rem 2.4rem;
  }
  .et-dialog-mock-scene > .et-overlay-runtime-backdrop {
    position: absolute;
    inset: 0;
  }
}`,
].join('\n');

const footerButton = (action: DialogMockButton) => {
  const markup = button({ label: action.label, variant: action.variant ?? 'filled', color: action.color, size: 'md' });

  return action.attributes ? markup.replace(/^<button /, `<button ${action.attributes} `) : markup;
};

const closeButton = (attributes?: string) => {
  const classes = [
    'et-surface-interactive',
    'et-color-interactive',
    'et-icon-button',
    'et-focus-ring',
    'et-color--inherited',
  ];

  return `<button ${attributes ?? ''} etOverlayClose type="button" aria-label="Close" class="${classes.join(' ')}" data-variant="transparent" data-size="sm"><div class="et-icon-button-icon">${iconMarkup(TIMES_ICON)}</div></button>`;
};

const pane = (
  options: { surface?: string; attributes?: string; role: string; labelledBy: string; describedBy?: string },
  content: string,
) => {
  const classes = [
    'et-overlay',
    'et-overlay-runtime-pane',
    'et-overlay--dialog',
    'et-color--inherited',
    options.surface && `et-surface--${options.surface}`,
    'et-with-default-animation',
    'et-animation-enter-done',
  ].filter(Boolean);
  const attributes = [
    options.attributes,
    !options.surface && 'data-et-auto-surface',
    `role="${options.role}"`,
    'aria-modal="true"',
    'tabindex="-1"',
    `aria-labelledby="${options.labelledBy}"`,
    options.describedBy && `aria-describedby="${options.describedBy}"`,
    `class="${classes.join(' ')}"`,
  ].filter(Boolean);

  return `<et-overlay-container ${attributes.join(' ')}>${content}</et-overlay-container>`;
};

const body = (content: string, dividers: DialogMockOptions['dividers'] = false) => {
  const classes = [
    'et-overlay-body',
    dividers && 'et-overlay-body--render-dividers',
    dividers === 'dynamic' && 'et-overlay-body--dynamic-dividers',
    dividers === 'dynamic' && 'et-scrollable-body--can-scroll',
    dividers === 'dynamic' && 'et-scrollable-body--is-at-start',
  ].filter(Boolean);

  return `<div class="${classes.join(' ')}"><div class="et-overlay-body-container"><div class="et-overlay-body-start-element"></div>${content}<div class="et-overlay-body-end-element"></div></div></div>`;
};

/**
 * Draws an open dialog pane (`dialogOverlayStrategy`) with an `et-overlay-main` of header, body and
 * footer, as HTML. The pane sits in flow; wrap it in `overlayBackdrop()` to draw the scrim.
 */
export const dialog = (options: DialogMockOptions) => {
  const titleId = `et-overlay-title-${options.id ?? 'dialog'}`;
  const close = options.close ? closeButton(typeof options.close === 'string' ? options.close : undefined) : '';
  const header = `<div class="et-overlay-header et-dialog-mock-header"><h2 class="et-dialog-mock-title" id="${titleId}" et-overlay-title>${options.title}</h2>${close}</div>`;
  const footer = options.actions
    ? `<div class="et-overlay-footer et-dialog-mock-actions">${options.actions.map(footerButton).join('')}</div>`
    : '';

  return pane(
    { surface: options.surface, attributes: options.attributes, role: 'dialog', labelledBy: titleId },
    `<et-overlay-main class="et-overlay-main">${header}${body(options.body, options.dividers)}${footer}</et-overlay-main>`,
  );
};

/** Draws the open `et-alert-dialog` from `injectAlertDialog()` in its dialog pane, as HTML. */
export const alertDialog = (options: AlertDialogMockOptions) => {
  const id = options.id ?? 'alert';
  const titleId = `et-overlay-title-${id}`;
  const messageId = `et-alert-dialog-message-${id}`;
  const actions =
    options.kind === 'confirm'
      ? [
          footerButton({
            label: options.cancelLabel ?? 'Cancel',
            variant: 'outline',
            attributes: ['data-et-alert-dialog-initial-focus', options.cancelAttributes].filter(Boolean).join(' '),
          }),
          footerButton({
            label: options.confirmLabel ?? 'Confirm',
            color: options.confirmColor,
            attributes: options.confirmAttributes,
          }),
        ]
      : [
          footerButton({
            label: options.acknowledgeLabel ?? 'OK',
            attributes: ['data-et-alert-dialog-initial-focus', options.confirmAttributes].filter(Boolean).join(' '),
          }),
        ];
  const message = options.message
    ? body(`<p id="${messageId}" class="et-alert-dialog-message">${options.message}</p>`)
    : '';

  return pane(
    {
      surface: options.surface,
      attributes: options.attributes,
      role: 'alertdialog',
      labelledBy: titleId,
      describedBy: options.message ? messageId : undefined,
    },
    `<et-alert-dialog class="et-alert-dialog et-overlay-main" data-kind="${options.kind}"><div class="et-overlay-header"><h2 class="et-alert-dialog-title" id="${titleId}" et-overlay-title>${options.title}</h2></div>${message}<div class="et-alert-dialog-actions et-overlay-footer">${actions.join('')}</div></et-alert-dialog>`,
  );
};

/** Draws the visible `et-overlay-runtime-backdrop` behind `content`, both in flow. */
export const overlayBackdrop = (content: string) =>
  `<div class="et-dialog-mock-scene"><div class="et-overlay-runtime-backdrop et-overlay-backdrop--visible"></div>${content}</div>`;
