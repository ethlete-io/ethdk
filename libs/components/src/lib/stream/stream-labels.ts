import { defineLabels, toInjectFn, toProvideFn, toToken } from '@ethlete/core';

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
  /**
   * `title` for an embedded player's iframe, given the platform's own name - announced in place of the
   * frame's contents. The brand name is not translated; the wording around it is.
   */
  playerFrame: (platform: string) => string;

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
  /** Accessible label for the PiP window's title bar, which the arrow keys move and Shift+arrow keys resize. */
  pipMove: string;
  /** Accessible label and tooltip for the PiP window's toggle that switches to the grid of all streams. */
  pipGridView: string;
  /** Accessible label and tooltip for the PiP window's toggle that switches back to one stream. */
  pipSingleView: string;
};

/** The built-in English labels. */
export const DEFAULT_STREAM_LABELS: StreamLabels = {
  loading: 'Loading',
  playerFrame: (platform) => `${platform} player`,

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
  pipMove: 'Picture-in-picture window, move it with the arrow keys and resize it with Shift and the arrow keys',
  pipGridView: 'Grid view',
  pipSingleView: 'Single view',
};

/** The built-in German labels, used when the current locale is a German one. */
export const GERMAN_STREAM_LABELS: StreamLabels = {
  loading: 'Lädt',
  playerFrame: (platform) => `${platform}-Player`,
  consentHeading: 'Inhalt blockiert',
  consentDescription:
    'Die Wiedergabe erfordert eine Zustimmung. Cookies und Daten von Drittanbietern können verwendet werden.',
  consentAccept: 'Erlauben und abspielen',
  errorHeading: 'Wiedergabe fehlgeschlagen',
  errorDescription: 'Der Player konnte nicht geladen werden. Bitte Verbindung prüfen oder erneut versuchen.',
  errorRetry: 'Erneut versuchen',
  pipPlaceholderMessage: 'Wird im Bild-in-Bild wiedergegeben',
  pipPlaceholderBack: 'Zurück zum Player',
  pipClose: 'Schließen',
  pipFocus: 'Fokussieren',
  pipMove:
    'Bild-in-Bild-Fenster, mit den Pfeiltasten verschieben und mit Umschalt und den Pfeiltasten in der Größe ändern',
  pipGridView: 'Rasteransicht',
  pipSingleView: 'Einzelansicht',
};

/** The label set for a locale. Anything other than English and German needs {@link provideStreamLabels}. */
export const streamLabelsForLocale = (locale: string): StreamLabels =>
  locale.toLowerCase().startsWith('de') ? GERMAN_STREAM_LABELS : DEFAULT_STREAM_LABELS;

const STREAM_LABELS_DEF = /* @__PURE__ */ defineLabels<StreamLabels>('STREAM_LABELS', streamLabelsForLocale);

/**
 * Localize the stream chrome's strings for everything below this injector, and read the set in effect
 * here as a signal. Partial - whatever you leave out keeps its {@link DEFAULT_STREAM_LABELS} value. See
 * {@link defineLabels} for the shape, which every domain in this library shares.
 *
 * @example
 * provideStreamLabels({
 *   consentHeading: 'Inhalt blockiert',
 *   consentAccept: 'Erlauben und abspielen',
 * });
 */
export const provideStreamLabels = /* @__PURE__ */ toProvideFn(STREAM_LABELS_DEF);
export const injectStreamLabels = /* @__PURE__ */ toInjectFn(STREAM_LABELS_DEF);
export const STREAM_LABELS = /* @__PURE__ */ toToken(STREAM_LABELS_DEF);
