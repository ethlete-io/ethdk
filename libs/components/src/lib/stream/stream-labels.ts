import { createLabels } from '@ethlete/core';

/**
 * Every string the stream player's own chrome renders: the consent gate, the failure overlay, the
 * picture-in-picture placeholder and the PiP window's controls.
 *
 * These used to live on the `StreamConsentConfig` / `StreamPlayerErrorConfig` /
 * `PipSlotPlaceholderConfig` objects next to a `transformer(text, locale)` hook, which asked an app to
 * translate *by matching the English string*. They are labels, so they live where every other label in
 * this library lives; those configs keep only what is genuinely configuration (the button colors).
 */
export type StreamLabels = {
  /** Announced by the loading overlay while a player is starting up. */
  loading: string;

  /** The consent gate's heading. */
  consentHeading: string;
  /** The consent gate's explanation. */
  consentDescription: string;
  /** The consent gate's accept button. */
  consentAccept: string;

  /** The failure overlay's heading. */
  errorHeading: string;
  /** The failure overlay's explanation. */
  errorDescription: string;
  /** The failure overlay's retry button. */
  errorRetry: string;

  /** The placeholder shown where a player would be while it plays in picture-in-picture. */
  pipPlaceholderMessage: string;
  /** The placeholder's button that pulls the stream back into the page. */
  pipPlaceholderBack: string;
  /** Accessible label for the PiP window's close button. */
  pipClose: string;
  /** Accessible label for the PiP window's control that focuses the stream's page. */
  pipFocus: string;
};

/** The built-in English labels. */
export const DEFAULT_STREAM_LABELS: StreamLabels = {
  loading: 'Loading',

  consentHeading: 'Content blocked',
  consentDescription: 'Playback requires your consent. Third-party cookies and data may be used.',
  consentAccept: 'Allow and play',

  errorHeading: 'Playback failed',
  errorDescription: 'The player could not be loaded. Please check your connection or try again.',
  errorRetry: 'Retry',

  pipPlaceholderMessage: 'Playing in picture-in-picture',
  pipPlaceholderBack: 'Back to player',
  pipClose: 'Close',
  pipFocus: 'Focus',
};

/**
 * Localize the stream chrome's strings for everything below this injector, and read the set in effect
 * here as a signal. Partial — whatever you leave out keeps its {@link DEFAULT_STREAM_LABELS} value. See
 * {@link createLabels} for the shape, which every domain in this library shares.
 *
 * @example
 * provideStreamLabels({
 *   consentHeading: 'Inhalt blockiert',
 *   consentAccept: 'Erlauben und abspielen',
 * });
 */
export const [provideStreamLabels, injectStreamLabels, STREAM_LABELS] = createLabels<StreamLabels>(
  'STREAM_LABELS',
  DEFAULT_STREAM_LABELS,
);
