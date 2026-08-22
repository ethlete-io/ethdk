import { InjectionToken } from '@angular/core';

/**
 * Provide `false` from a widget that owns the tab order around its chips (a select trigger, a tag
 * input) to keep every chip remove control inside it out of the tab order. Defaults to `true`, so a
 * standalone chip is removable with the keyboard.
 */
export const CHIP_REMOVE_TAB_STOP = new InjectionToken<boolean>('CHIP_REMOVE_TAB_STOP');
