import iconBase from '../src/lib/icon/headless/icon-styles.component.css?inline';
import { ARROW_OUT_UP_RIGHT_ICON } from '../src/lib/icon/headless/arrow-out-up-right-icon';
import { IconDefinition } from '../src/lib/icon/headless/icon-definition';
import { LOCK_ICON } from '../src/lib/icon/headless/lock-icon';
import { TRIANGLE_EXCLAMATION_ICON } from '../src/lib/icon/headless/triangle-exclamation-icon';
import consentBase from '../src/lib/stream/consent/stream-consent.component.css?inline';
import errorBase from '../src/lib/stream/error/stream-player-error.component.css?inline';
import loadingBase from '../src/lib/stream/loading/stream-player-loading.component.css?inline';
import placeholderBase from '../src/lib/stream/pip/pip-slot-placeholder.component.css?inline';
import overlayCardBase from '../src/lib/stream/stream-overlay-card-styles.component.css?inline';
import slotBase from '../src/lib/stream/stream-player-slot-styles.component.css?inline';
import { button, buttonStyles } from './button';
import { iconMarkup } from './icon';
import { loaderStyles, spinner } from './loader';

export type StreamMockState = 'player' | 'loading' | 'consent' | 'error' | 'pip-placeholder';

export type StreamMockOptions = {
  /** What the slot shows: the bare player, or one of the overlays the slot mounts over it. */
  state: StreamMockState;
  /** The player element, as HTML. The consent state draws no player, as the slot holds it back until consent. */
  player?: string;
  /** A color theme name the app registers, for the overlay button. Left out, the button takes the color theme around it. */
  buttonColor?: string;
  /** Extra attributes on the overlay button, e.g. design markers. */
  buttonAttributes?: string;
  /** Extra attributes on the slot host, e.g. a style or design markers. */
  attributes?: string;
};

/** The stylesheets `streamPlayerSlot()` draws with: the real slot, overlay card, consent, error, loading, PiP placeholder, spinner, button and icon CSS. */
export const streamStyles = /* @__PURE__ */ [
  buttonStyles,
  iconBase,
  loaderStyles,
  slotBase,
  overlayCardBase,
  consentBase,
  errorBase,
  loadingBase,
  placeholderBase,
].join('\n');

const LABELS = {
  loading: 'Loading',
  consentHeading: 'Content blocked',
  consentDescription: 'Playback requires your consent. Third-party cookies and data may be used.',
  consentAccept: 'Allow and play',
  errorHeading: 'Playback failed',
  errorDescription: 'The player could not be loaded. Please check your connection or try again.',
  errorRetry: 'Retry',
  pipPlaceholderMessage: 'Playing in picture-in-picture',
  pipPlaceholderBack: 'Back to player',
} as const;

const icon = (definition: IconDefinition, className: string) =>
  iconMarkup(definition, className)
    .replace(/^<i /, '<span ')
    .replace(/<\/i>$/, '</span>');

const overlayButton = (label: string, options: StreamMockOptions) =>
  button({ label, color: options.buttonColor }).replace('<button ', `<button ${options.buttonAttributes ?? ''} `);

const consent = (options: StreamMockOptions) =>
  `<et-stream-consent class="et-stream-consent" role="group" aria-labelledby="et-stream-consent-heading-0"><div class="et-stream-consent-card">${icon(LOCK_ICON, 'et-stream-consent-icon')}<p id="et-stream-consent-heading-0" class="et-stream-consent-heading">${LABELS.consentHeading}</p><p class="et-stream-consent-description">${LABELS.consentDescription}</p>${overlayButton(LABELS.consentAccept, options)}</div></et-stream-consent>`;

const loading = () =>
  `<et-stream-player-loading class="et-stream-player-loading" role="status" aria-label="${LABELS.loading}">${spinner({ diameter: 35, strokeWidth: 2, track: true })}</et-stream-player-loading>`;

const error = (options: StreamMockOptions) =>
  `<et-stream-player-error class="et-stream-player-error" role="alert"><div class="et-stream-player-error-card">${icon(TRIANGLE_EXCLAMATION_ICON, 'et-stream-player-error-icon')}<p class="et-stream-player-error-heading">${LABELS.errorHeading}</p><p class="et-stream-player-error-description">${LABELS.errorDescription}</p>${overlayButton(LABELS.errorRetry, options)}</div></et-stream-player-error>`;

const pipPlaceholder = (options: StreamMockOptions) =>
  `<et-pip-slot-placeholder><div class="et-pip-slot-placeholder-overlay"><div class="et-pip-slot-placeholder-card">${icon(ARROW_OUT_UP_RIGHT_ICON, 'et-pip-slot-placeholder-icon')}<p class="et-pip-slot-placeholder-message">${LABELS.pipPlaceholderMessage}</p>${overlayButton(LABELS.pipPlaceholderBack, options)}</div></div></et-pip-slot-placeholder>`;

const OVERLAY = {
  player: () => '',
  loading,
  consent,
  error,
  'pip-placeholder': pipPlaceholder,
} as const satisfies Record<StreamMockState, (options: StreamMockOptions) => string>;

/**
 * Draws an `etStreamPlayerSlot` host as HTML: the player element and the overlay the slot mounts for the state,
 * with the default labels. The loading spinner is held at one frame.
 */
export const streamPlayerSlot = (options: StreamMockOptions) => {
  const player = options.state === 'consent' || options.state === 'pip-placeholder' ? '' : (options.player ?? '');

  return `<div class="et-stream-player-slot" ${options.attributes ?? ''}>${player}${OVERLAY[options.state](options)}</div>`;
};
