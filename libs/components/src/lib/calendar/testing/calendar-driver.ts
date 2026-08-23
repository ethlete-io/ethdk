import { ComponentFixture } from '@angular/core/testing';
import { query, queryAll } from '../../testing/driver-core';

/** The day/month/year grid the active view renders - `[role="grid"]` in every calendar view. */
export const grid = (fixture: ComponentFixture<unknown>) => query<HTMLElement>(fixture, '[role="grid"]')!;

/** Every cell the active view renders, in document order. */
export const cells = (fixture: ComponentFixture<unknown>) => queryAll<HTMLButtonElement>(fixture, '[etcalendarcell]');

/**
 * The cell labelled `label` - preferring the one inside the active month over an outside-month
 * duplicate of the same day number.
 */
export const cell = (fixture: ComponentFixture<unknown>, label: number) => {
  const matches = cells(fixture).filter((c) => c.textContent?.trim() === `${label}`);

  return matches.find((c) => !c.hasAttribute('data-outside-month')) ?? matches[0] ?? null;
};

/** The cell currently holding the grid's roving tabindex. */
export const focusedCell = (fixture: ComponentFixture<unknown>) => cells(fixture).find((c) => c.tabIndex === 0) ?? null;

/** The labels of every cell carrying a range or comparison band, in document order. */
export const bandedCells = (fixture: ComponentFixture<unknown>) =>
  cells(fixture)
    .filter((c) => c.hasAttribute('data-band'))
    .map((c) => c.textContent?.trim());

/** Dispatches a keydown on the grid and settles `fixture` - what arrow/Home/End/PageUp/PageDown navigation reaches. */
export const press = (fixture: ComponentFixture<unknown>, key: string, shiftKey = false) => {
  grid(fixture).dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }));
  fixture.detectChanges();
};
