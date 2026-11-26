import { Provider, Type } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { createControlDriver, mountControl } from '../../testing/control-driver';
import { MatchCardComponent } from '../match-card.component';

export const createMatchCardDriver = <T>(fixture: ComponentFixture<T>) => {
  const base = createControlDriver(fixture, MatchCardComponent);

  return {
    ...base,
    card: () => base.query('.et-match-card')!,
  };
};

export type MatchCardDriver<T> = ReturnType<typeof createMatchCardDriver<T>>;

export const mountMatchCard = <T>(component: Type<T>, providers: Provider[] = []) =>
  createMatchCardDriver(mountControl(component, providers));
