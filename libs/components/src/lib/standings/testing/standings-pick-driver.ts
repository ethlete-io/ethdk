import { Provider, Type } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { createControlDriver, mountControl } from '../../testing/control-driver';
import { StandingsPickDirective } from '../headless';
import { StandingsPickComponent } from '../standings-pick.component';

export const createStandingsPickDriver = <T>(fixture: ComponentFixture<T>) => {
  const base = createControlDriver(fixture, StandingsPickComponent);

  const items = () => base.queryAll('.et-standings-pick-item');

  return {
    ...base,
    items,
    pick: () => base.directive(StandingsPickDirective),
    order: () => base.queryAll('.et-match-participant-name').map((element) => element.textContent?.trim()),
    positions: () => base.queryAll('.et-standings-pick-position').map((element) => element.textContent?.trim()),
    handles: () => base.queryAll<HTMLButtonElement>('.et-standings-pick-handle'),
    marks: () => base.queryAll('.et-standings-pick-mark').map((element) => element.textContent?.trim()),

    /** The 0-based row the cut line is drawn under, or `-1` when there is none. */
    cutAfter: () => items().findIndex((item) => !!item.querySelector('.et-standings-pick-cut')),
  };
};

export type StandingsPickDriver<T> = ReturnType<typeof createStandingsPickDriver<T>>;

export const mountStandingsPick = <T>(component: Type<T>, providers: Provider[] = []) =>
  createStandingsPickDriver(mountControl(component, providers));
