import { interactiveStyles } from '@ethlete/core/design/interactive-styles';
import focusRing from '../src/lib/focus-ring/focus-ring-styles.component.css?inline';
import buttonProperties from '../src/lib/button/button-properties-styles.component.css?inline';
import buttonBase from '../src/lib/button/button.component.css?inline';

export type ButtonMockOptions = {
  /** The label, as HTML. */
  label: string;
  /** The icon, as HTML. Leave it out for a button without one. */
  icon?: string;
  iconAlignment?: 'start' | 'end';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'filled' | 'outline' | 'tonal' | 'transparent';
  /** A color theme name the app registers. Left out, the button takes the color theme around it. */
  color?: string;
  /** Makes the button a toggle: `false` draws it unpressed, left out it is no toggle. */
  pressed?: boolean;
  disabled?: boolean;
  tag?: 'button' | 'a';
  class?: string;
  style?: string;
};

const PRESSED_VARIANT = { filled: 'outline', outline: 'filled', tonal: 'filled', transparent: 'tonal' } as const;

/** The stylesheets `button()` draws with: the real `et-button` CSS. */
export const buttonStyles = `${interactiveStyles}\n${focusRing}\n${buttonProperties}\n${buttonBase}`;

/** Draws `<button et-button>` as HTML, with the DOM and classes the component renders. */
export const button = (options: ButtonMockOptions) => {
  const { label, icon, iconAlignment = 'start', size = 'md', variant = 'filled', tag = 'button' } = options;
  const iconBox = `<div class="et-button-icon">${icon ?? ''}</div>`;

  const classes = [
    'et-surface-interactive',
    'et-color-interactive',
    'et-button',
    'et-focus-ring',
    options.color ? `et-color--${options.color}` : 'et-color--inherited',
    options.class,
  ].filter(Boolean);

  const attributes = [
    `class="${classes.join(' ')}"`,
    tag === 'button' && 'type="button"',
    options.pressed && 'data-pressed="true"',
    options.pressed !== undefined && `aria-pressed="${options.pressed}"`,
    options.disabled && (tag === 'button' ? 'disabled aria-disabled="true"' : 'aria-disabled="true"'),
    `data-icon-alignment="${iconAlignment}"`,
    `data-variant="${variant}"`,
    `data-size="${size}"`,
    options.pressed && `data-pressed-variant="${PRESSED_VARIANT[variant]}"`,
    options.style && `style="${options.style}"`,
  ].filter(Boolean);

  return `<${tag} ${attributes.join(' ')}>${iconAlignment === 'start' ? iconBox : ''}<div class="et-button-contents">${label}</div>${iconAlignment === 'end' ? iconBox : ''}</${tag}>`;
};
