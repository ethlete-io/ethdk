import { InjectionToken } from '@angular/core';

/**
 * Provide `false` from a widget that owns the tab order around its chips (a select trigger, a tag
 * input) to keep every chip remove control inside it out of the tab order. Defaults to `true`, so a
 * standalone chip is removable with the keyboard.
 */
export const CHIP_REMOVE_TAB_STOP = new InjectionToken<boolean>('CHIP_REMOVE_TAB_STOP');

/**
 * Provide from a widget that hosts chips (a tag input, a select trigger) to receive focus when a chip
 * removed from the keyboard has no focusable neighbour chip to hand it to.
 */
export const CHIP_REMOVE_FOCUS_FALLBACK = new InjectionToken<() => void>('CHIP_REMOVE_FOCUS_FALLBACK');
