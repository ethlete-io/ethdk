import { TRIANGLE_EXCLAMATION_ICON } from '../src/lib/icon/headless/triangle-exclamation-icon';
import queryErrorBase from '../src/lib/query-error/query-error.component.css?inline';
import { bannerStyles } from './banner';
import { button } from './button';
import { iconMarkup } from './icon';

export type QueryErrorMockOptions = {
  /** The HTTP status, drawn as the host's `data-status`. */
  status: number;
  title: string;
  /** One message draws a paragraph; more than one, or `list`, a violation list. */
  messages: string[];
  list?: boolean;
  /** Draws the default retry button with this label. Left out, no retry button. */
  retry?: string;
  /** Extra attributes on the retry button, e.g. design markers. */
  retryAttributes?: string;
  /** The projected `etQueryErrorActions` HTML. Replaces the retry button. */
  actions?: string;
  /** The color theme name the banner forces: the `color` input, else the app's `type: 'error'` theme. */
  color: string;
  /** Extra attributes on the host, e.g. a style or design markers. */
  attributes?: string;
};

/** The stylesheets `queryError()` draws with: the real banner, button, icon and query-error CSS. */
export const queryErrorStyles = /* @__PURE__ */ [bannerStyles, queryErrorBase].join('\n');

/**
 * Draws `<et-query-error>` as HTML: the error banner with its icon, the title, the message or violation list, and
 * the retry button or the projected actions.
 */
export const queryError = (options: QueryErrorMockOptions) => {
  const isList = options.list ?? options.messages.length > 1;
  const body = isList
    ? `<ul class="et-query-error-list" etBannerBody>${options.messages
        .map((message) => `<li class="et-query-error-list-item">${message}</li>`)
        .join('')}</ul>`
    : `<p class="et-query-error-message" etBannerBody>${options.messages[0] ?? ''}</p>`;
  const retry =
    options.retry === undefined
      ? ''
      : button({ label: options.retry }).replace('<button ', `<button ${options.retryAttributes ?? ''} `);
  const actionsContent = options.actions ?? retry;
  const actions = actionsContent ? `<div class="et-query-error-actions" etBannerAction>${actionsContent}</div>` : '';
  const host = [
    options.attributes,
    'class="et-query-error-host et-query-error"',
    'role="alert"',
    `data-status="${options.status}"`,
    isList ? 'data-list=""' : '',
  ].filter(Boolean);

  return (
    `<et-query-error ${host.join(' ')}>` +
    `<et-banner class="et-color--${options.color} et-banner" data-type="error">${iconMarkup(TRIANGLE_EXCLAMATION_ICON)}` +
    `<div class="et-banner-content"><h3 class="et-query-error-title" etBannerHeading>${options.title}</h3>${body}${actions}</div>` +
    `</et-banner></et-query-error>`
  );
};
