import { ComponentFixture } from '@angular/core/testing';
import { query, queryAll } from '../../testing/driver-core';
import { fakeLayout, stackedChildren } from '../../testing/fake-layout';

export const fakeScrollableLayout = (size: number) =>
  fakeLayout([stackedChildren('.et-scrollable-item', size), { match: '.et-scrollable-container', clientWidth: size }]);

export const createScrollableDriver = <T>(fixture: ComponentFixture<T>) => ({
  fixture,

  container: () => query(fixture, '.et-scrollable-container'),
  children: () => queryAll(fixture, '.et-scrollable-item'),

  masks: () => query(fixture, 'et-scrollable-masks'),
  buttons: () => query(fixture, 'et-scrollable-buttons'),
  navigation: () => query(fixture, 'et-scrollable-navigation'),
  footer: () => query(fixture, '.et-scrollable-footer'),

  fakeLayout: fakeScrollableLayout,
});
