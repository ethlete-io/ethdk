import { Signal, computed, effect } from '@angular/core';
import { injectDateTimeZone } from '../date-time-formats';
import { isValidTimeZone, timeZoneDisplayName } from './time-zone';

let localReadingIdCounter = 0;

/**
 * `timeZone`, or the `provideDateTimeZone()` zone while it is `undefined`, when `Intl` knows it, else
 * `null`; warns in dev mode on a name it does not know. Call in an injection context.
 */
export const effectiveTimeZoneOf = (timeZone: Signal<string | null | undefined>, selector: string) => {
  const appTimeZone = injectDateTimeZone();
  const requested = computed(() => {
    const zone = timeZone();

    return zone === undefined ? appTimeZone : zone;
  });

  if (ngDevMode) {
    effect(() => {
      const zone = requested();

      if (zone !== null && !isValidTimeZone(zone)) {
        console.warn(`[${selector}] timeZone "${zone}" is not an IANA zone name, so it is ignored.`);
      }
    });
  }

  return computed(() => {
    const zone = requested();

    return zone !== null && isValidTimeZone(zone) ? zone : null;
  });
};

export const timeZoneLabelOf = (timeZone: Signal<string | null>, timeZoneLabel: Signal<string | null>) =>
  computed(() => {
    const zone = timeZone();

    return zone === null ? null : (timeZoneLabel() ?? timeZoneDisplayName(zone));
  });

export const nextLocalReadingElementId = (selector: string) => `${selector}-local-reading-${localReadingIdCounter++}`;
