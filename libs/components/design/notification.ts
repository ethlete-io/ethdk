import iconButtonBase from '../src/lib/button/icon-button.component.css?inline';
import textButtonBase from '../src/lib/button/text-button.component.css?inline';
import { CIRCLE_CHECK_ICON } from '../src/lib/icon/headless/circle-check-icon';
import { CIRCLE_INFO_ICON } from '../src/lib/icon/headless/circle-info-icon';
import iconBase from '../src/lib/icon/headless/icon-styles.component.css?inline';
import { TIMES_ICON } from '../src/lib/icon/headless/times-icon';
import { TRIANGLE_EXCLAMATION_ICON } from '../src/lib/icon/headless/triangle-exclamation-icon';
import spinnerBase from '../src/lib/loader/spinner/spinner-styles.component.css?inline';
import notificationBase from '../src/lib/notification/notification.component.css?inline';
import { buttonStyles } from './button';
import { iconMarkup } from './icon';

export type NotificationMockAction = {
  label: string;
  /** Extra attributes on the action button, e.g. design markers. */
  attributes?: string;
};

export type NotificationMockOptions = {
  status: 'success' | 'error' | 'info' | 'loading';
  title: string;
  message?: string;
  /** The `action` of the notification config. */
  action?: NotificationMockAction;
  /** The `secondaryAction` of the notification config. */
  secondaryAction?: NotificationMockAction;
  /**
   * The color theme name the manager resolves for the status (`statusColorMapping`, else the semantic theme of
   * its type). Left out, the notification takes the color theme around it.
   */
  color?: string;
  /** A surface theme name the app registers. Left out, the notification inherits it. */
  surface?: string;
  /** Extra attributes on the dismiss button, e.g. design markers. */
  dismissAttributes?: string;
  /** Extra attributes on the notification, e.g. design markers. */
  attributes?: string;
};

const STATUS_ICONS = {
  success: CIRCLE_CHECK_ICON,
  error: TRIANGLE_EXCLAMATION_ICON,
  info: CIRCLE_INFO_ICON,
  loading: null,
} as const;

/** The stylesheets `notification()` draws with: the real notification, icon button, text button, spinner and icon CSS. */
export const notificationStyles = /* @__PURE__ */ [
  buttonStyles,
  iconBase,
  iconButtonBase,
  textButtonBase,
  spinnerBase,
  notificationBase,
  `@layer components {
  .et-notification-mock-stack {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: var(--et-notification-stack-gap, 0.5rem);
  }
  .et-notification-mock-spinner {
    --et-spinner-size: 16px;
    --et-spinner-stroke-width: 2px;
  }
  .et-notification-mock-spinner circle {
    stroke-dasharray: 18.85px;
    stroke-dashoffset: 9.42px;
    stroke-width: 12.5%;
  }
}`,
].join('\n');

const spinner = () => {
  const circle = `<svg viewBox="0 0 8 8" class="et-spinner-circle-graphic" xmlns="http://www.w3.org/2000/svg" focusable="false"><circle r="3" cx="50%" cy="50%"></circle></svg>`;

  return `<et-spinner data-et-skip="CLIPPED" class="et-notification-spinner et-notification-mock-spinner et-color--inherited et-spinner" role="progressbar" aria-label="Loading"><div class="et-spinner-indeterminate"><div class="et-spinner-indeterminate-container" aria-hidden="true"><div class="et-spinner-layer"><div class="et-spinner-circle-clipper et-spinner-circle-left">${circle}</div><div class="et-spinner-gap-patch">${circle}</div><div class="et-spinner-circle-clipper et-spinner-circle-right">${circle}</div></div></div></div></et-spinner>`;
};

const dismissButton = (color: string | undefined, attributes?: string) => {
  const classes = [
    'et-notification-dismiss-btn',
    'et-surface-interactive',
    'et-color-interactive',
    'et-icon-button',
    'et-focus-ring',
    `et-color--${color ?? 'inherited'}`,
  ];

  return `<button ${attributes ?? ''} etNotificationDismiss type="button" aria-label="Dismiss" class="${classes.join(' ')}" data-variant="transparent" data-size="xs"><div class="et-icon-button-icon">${iconMarkup(TIMES_ICON)}</div></button>`;
};

const actionButton = (action: NotificationMockAction, slot: 'primary' | 'secondary') => {
  const classes = [
    slot === 'secondary' && 'et-notification-secondary-action',
    'et-text-button',
    'et-color-interactive',
    'et-focus-ring',
    'et-color--inherited',
  ].filter(Boolean);
  const slotAttribute = slot === 'secondary' ? 'etNotificationAction="secondary"' : 'etNotificationAction';

  return `<button ${action.attributes ?? ''} ${slotAttribute} type="button" class="${classes.join(' ')}" data-icon-alignment="start" data-size="xs"><div class="et-text-button-contents">${action.label}</div></button>`;
};

/** Draws an `et-notification` as the notification stack renders it, entered and at rest, as HTML. */
export const notification = (options: NotificationMockOptions) => {
  const icon = STATUS_ICONS[options.status];
  const glyph = icon ? iconMarkup(icon, 'et-notification-icon') : options.status === 'loading' ? spinner() : '';
  const header = `<div class="et-notification-header">${glyph}<span class="et-notification-title">${options.title}</span>${dismissButton(options.color, options.dismissAttributes)}</div>`;
  const message = options.message ? `<p class="et-notification-message">${options.message}</p>` : '';
  const actions = [
    options.action && actionButton(options.action, 'primary'),
    options.secondaryAction && actionButton(options.secondaryAction, 'secondary'),
  ].filter(Boolean);
  const footer = actions.length ? `<div class="et-notification-footer">${actions.join('')}</div>` : '';
  const classes = [
    'et-notification',
    `et-color--${options.color ?? 'inherited'}`,
    `et-surface--${options.surface ?? 'inherited'}`,
    'et-animation-enter-done',
  ];

  return `<et-notification ${options.attributes ?? ''} class="${classes.join(' ')}"><div class="et-notification-content">${header}${message}${footer}</div></et-notification>`;
};

/** Draws notifications in the stack's column and gap, in flow instead of fixed to the viewport. */
export const notificationStack = (notifications: string[]) =>
  `<div class="et-notification-stack et-notification-mock-stack">${notifications.join('')}</div>`;
