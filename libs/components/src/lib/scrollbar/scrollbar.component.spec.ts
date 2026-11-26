import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { directiveAt } from '../testing/driver-core';
import { fakeElementScroll, fakeLayout, fakeResizeObserver } from '../testing/fake-layout';
import { ScrollbarDirective } from './headless';
import { SCROLLBAR_IMPORTS } from './scrollbar.imports';
import { dragScrollbarThumb, fakeScrollbarTarget } from './testing/scrollbar-driver';

@Component({
  selector: 'et-test-scrollbar-host',
  template: `
    <div #list class="list"></div>

    <et-scrollbar [for]="list" [disabled]="disabled()" />

    @if (renderSecond()) {
      <et-scrollbar [for]="list" orientation="horizontal" />
    }
  `,
  imports: [SCROLLBAR_IMPORTS],
})
class ScrollbarHostComponent {
  public disabled = signal(false);
  public renderSecond = signal(false);
}

describe('ScrollbarComponent', () => {
  const setup = () => {
    const fixture = TestBed.createComponent(ScrollbarHostComponent);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;

    return {
      fixture,
      host: fixture.componentInstance,
      list: element.querySelector('.list') as HTMLElement,
      scrollbars: () => Array.from(element.querySelectorAll('et-scrollbar')),
    };
  };

  it('renders a thumb and describes its axis', () => {
    const { scrollbars } = setup();
    const scrollbar = scrollbars()[0] as HTMLElement;

    expect(scrollbar.classList.contains('et-scrollbar')).toBe(true);
    expect(scrollbar.getAttribute('data-orientation')).toBe('vertical');
    expect(scrollbar.querySelector('.et-scrollbar-thumb')).not.toBeNull();
  });

  it('hides the native scrollbar of the container it mirrors', () => {
    const { list } = setup();

    expect(list.classList.contains('et-scrollbar-host')).toBe(true);
  });

  it('stops hiding it once the last scrollbar is gone', () => {
    const { fixture, list } = setup();

    fixture.destroy();

    expect(list.classList.contains('et-scrollbar-host')).toBe(false);
  });

  it('keeps hiding it while a scrollbar on the other axis is left', () => {
    const { fixture, host, list } = setup();

    host.renderSecond.set(true);
    fixture.detectChanges();

    host.renderSecond.set(false);
    fixture.detectChanges();

    expect(list.classList.contains('et-scrollbar-host')).toBe(true);
  });

  it('does not let a press on the thumb move focus away', () => {
    const { fixture } = setup();
    const thumb = (fixture.nativeElement as HTMLElement).querySelector('.et-scrollbar-thumb') as HTMLElement;
    const event = new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 });

    thumb.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('leaves a press on a disabled thumb alone', () => {
    const { fixture, host } = setup();

    host.disabled.set(true);
    fixture.detectChanges();

    const thumb = (fixture.nativeElement as HTMLElement).querySelector('.et-scrollbar-thumb') as HTMLElement;
    const event = new PointerEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 });

    thumb.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });

  it('is never visible while disabled', () => {
    const { fixture, host, scrollbars } = setup();

    host.disabled.set(true);
    fixture.detectChanges();

    expect((scrollbars()[0] as HTMLElement).classList.contains('et-scrollbar--visible')).toBe(false);
  });

  describe('dragging the thumb', () => {
    const TRACK_SIZE = 200;
    const VIEWPORT_SIZE = 100;
    const CONTENT_SIZE = 500;

    /** 200px of track minus a 40px thumb (`clamp(200 * (100/500), 24, 200)`) leaves 160px of travel
     * mapped onto 400px (`500 - 100`) of scrollable content - a clean 1px-of-track-travel-to-2.5px
     * ratio the assertions below read off directly. */
    const setupDraggableScrollbar = () => {
      const resizeObserver = fakeResizeObserver();
      const scroll = fakeElementScroll();

      const { fixture, list } = setup();

      fakeScrollbarTarget(list, 'vertical', { viewportSize: VIEWPORT_SIZE, contentSize: CONTENT_SIZE });
      fakeLayout([{ match: 'et-scrollbar', clientHeight: TRACK_SIZE }]);
      resizeObserver.fire();
      fixture.detectChanges();

      const thumb = (fixture.nativeElement as HTMLElement).querySelector('.et-scrollbar-thumb') as HTMLElement;
      const scrollbar = directiveAt(fixture, ScrollbarDirective, 'et-scrollbar');

      return { fixture, thumb, scroll, scrollbar };
    };

    it('scales the pointer travel onto the track into a scroll offset on the target', () => {
      const { thumb, scroll, scrollbar } = setupDraggableScrollbar();
      const drag = dragScrollbarThumb(thumb);

      expect(scrollbar.isDragging()).toBe(false);

      drag.down({ x: 0, y: 0 });
      drag.move({ x: 0, y: 80 });

      expect(scrollbar.isDragging()).toBe(true);
      expect(scroll.lastCall()?.options).toEqual({ top: 200, behavior: 'instant' });

      drag.up({ x: 0, y: 80 });

      expect(scrollbar.isDragging()).toBe(false);
    });

    it('restores the offset the drag started from when the browser cancels it', () => {
      const { thumb, scroll, scrollbar } = setupDraggableScrollbar();
      const drag = dragScrollbarThumb(thumb);

      drag.down({ x: 0, y: 0 });
      drag.move({ x: 0, y: 80 });

      expect(scrollbar.isDragging()).toBe(true);

      drag.cancel({ x: 0, y: 80 });

      // the user never let go, so the offset they were dragging towards is not one they chose
      expect(scroll.calls().map((call) => call.options)).toEqual([
        { top: 200, behavior: 'instant' },
        { top: 0, behavior: 'instant' },
      ]);
      expect(scrollbar.isDragging()).toBe(false);
    });
  });
});
