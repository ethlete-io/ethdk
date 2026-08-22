import { Provider, Type } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { createControlDriver, mountControl } from '../../testing/control-driver';
import { StandingsComponent } from '../standings.component';

const STANDINGS_TEST_THEME: Provider[] = provideColorThemesWithTailwind4([
  {
    name: 'brand',
    isDefault: true,
    primary: {
      color: { default: '0 0 0', hover: '0 0 0', active: '0 0 0', disabled: '0 0 0' },
      onColor: { default: '255 255 255' },
    },
  },
]);

export const createStandingsDriver = <T>(fixture: ComponentFixture<T>) => {
  const base = createControlDriver(fixture, StandingsComponent);

  return {
    ...base,
    cells: (column: string) =>
      base.queryAll(`tbody [data-column='${column}']`).map((element) => element.textContent?.trim()),
  };
};

export type StandingsDriver<T> = ReturnType<typeof createStandingsDriver<T>>;

export const mountStandings = <T>(component: Type<T>, providers: Provider[] = []) =>
  createStandingsDriver(mountControl(component, [...STANDINGS_TEST_THEME, ...providers]));
