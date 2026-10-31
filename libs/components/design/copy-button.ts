import iconButtonBase from '../src/lib/button/icon-button.component.css?inline';
import textButtonBase from '../src/lib/button/text-button.component.css?inline';
import { CHECK_ICON } from '../src/lib/icon/headless/check-icon';
import { CLIPBOARD_CHECK_ICON } from '../src/lib/icon/headless/clipboard-check-icon';
import iconBase from '../src/lib/icon/headless/icon-styles.component.css?inline';
import { buttonStyles } from './button';
import { iconMarkup } from './icon';

export type CopyButtonMockOptions = {
  /** `icon` composes `etCopyButton` with `et-icon-button`, `text` with `et-text-button`. */
  kind: 'icon' | 'text';
  /** The outcome of the last copy, while `copied()` or `copyFailed()` holds. Left out, idle. */
  outcome?: 'copied' | 'failed';
  /** The icon button's variant. Left out, `transparent`, as `et-icon-button` defaults to. */
  variant?: 'filled' | 'outline' | 'tonal' | 'transparent';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  disabled?: boolean;
  /** Extra attributes on the button, e.g. design markers. */
  attributes?: string;
};

/** The stylesheets `copyButton()` draws with: the real icon-button, text-button, button and icon CSS. */
export const copyButtonStyles = /* @__PURE__ */ [buttonStyles, iconBase, iconButtonBase, textButtonBase].join('\n');

/**
 * Draws a `<button etCopyButton>` composed as the copy-button docs show it - an `et-icon-button` swapping the
 * clipboard icon for a check, or an `et-text-button` swapping `Copy` for `Copied!`, as HTML. The
 * directive's visually hidden live region is left out.
 */
export const copyButton = (options: CopyButtonMockOptions) => {
  const { kind, outcome, size = 'md' } = options;
  const copied = outcome === 'copied';

  const classes =
    kind === 'icon'
      ? ['et-icon-button', 'et-color-interactive', 'et-focus-ring', 'et-color--inherited']
      : ['et-text-button', 'et-color-interactive', 'et-focus-ring', 'et-color--inherited'];

  const attributes = [
    options.attributes,
    `class="${classes.join(' ')}"`,
    'type="button"',
    kind === 'icon' && 'aria-label="Copy the install command"',
    'etCopyButton',
    options.disabled && 'disabled aria-disabled="true"',
    kind === 'icon' && `data-variant="${options.variant ?? 'transparent'}"`,
    kind === 'text' && 'data-icon-alignment="start"',
    `data-size="${size}"`,
    copied && 'data-copied="true"',
    outcome === 'failed' && 'data-copy-failed="true"',
  ].filter(Boolean);

  const contents =
    kind === 'icon'
      ? `<div class="et-icon-button-icon">${iconMarkup(copied ? CHECK_ICON : CLIPBOARD_CHECK_ICON)}</div>`
      : `<div class="et-text-button-icon"></div><div class="et-text-button-contents">${copied ? 'Copied!' : 'Copy'}</div>`;

  return `<button ${attributes.join(' ')}>${contents}</button>`;
};
