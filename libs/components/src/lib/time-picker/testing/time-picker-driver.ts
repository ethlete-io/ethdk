import { ComponentFixture } from '@angular/core/testing';
import { query, queryAll } from '../../testing/driver-core';

export const column = (fixture: ComponentFixture<unknown>, unit: string) =>
  query<HTMLElement>(fixture, `[data-unit='${unit}']`);

export const columns = (fixture: ComponentFixture<unknown>) => queryAll<HTMLElement>(fixture, '[data-unit]');

export const option = (fixture: ComponentFixture<unknown>, unit: string, value: number) =>
  column(fixture, unit)?.querySelector<HTMLButtonElement>(`[data-value='${value}']`) ?? null;

export const press = (fixture: ComponentFixture<unknown>, unit: string, key: string) => {
  column(fixture, unit)?.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
};
