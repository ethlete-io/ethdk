import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { directiveAt } from '../testing/driver-core';
import { fakeElementScroll, fakeLayout, fakeResizeObserver } from '../testing/fake-layout';
import { ScrollbarDirective } from './headless';
import { SCROLLBAR_IMPORTS } from './scrollbar.imports';
import { dragScrollbarThumb, fakeScrollbarTarget } from './testing/scrollbar-driver';

@Component({
  selector: 'et-test-scrollbar-edge-host',
  template: `
    <div #list class="list"></div>
    <et-scrollbar [for]="list" />
  `,
  imports: [SCROLLBAR_IMPORTS],
})
class ScrollbarEdgeHostComponent {}

const TRACK_SIZE = 200;

const setup = (layout: { viewportSize: number; contentSize: number }) => {
  const resizeObserver = fakeResizeObserver();
  const scroll = fakeElementScroll();
  const fixture = TestBed.createComponent(ScrollbarEdgeHostComponent);
  fixture.detectChanges();

  const element = fixture.nativeElement as HTMLElement;
  const list = element.querySelector('.list') as HTMLElement;

  fakeScrollbarTarget(list, 'vertical', layout);
  fakeLayout([{ match: 'et-scrollbar', clientHeight: TRACK_SIZE }]);
  resizeObserver.fire();
  fixture.detectChanges();

  return {
    fixture,
    list,
    scroll,
    resizeObserver,
    track: element.querySelector('et-scrollbar') as HTMLElement,
    thumb: element.querySelector('.et-scrollbar-thumb') as HTMLElement,
    scrollbar: directiveAt(fixture, ScrollbarDirective, 'et-scrollbar'),
  };
};

const pressTrack = (track: HTMLElement, y: number) =>
  track.dispatchEvent(new PointerEvent('pointerdown', { clientY: y, button: 0, bubbles: true, cancelable: true }));

describe('ScrollbarDirective edge cases', () => {
  it('stays hidden with a zero-size thumb when the content is smaller than the viewport', () => {
    const { scrollbar, track } = setup({ viewportSize: 300, contentSize: 120 });

    expect(scrollbar.canScroll()).toBe(false);
    expect(scrollbar.isVisible()).toBe(false);
    expect(scrollbar.geometry().thumbSize).toBe(0);
    expect(track.classList.contains('et-scrollbar--visible')).toBe(false);
  });

  it('ignores a thumb drag and a track press while the content fits', () => {
    const { scroll, scrollbar, thumb, track } = setup({ viewportSize: 300, contentSize: 300 });
    const drag = dragScrollbarThumb(thumb);

    drag.down({ x: 0, y: 0 });
    drag.move({ x: 0, y: 80 });
    drag.up({ x: 0, y: 80 });
    pressTrack(track, 150);

    expect(scroll.calls()).toEqual([]);
    expect(scrollbar.isDragging()).toBe(false);
  });

  it('appears once a resize makes the content overflow, and disappears once it fits again', () => {
    const { fixture, list, resizeObserver, scrollbar, track } = setup({ viewportSize: 300, contentSize: 120 });

    fakeScrollbarTarget(list, 'vertical', { viewportSize: 100, contentSize: 400 });
    resizeObserver.fire();
    fixture.detectChanges();

    expect(scrollbar.canScroll()).toBe(true);
    expect(scrollbar.geometry().thumbSize).toBe(50);
    expect(track.classList.contains('et-scrollbar--visible')).toBe(true);

    fakeScrollbarTarget(list, 'vertical', { viewportSize: 500, contentSize: 400 });
    resizeObserver.fire();
    fixture.detectChanges();

    expect(scrollbar.canScroll()).toBe(false);
    expect(track.classList.contains('et-scrollbar--visible')).toBe(false);
  });

  it('keeps the thumb inside the track when the content shrinks under a scrolled target', () => {
    const { fixture, list, resizeObserver, scrollbar } = setup({ viewportSize: 100, contentSize: 1000 });

    list.scrollTop = 900;
    fakeScrollbarTarget(list, 'vertical', { viewportSize: 100, contentSize: 200 });
    resizeObserver.fire();
    fixture.detectChanges();

    const { thumbSize, thumbOffset, progress } = scrollbar.geometry();

    expect(progress).toBe(1);
    expect(thumbOffset + thumbSize).toBe(TRACK_SIZE);
  });

  it('pages within bounds from a track press on a barely overflowing target', () => {
    const { scroll, track } = setup({ viewportSize: 100, contentSize: 110 });

    track.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 0, width: 10, height: TRACK_SIZE });
    pressTrack(track, TRACK_SIZE - 1);

    expect(scroll.lastCall()?.options).toEqual({ top: 10, behavior: 'smooth' });
  });
});
