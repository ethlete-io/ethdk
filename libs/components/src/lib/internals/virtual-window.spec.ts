import { ApplicationRef, Injector, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { VirtualWindow, createVirtualWindow } from './virtual-window';

const createScrollContainer = () => {
  const element = document.createElement('div');
  let scrollTop = 0;

  // jsdom has no layout - back the geometry the window reads with plain values
  Object.defineProperty(element, 'clientHeight', { value: 200, configurable: true });
  Object.defineProperty(element, 'scrollTop', {
    get: () => scrollTop,
    set: (value: number) => {
      scrollTop = Math.max(0, value);
    },
    configurable: true,
  });

  return element;
};

describe('createVirtualWindow', () => {
  let container: ReturnType<typeof signal<HTMLElement | null>>;
  let itemCount: ReturnType<typeof signal<number>>;
  let window: VirtualWindow;

  const tick = () => TestBed.inject(ApplicationRef).tick();

  beforeEach(() => {
    TestBed.configureTestingModule({});
    container = signal<HTMLElement | null>(null);
    itemCount = signal(100);

    runInInjectionContext(TestBed.inject(Injector), () => {
      window = createVirtualWindow({
        container,
        itemCount,
        estimateItemHeight: 10,
        overscan: 2,
      });
    });
  });

  it('passes every item through while no container is set', () => {
    expect(window.range()).toEqual({ start: 0, end: 100 });
    expect(window.paddingTop()).toBe(0);
    expect(window.paddingBottom()).toBe(0);
  });

  it('windows the range to the viewport plus overscan once a container exists', () => {
    const element = createScrollContainer();

    container.set(element);
    tick();

    // 200px viewport / 10px rows = 20 visible + 2 overscan below
    expect(window.range()).toEqual({ start: 0, end: 22 });
    expect(window.paddingTop()).toBe(0);
    expect(window.paddingBottom()).toBe(780);
  });

  it('follows container scrolling', () => {
    const element = createScrollContainer();

    container.set(element);
    tick();

    element.scrollTop = 500;
    element.dispatchEvent(new Event('scroll'));

    expect(window.range()).toEqual({ start: 48, end: 72 });
    expect(window.paddingTop()).toBe(480);
    expect(window.paddingBottom()).toBe(280);
  });

  it('adopts a measured row height', () => {
    const element = createScrollContainer();

    container.set(element);
    tick();

    const row = document.createElement('div');

    Object.defineProperty(row, 'offsetHeight', { value: 20, configurable: true });
    window.measureItem(row);

    // 200px viewport / 20px rows = 10 visible + 2 overscan
    expect(window.range()).toEqual({ start: 0, end: 12 });
    expect(window.paddingBottom()).toBe((100 - 12) * 20);
  });

  it('scrolls the minimal amount that brings a row into the viewport', () => {
    const element = createScrollContainer();

    container.set(element);
    tick();

    // below the viewport: align the row's bottom edge with the viewport's
    window.scrollToIndex(50);
    expect(element.scrollTop).toBe(50 * 10 + 10 - 200);

    // above the viewport: align the row's top edge
    window.scrollToIndex(3);
    expect(element.scrollTop).toBe(30);

    // already inside: no movement
    window.scrollToIndex(10);
    expect(element.scrollTop).toBe(30);
  });

  it('clamps into the item range when the count shrinks while scrolled far down', () => {
    const element = createScrollContainer();

    container.set(element);
    tick();

    element.scrollTop = 800;
    element.dispatchEvent(new Event('scroll'));

    // filtering shrank the list to 3 items - the stale offset must not empty the window
    itemCount.set(3);

    const { start, end } = window.range();

    expect(start).toBeLessThan(3);
    expect(end).toBe(3);
    expect(end).toBeGreaterThan(start);
  });

  it('replays a scroll request that arrived before the container existed', () => {
    window.scrollToIndex(50);

    const element = createScrollContainer();

    container.set(element);
    tick();

    expect(element.scrollTop).toBe(50 * 10 + 10 - 200);
    expect(window.range().start).toBeGreaterThan(0);
  });
});
