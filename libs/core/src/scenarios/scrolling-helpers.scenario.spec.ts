import { Component, ElementRef, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  elementCanScroll,
  getElementScrollCoordinates,
  getScrollContainerTarget,
  getScrollItemTarget,
  getScrollSnapTarget,
  isElementVisible,
  scrollToElement,
  useCursorDragScroll,
} from '../index';
import { useScenario } from './harness';

const rect = (left: number, top: number, width: number, height: number) =>
  ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  }) as DOMRect;

type Layout = { x: number; y: number; width: number; height: number };

const ORIGIN = { scrollLeft: 0, scrollTop: 0, getBoundingClientRect: () => rect(0, 0, 0, 0) };

const place = (element: HTMLElement, parent: HTMLElement | null, layout: Layout) => {
  element.getBoundingClientRect = () => {
    const frame = parent ?? ORIGIN;
    const origin = frame.getBoundingClientRect();

    return rect(
      origin.left + layout.x - frame.scrollLeft,
      origin.top + layout.y - frame.scrollTop,
      layout.width,
      layout.height,
    );
  };

  parent?.appendChild(element);

  return element;
};

const makeScroller = (layout: Layout, extent: { width: number; height: number }, parent: HTMLElement | null = null) => {
  const element = place(document.createElement('div'), parent, layout);
  const writes: ScrollToOptions[] = [];
  const position = { left: 0, top: 0 };

  Object.defineProperties(element, {
    clientWidth: { value: layout.width },
    clientHeight: { value: layout.height },
    scrollWidth: { value: extent.width },
    scrollHeight: { value: extent.height },
    scrollLeft: { get: () => position.left, set: (value: number) => (position.left = value) },
    scrollTop: { get: () => position.top, set: (value: number) => (position.top = value) },
    scrollTo: {
      value: (options: ScrollToOptions) => {
        writes.push(options);
        if (options.left !== undefined) position.left = options.left;
        if (options.top !== undefined) position.top = options.top;
      },
    },
  });

  return { element, writes, position };
};

const item = (parent: HTMLElement, layout: Layout) => place(document.createElement('div'), parent, layout);

const mount = (element: HTMLElement) => {
  document.body.appendChild(element);

  return () => element.remove();
};

const entry = (target: Element, intersectionRatio: number) =>
  ({ target, intersectionRatio }) as IntersectionObserverEntry;

const trackOf = (count: number, size: number, view: number) => {
  const track = makeScroller({ x: 0, y: 0, width: view, height: 50 }, { width: count * size, height: 50 });
  const items = Array.from({ length: count }, (_, index) =>
    item(track.element, { x: index * size, y: 0, width: size, height: 50 }),
  );

  return { ...track, items, unmount: mount(track.element) };
};

describe('scrolling helper scenarios', () => {
  const scenario = useScenario();

  describe('scrollToElement', () => {
    it('does not move a container whose element is already fully visible', () => {
      scenario();
      const { element: container, writes } = makeScroller(
        { x: 10, y: 20, width: 200, height: 100 },
        { width: 600, height: 400 },
      );
      const unmount = mount(container);
      const target = item(container, { x: 20, y: 30, width: 50, height: 20 });

      scrollToElement({ container, element: target, behavior: 'auto' });
      scrollToElement({ container, element: target, behavior: 'auto' });

      expect(writes).toEqual([
        { behavior: 'auto', left: 0, top: 0 },
        { behavior: 'auto', left: 0, top: 0 },
      ]);
      unmount();
    });

    it('aligns the start of an oversized element whose start is visible instead of hiding it', () => {
      scenario();
      const { element: container, writes } = makeScroller(
        { x: 0, y: 0, width: 200, height: 100 },
        { width: 1000, height: 100 },
      );
      const unmount = mount(container);
      const target = item(container, { x: 50, y: 0, width: 500, height: 100 });

      scrollToElement({ container, element: target, direction: 'inline', behavior: 'auto' });

      expect(writes).toEqual([{ behavior: 'auto', left: 50, top: undefined }]);
      unmount();
    });

    it('aligns the end of an oversized element whose end is visible', () => {
      scenario();
      const {
        element: container,
        writes,
        position,
      } = makeScroller({ x: 0, y: 0, width: 200, height: 100 }, { width: 1000, height: 100 });
      const unmount = mount(container);
      const target = item(container, { x: 0, y: 0, width: 500, height: 100 });

      position.left = 350;
      scrollToElement({ container, element: target, direction: 'inline', behavior: 'auto' });

      expect(writes).toEqual([{ behavior: 'auto', left: 300, top: undefined }]);
      unmount();
    });

    it('leaves an oversized element that already fills the container where it is', () => {
      scenario();
      const {
        element: container,
        writes,
        position,
      } = makeScroller({ x: 0, y: 0, width: 200, height: 100 }, { width: 1000, height: 400 });
      const unmount = mount(container);
      const target = item(container, { x: 0, y: 0, width: 500, height: 300 });

      position.left = 120;
      position.top = 80;
      scrollToElement({ container, element: target, behavior: 'auto' });

      expect(writes).toEqual([{ behavior: 'auto', left: 120, top: 80 }]);
      unmount();
    });

    it('scrolls only the container it is given when the element sits in a nested scroller', () => {
      scenario();
      const outer = makeScroller({ x: 0, y: 0, width: 300, height: 200 }, { width: 300, height: 1000 });
      const unmount = mount(outer.element);
      const inner = makeScroller(
        { x: 0, y: 500, width: 300, height: 100 },
        { width: 1200, height: 100 },
        outer.element,
      );
      const target = item(inner.element, { x: 600, y: 0, width: 100, height: 100 });

      inner.position.left = 450;
      scrollToElement({ container: outer.element, element: target, direction: 'block', behavior: 'auto' });
      scrollToElement({ container: inner.element, element: target, direction: 'inline', behavior: 'auto' });

      expect(outer.writes).toEqual([{ behavior: 'auto', left: undefined, top: 400 }]);
      expect(inner.writes).toEqual([{ behavior: 'auto', left: 450, top: undefined }]);
      expect(isElementVisible({ element: target, container: outer.element })?.isIntersecting).toBe(true);
      unmount();
    });

    it('does nothing in a zero-size container', () => {
      scenario();
      const { element: container, writes } = makeScroller({ x: 0, y: 0, width: 0, height: 0 }, { width: 0, height: 0 });
      const unmount = mount(container);
      const target = item(container, { x: 40, y: 40, width: 20, height: 20 });

      scrollToElement({ container, element: target, behavior: 'auto' });

      expect(elementCanScroll(container)).toBe(false);
      expect(writes).toEqual([{ behavior: 'auto', left: undefined, top: undefined }]);
      expect(isElementVisible({ element: target, container })?.isIntersecting).toBe(false);
      unmount();
    });

    it('does not scroll toward an element that has been detached', () => {
      scenario();
      const {
        element: container,
        writes,
        position,
      } = makeScroller({ x: 100, y: 100, width: 200, height: 100 }, { width: 800, height: 400 });
      const unmount = mount(container);
      const target = item(container, { x: 400, y: 0, width: 50, height: 50 });

      position.left = 300;
      target.remove();
      target.getBoundingClientRect = () => rect(0, 0, 0, 0);
      scrollToElement({ container, element: target, behavior: 'auto' });

      expect(writes).toEqual([{ behavior: 'auto', left: undefined, top: undefined }]);
      unmount();
    });

    it('scrolls an rtl container into negative scroll offsets', () => {
      scenario();
      const {
        element: container,
        writes,
        position,
      } = makeScroller({ x: 0, y: 0, width: 200, height: 100 }, { width: 800, height: 100 });
      const unmount = mount(container);

      container.dir = 'rtl';
      const items = [0, 1, 2, 3].map((index) => item(container, { x: -100 * index, y: 0, width: 100, height: 100 }));

      scrollToElement({ container, element: items[3], direction: 'inline', behavior: 'auto' });
      expect(position.left).toBe(-300);

      scrollToElement({ container, element: items[0], direction: 'inline', behavior: 'auto' });
      scrollToElement({ container, element: items[2], direction: 'inline', origin: 'center', behavior: 'auto' });

      expect(writes.map((write) => write.left)).toEqual([-300, -100, -250]);
      unmount();
    });

    it('keeps the requested margin between the element and the container edge', () => {
      scenario();
      const {
        element: container,
        writes,
        position,
      } = makeScroller({ x: 0, y: 0, width: 300, height: 100 }, { width: 1000, height: 400 });
      const unmount = mount(container);
      const ahead = item(container, { x: 400, y: 0, width: 100, height: 100 });
      const behind = item(container, { x: 50, y: 0, width: 100, height: 100 });
      const below = item(container, { x: 0, y: 250, width: 100, height: 50 });

      scrollToElement({ container, element: ahead, direction: 'inline', scrollInlineMargin: 16, behavior: 'auto' });
      expect(position.left).toBe(216);

      scrollToElement({ container, element: behind, direction: 'inline', scrollInlineMargin: 16, behavior: 'auto' });
      scrollToElement({
        container,
        element: below,
        direction: 'block',
        origin: 'start',
        scrollBlockMargin: 10,
        behavior: 'auto',
      });

      expect(writes.map((write) => [write.left, write.top])).toEqual([
        [216, undefined],
        [34, undefined],
        [undefined, 240],
      ]);
      unmount();
    });

    it('survives its container being destroyed mid smooth scroll without leaving anything behind', () => {
      @Component({
        selector: 'et-scenario-scroll-track',
        template: `<div #track><span #target></span></div>`,
      })
      class TrackComponent {
        track = viewChild.required<ElementRef<HTMLElement>>('track');
        target = viewChild.required<ElementRef<HTMLElement>>('target');
      }

      const s = scenario();
      const fixture = TestBed.createComponent(TrackComponent);

      s.tick();

      const container = fixture.componentInstance.track().nativeElement;
      const target = fixture.componentInstance.target().nativeElement;
      const writes: ScrollToOptions[] = [];

      Object.defineProperties(container, {
        clientWidth: { get: () => (container.isConnected ? 100 : 0) },
        clientHeight: { get: () => (container.isConnected ? 100 : 0) },
        scrollWidth: { get: () => (container.isConnected ? 500 : 0) },
        scrollHeight: { get: () => (container.isConnected ? 100 : 0) },
        scrollTo: { value: (options: ScrollToOptions) => writes.push(options) },
      });
      container.getBoundingClientRect = () => rect(0, 0, 100, 100);
      target.getBoundingClientRect = () => rect(300, 0, 50, 100);

      scrollToElement({ container, element: target, direction: 'inline' });
      (fixture.nativeElement as HTMLElement).remove();
      fixture.destroy();
      s.flush();
      scrollToElement({ container, element: target, direction: 'inline' });

      expect(writes).toEqual([
        { behavior: 'smooth', left: 250, top: undefined },
        { behavior: 'smooth', left: undefined, top: undefined },
      ]);
    });
  });

  describe('getElementScrollCoordinates', () => {
    it('reports no coordinates without a container or element', () => {
      scenario();
      const { element: container } = makeScroller({ x: 0, y: 0, width: 100, height: 100 }, { width: 400, height: 100 });

      expect(getElementScrollCoordinates({ container, element: null })).toEqual({
        behavior: 'smooth',
        left: undefined,
        top: undefined,
      });
      expect(getElementScrollCoordinates({ container: null, element: container })).toEqual({
        behavior: 'smooth',
        left: undefined,
        top: undefined,
      });
    });
  });

  describe('getScrollSnapTarget', () => {
    it('reports nothing for an empty list or a track already resting on a snap point', () => {
      scenario();
      const { element: track, items, unmount } = trackOf(5, 100, 300);

      expect(getScrollSnapTarget([], track, 'horizontal', 'auto')).toBeNull();
      expect(getScrollSnapTarget(items, track, 'horizontal', 'start')).toBeNull();
      unmount();
    });

    it('picks the nearest origin in auto mode and honours the margin', () => {
      scenario();
      const { element: track, items, position, unmount } = trackOf(5, 100, 300);

      position.left = 130;
      expect(getScrollSnapTarget(items, track, 'horizontal', 'auto')).toEqual({ element: items[1], origin: 'start' });
      expect(getScrollSnapTarget(items, track, 'horizontal', 'start', 20)).toEqual({
        element: items[1],
        origin: 'start',
      });

      position.left = 90;
      expect(getScrollSnapTarget(items, track, 'horizontal', 'start', 10)).toBeNull();

      position.left = 160;
      expect(getScrollSnapTarget(items, track, 'horizontal', 'center')).toEqual({
        element: items[2],
        origin: 'center',
      });
      unmount();
    });

    it('snaps to the visible edge of an oversized item and skips one that covers the track', () => {
      scenario();
      const { element: track, items, position, unmount } = trackOf(3, 500, 200);

      position.left = 460;
      expect(getScrollSnapTarget(items, track, 'horizontal', 'auto')).toEqual({ element: items[1], origin: 'start' });

      position.left = 100;
      expect(getScrollSnapTarget(items.slice(0, 1), track, 'horizontal', 'auto')).toBeNull();

      position.left = 320;
      expect(getScrollSnapTarget(items.slice(0, 1), track, 'horizontal', 'auto')).toEqual({
        element: items[0],
        origin: 'end',
      });
      unmount();
    });

    it('lands on the snap point it names when fed back into scrollToElement', () => {
      scenario();
      const { element: track, items, position, writes, unmount } = trackOf(6, 100, 300);

      position.left = 240;
      const target = getScrollSnapTarget(items, track, 'horizontal', 'auto');

      scrollToElement({ container: track, element: target?.element, origin: target?.origin, behavior: 'auto' });

      expect(writes.map((write) => write.left)).toEqual([200]);
      expect(getScrollSnapTarget(items, track, 'horizontal', 'auto')).toBeNull();
      unmount();
    });

    it('snaps an rtl track the same way', () => {
      scenario();
      const track = makeScroller({ x: 0, y: 0, width: 300, height: 50 }, { width: 600, height: 50 });
      const unmount = mount(track.element);

      track.element.dir = 'rtl';
      const items = [0, 1, 2, 3, 4, 5].map((index) =>
        item(track.element, { x: 200 - 100 * index, y: 0, width: 100, height: 50 }),
      );

      track.position.left = -130;
      const target = getScrollSnapTarget(items, track.element, 'horizontal', 'end');

      expect(target).toEqual({ element: items[1], origin: 'end' });
      scrollToElement({ container: track.element, element: target?.element, origin: 'end', behavior: 'auto' });
      expect(track.position.left).toBe(-100);
      unmount();
    });
  });

  describe('getScrollItemTarget and getScrollContainerTarget', () => {
    it('reports nothing when no item intersects', () => {
      scenario();
      const { element: track, items, unmount } = trackOf(3, 100, 300);
      const entries = items.map((element) => entry(element, 0));

      expect(getScrollItemTarget(entries, track, 'end', 'auto', 'horizontal')).toBeNull();
      expect(getScrollContainerTarget(entries, 'end')).toBeNull();
      expect(getScrollItemTarget([], track, 'start', 'auto', 'horizontal')).toBeNull();
      unmount();
    });

    it('steps to the next item past a fully visible one and stops at either end', () => {
      scenario();
      const { element: track, items, unmount } = trackOf(5, 100, 300);
      const atStart = items.map((element, index) => entry(element, index < 3 ? 1 : 0));

      expect(getScrollItemTarget(atStart, track, 'end', 'auto', 'horizontal')).toEqual({
        element: items[3],
        index: 3,
        origin: 'end',
      });
      expect(getScrollItemTarget(atStart, track, 'start', 'auto', 'horizontal')).toBeNull();
      expect(getScrollContainerTarget(atStart, 'end')).toEqual({ element: items[3], origin: 'start' });

      const atEnd = items.map((element, index) => entry(element, index >= 2 ? 1 : 0));

      expect(getScrollItemTarget(atEnd, track, 'end', 'auto', 'horizontal')).toBeNull();
      expect(getScrollContainerTarget(atEnd, 'end')).toEqual({ element: items[4], origin: 'start' });
      unmount();
    });

    it('brings a partly visible edge item in before stepping past it', () => {
      scenario();
      const { element: track, items, unmount } = trackOf(5, 100, 300);
      const entries = items.map((element, index) => entry(element, [0.5, 1, 1, 0.5, 0][index] ?? 0));

      expect(getScrollItemTarget(entries, track, 'start', 'auto', 'horizontal')).toEqual({
        element: items[0],
        index: 0,
        origin: 'start',
      });
      expect(getScrollItemTarget(entries, track, 'end', 'center', 'horizontal')).toEqual({
        element: items[3],
        index: 3,
        origin: 'center',
      });
      expect(getScrollContainerTarget(entries, 'start')).toEqual({ element: items[0], origin: 'end' });
      unmount();
    });

    it('pages through an oversized item before moving to its neighbour', () => {
      scenario();
      const { element: track, items, position, unmount } = trackOf(3, 500, 200);
      const only = (index: number) => items.map((element, i) => entry(element, i === index ? 0.4 : 0));

      position.left = 100;
      expect(getScrollItemTarget(only(0), track, 'end', 'auto', 'horizontal')).toEqual({
        element: items[0],
        index: 0,
        origin: 'end',
      });

      position.left = 300;
      expect(getScrollItemTarget(only(0), track, 'end', 'auto', 'horizontal')).toEqual({
        element: items[1],
        index: 1,
        origin: 'start',
      });

      position.left = 500;
      expect(getScrollItemTarget(only(1), track, 'start', 'auto', 'horizontal')).toEqual({
        element: items[0],
        index: 0,
        origin: 'end',
      });

      position.left = 0;
      expect(getScrollItemTarget(only(0), track, 'start', 'auto', 'horizontal')).toBeNull();
      unmount();
    });
  });

  describe('useCursorDragScroll', () => {
    @Component({
      selector: 'et-scenario-drag-scroll',
      template: `<div #track></div>`,
    })
    class DragScrollComponent {
      track = viewChild.required<ElementRef<HTMLElement>>('track');
      enabled = signal(true);
      drag = useCursorDragScroll(this.track, { canScroll: signal(true), enabled: this.enabled });
    }

    const mouse = (type: string, target: EventTarget, x: number, y = 0, button = 0) =>
      target.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, button, bubbles: true }));

    const setup = () => {
      const s = scenario();
      const fixture = TestBed.createComponent(DragScrollComponent);

      s.tick();

      const track = fixture.componentInstance.track().nativeElement;
      const writes: ScrollToOptions[] = [];

      Object.defineProperties(track, {
        scrollLeft: { value: 40 },
        scrollTop: { value: 10 },
        scroll: { value: (options: ScrollToOptions) => writes.push(options) },
      });

      return { s, fixture, track, writes };
    };

    it('scrolls against the pointer once it leaves the deadzone and lets go on mouseup', () => {
      const { s, fixture, track, writes } = setup();

      mouse('mousedown', track, 100, 100);
      mouse('mousemove', document, 97, 100);
      s.tick();
      expect(writes).toEqual([]);

      mouse('mousemove', document, 70, 90);
      s.tick();
      expect(fixture.componentInstance.drag.isDragging()).toBe(true);
      expect(document.documentElement.style.cursor).toBe('grabbing');
      expect(writes.at(-1)).toEqual({ left: 70, top: 20, behavior: 'instant' });

      mouse('mouseup', document, 70, 90);
      s.tick();
      expect(fixture.componentInstance.drag.isDragging()).toBe(false);
      expect(document.documentElement.style.cursor).toBe('');
      expect(track.style.cursor).toBe('grab');
    });

    it('ignores a secondary button and ends a drag on contextmenu', () => {
      const { s, fixture, track, writes } = setup();

      mouse('mousedown', track, 100, 0, 2);
      mouse('mousemove', document, 0);
      s.tick();
      expect(writes).toEqual([]);

      mouse('mousedown', track, 100);
      mouse('mousemove', document, 50);
      s.tick();
      document.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true }));
      s.tick();
      const count = writes.length;

      mouse('mousemove', document, 0);
      s.tick();
      expect(fixture.componentInstance.drag.isDragging()).toBe(false);
      expect(writes.length).toBe(count);
    });

    it('releases the document when destroyed mid-drag', () => {
      const { s, fixture, track } = setup();

      mouse('mousedown', track, 100);
      mouse('mousemove', document, 50);
      s.tick();
      expect(document.documentElement.style.cursor).toBe('grabbing');

      fixture.destroy();
      s.flush();

      expect(document.documentElement.style.cursor).toBe('');
    });

    it('stops reacting while disabled', () => {
      const { s, fixture, track, writes } = setup();

      fixture.componentInstance.enabled.set(false);
      s.tick();
      mouse('mousedown', track, 100);
      mouse('mousemove', document, 0);
      s.tick();

      expect(writes).toEqual([]);
      expect(track.style.cursor).toBe('');
    });
  });
});
