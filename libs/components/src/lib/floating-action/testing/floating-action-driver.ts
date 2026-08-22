import { Provider, Type } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { ControlDriverOptions, createControlDriver, mountControl } from '../../testing/control-driver';
import { tick } from '../../testing/driver-core';
import { fakeIntersectionObserver } from '../../testing/fake-layout';
import { FloatingActionDirective } from '../headless/floating-action.directive';

const VIEWPORT = new DOMRectReadOnly(0, 0, 1024, 768);
const ABOVE = new DOMRectReadOnly(0, -200, 100, 100);
const IN_VIEW = new DOMRectReadOnly(0, 100, 100, 100);

/**
 * A floating action whose anchor and scope report whatever scroll position a test asks for.
 * jsdom performs no real scrolling or layout, so `signalHostElementIntersection`'s own
 * `IntersectionObserver` - faked via {@link fakeIntersectionObserver} - is the only way in.
 */
export const createFloatingActionDriver = <T>(
  fixture: ComponentFixture<T>,
  intersectionObserver: ReturnType<typeof fakeIntersectionObserver>,
  options: ControlDriverOptions = {},
) => {
  const base = createControlDriver(fixture, FloatingActionDirective, options);

  const anchorEl = () => base.query('[etFloatingActionAnchor]');
  const scopeEl = () => base.query('[etFloatingActionScope]');

  const scroll = (el: HTMLElement | null, boundingClientRect: DOMRectReadOnly) => {
    if (!el) return;

    intersectionObserver.fire(el, { boundingClientRect, rootBounds: VIEWPORT });
    tick();
  };

  return {
    ...base,
    floatingAction: base.control,

    triggerEl: () => base.query<HTMLButtonElement>('[etFloatingActionTrigger]'),
    topEl: () => base.query('[etFloatingActionTop]'),

    scrollAnchorAbove: () => scroll(anchorEl(), ABOVE),
    scrollAnchorIntoView: () => scroll(anchorEl(), IN_VIEW),
    scrollScopeAbove: () => scroll(scopeEl(), ABOVE),
    scrollScopeIntoView: () => scroll(scopeEl(), IN_VIEW),
  };
};

export type FloatingActionDriver<T> = ReturnType<typeof createFloatingActionDriver<T>>;

/**
 * `signalHostElementIntersection` only builds its `IntersectionObserver` once `afterNextRender` has
 * confirmed the first render, so the anchor and scope aren't observed - and firing them does
 * nothing - until the fixture has settled.
 */
export const mountFloatingAction = async <T>(
  component: Type<T>,
  options: ControlDriverOptions = {},
  providers: Provider[] = [],
) => {
  const intersectionObserver = fakeIntersectionObserver();
  const fixture = mountControl(component, providers);

  await fixture.whenStable();

  return createFloatingActionDriver(fixture, intersectionObserver, options);
};
