import { ComponentFixture } from '@angular/core/testing';
import { query, queryAll } from '../../testing/driver-core';

export const grid = (fixture: ComponentFixture<unknown>) => query<HTMLElement>(fixture, '[role="grid"]')!;

export const cells = (fixture: ComponentFixture<unknown>) => queryAll<HTMLButtonElement>(fixture, '[etcalendarcell]');

export const cell = (fixture: ComponentFixture<unknown>, label: number) => {
  const matches = cells(fixture).filter((c) => c.textContent?.trim() === `${label}`);

  return matches.find((c) => !c.hasAttribute('data-outside-month')) ?? matches[0] ?? null;
};

export const focusedCell = (fixture: ComponentFixture<unknown>) => cells(fixture).find((c) => c.tabIndex === 0) ?? null;

export const bandedCells = (fixture: ComponentFixture<unknown>) =>
  cells(fixture)
    .filter((c) => c.hasAttribute('data-band'))
    .map((c) => c.textContent?.trim());

export const press = (fixture: ComponentFixture<unknown>, key: string, shiftKey = false) => {
  grid(fixture).dispatchEvent(new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true }));
  fixture.detectChanges();
};
