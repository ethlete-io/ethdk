import emptyStateBase from '../src/lib/empty-state/empty-state.component.css?inline';
import { FILE_ICON } from '../src/lib/icon/headless/file-icon';
import iconBase from '../src/lib/icon/headless/icon-styles.component.css?inline';
import { TRIANGLE_EXCLAMATION_ICON } from '../src/lib/icon/headless/triangle-exclamation-icon';
import { button, ButtonMockOptions, buttonStyles } from './button';
import { iconMarkup } from './icon';

export type EmptyStateMockOptions = {
  heading?: string;
  description?: string;
  /** The projected `[etIcon]`. Left out, the file icon; `false` draws none. */
  icon?: 'file' | 'triangle' | false;
  /** The label of a projected `et-button etEmptyStateAction`. Left out, no action. */
  action?: string;
  /** The action's button variant. Left out, `filled`, as `et-button` defaults to. */
  actionVariant?: ButtonMockOptions['variant'];
  /** Extra attributes on the action button, e.g. design markers. */
  actionAttributes?: string;
  /** Extra attributes on the empty state, e.g. design markers. */
  attributes?: string;
};

const ICONS = {
  file: FILE_ICON,
  triangle: TRIANGLE_EXCLAMATION_ICON,
} as const;

/** The stylesheets `emptyState()` draws with: the real empty-state, button and icon CSS. */
export const emptyStateStyles = /* @__PURE__ */ [buttonStyles, iconBase, emptyStateBase].join('\n');

/** Draws an `et-empty-state` with its projected icon and action as the component renders it, as HTML. */
export const emptyState = (options: EmptyStateMockOptions) => {
  const icon = options.icon === false ? '' : iconMarkup(ICONS[options.icon ?? 'file']);
  const heading = options.heading ? `<p class="et-empty-state-title">${options.heading}</p>` : '';
  const description = options.description ? `<p class="et-empty-state-description">${options.description}</p>` : '';
  const action = options.action
    ? button({ label: options.action, variant: options.actionVariant }).replace(
        /^<button /,
        `<button ${options.actionAttributes ?? ''} etEmptyStateAction `,
      )
    : '';
  const attributes = [options.attributes, 'class="et-empty-state"'].filter(Boolean);

  return `<et-empty-state ${attributes.join(' ')}>${icon}${heading}${description}${action}</et-empty-state>`;
};
