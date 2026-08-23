import { ComponentFixture } from '@angular/core/testing';
import { query, queryAll } from '../../testing/driver-core';
import { fakeLayout, stackedChildren } from '../../testing/fake-layout';

/** Lays the scrollable's own children out in a row of `size`-wide boxes, and gives the container a
 * viewport `size` wide - the shape a track needs to have anything to measure at all. */
export const fakeScrollableLayout = (size: number) =>
  fakeLayout([stackedChildren('.et-scrollable-item', size), { match: '.et-scrollable-container', clientWidth: size }]);

/** The container, its chrome, and its children of an `<et-scrollable>` under `fixture`. */
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
