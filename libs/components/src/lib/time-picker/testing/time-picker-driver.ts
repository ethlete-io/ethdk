import { ComponentFixture } from '@angular/core/testing';
import { query, queryAll } from '../../testing/driver-core';

/** The column for `unit` (`'hour' | 'minute' | 'second' | 'period'`), if the format renders it. */
export const column = (fixture: ComponentFixture<unknown>, unit: string) =>
  query<HTMLElement>(fixture, `[data-unit='${unit}']`);

/** Every column the active format renders, in document order. */
export const columns = (fixture: ComponentFixture<unknown>) => queryAll<HTMLElement>(fixture, '[data-unit]');

/** The option button for `value` inside `unit`'s column. */
export const option = (fixture: ComponentFixture<unknown>, unit: string, value: number) =>
  column(fixture, unit)?.querySelector<HTMLButtonElement>(`[data-value='${value}']`) ?? null;

/** Dispatches a keydown on `unit`'s column - the caller settles the fixture afterward. */
export const press = (fixture: ComponentFixture<unknown>, unit: string, key: string) => {
  column(fixture, unit)?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
};
