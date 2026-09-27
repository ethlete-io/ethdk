import { Component, getDebugNode, signal, ViewEncapsulation } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  SCROLLBAR_ERROR_CODES,
  SCROLLBAR_IMPORTS,
  ScrollbarComponent,
  ScrollbarDirective,
  ScrollbarThumbDirective,
} from '../index';
import { dragScrollbarThumb, fakeScrollbarTarget } from '../lib/scrollbar/testing/scrollbar-driver';
import { fakeElementScroll, fakeLayout, fakeResizeObserver } from '../lib/testing/fake-layout';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

const query = <T extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) => {
  const element = root.querySelector<T>(selector);

  if (!element) throw new Error(`No ${selector}`);

  return element;
};

const takeError = (s: Scenario, code: number) => {
  s.tick(1);

  const index = s.errors.findIndex((entry) => String((entry.error as Error | undefined)?.message).includes(`${code}`));

  return index === -1 ? undefined : (s.errors.splice(index, 1)[0]?.error as Error);
};

const UNSTYLED_BLOCKS = 'et-scrollbar { display: block; }';

const scrollTargetTo = (target: HTMLElement, property: 'scrollTop' | 'scrollLeft', value: number) => {
  Object.defineProperty(target, property, { configurable: true, value });
  target.dispatchEvent(new Event('scroll'));
};

const thumbGeometry = (scrollbar: HTMLElement) => [
  scrollbar.style.getPropertyValue('--_et-scrollbar-thumb-size'),
  scrollbar.style.getPropertyValue('--_et-scrollbar-thumb-offset'),
];

@Component({
  selector: 'et-scenario-roster-panel',
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  imports: [SCROLLBAR_IMPORTS],
  template: `
    <div class="panel">
      <ul #roster class="roster">
        <li>team-a</li>
        <li>team-b</li>
      </ul>
      <et-scrollbar [for]="roster" [autoHide]="autoHide()" [disabled]="disabled()" class="roster-bar" />
    </div>

    <div #timeline class="timeline"></div>
    <div
      #bar="etScrollbar"
      [for]="timeline"
      [minThumbSize]="minThumbSize()"
      class="timeline-bar"
      etScrollbar
      orientation="horizontal"
    >
      <span class="timeline-thumb" etScrollbarThumb></span>
    </div>
    <output class="timeline-state">{{ bar.canScroll() }}|{{ bar.isDragging() }}</output>
  `,
})
class RosterPanelComponent {
  autoHide = signal(true);
  disabled = signal(false);
  minThumbSize = signal(24);
}

@Component({
  selector: 'et-scenario-broken-scrollbars',
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  imports: [SCROLLBAR_IMPORTS],
  template: `
    <div #list class="list"></div>
    <div [for]="list" class="no-thumb" etScrollbar></div>
    <et-scrollbar class="no-target" />
  `,
})
class BrokenScrollbarsComponent {}

@Component({
  selector: 'et-scenario-misbound-scrollbar',
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  imports: [SCROLLBAR_IMPORTS],
  template: `<et-scrollbar [for]="listId" />`,
})
class MisboundScrollbarComponent {
  listId = 'list' as unknown as HTMLElement;
}

describe('scrollbar scenarios', () => {
  const scenario = useScenario();

  it('mirrors the container scroll offset, auto-hides and pages on a track press', () => {
    const resizeObserver = fakeResizeObserver();
    const scroll = fakeElementScroll();
    const s = scenario();
    const fixture = TestBed.createComponent(RosterPanelComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;

    s.tick();

    const roster = query('.roster', host);
    const bar = query('.roster-bar', host);

    fakeScrollbarTarget(roster, 'vertical', { viewportSize: 100, contentSize: 500 });
    fakeLayout([{ match: '.roster-bar', clientHeight: 200, rect: { top: 0, left: 0, width: 8, height: 200 } }]);
    resizeObserver.fire();
    s.tick();

    expect(getDebugNode(bar)?.componentInstance).toBeInstanceOf(ScrollbarComponent);
    expect(roster.classList).toContain('et-scrollbar-host');
    expect(bar.getAttribute('data-orientation')).toBe('vertical');
    expect(bar.querySelector('.et-scrollbar-thumb')).not.toBeNull();
    expect(thumbGeometry(bar)).toEqual(['40px', '0px']);
    expect(bar.classList).not.toContain('et-scrollbar--visible');

    scrollTargetTo(roster, 'scrollTop', 200);
    s.tick();
    expect(thumbGeometry(bar)).toEqual(['40px', '80px']);
    expect(bar.classList).toContain('et-scrollbar--visible');

    s.tick(800);
    expect(bar.classList).not.toContain('et-scrollbar--visible');

    roster.dispatchEvent(new PointerEvent('pointerenter'));
    s.tick();
    expect(bar.classList).toContain('et-scrollbar--visible');
    roster.dispatchEvent(new PointerEvent('pointerleave'));
    s.tick();
    expect(bar.classList).not.toContain('et-scrollbar--visible');

    const below = new PointerEvent('pointerdown', { button: 0, clientY: 180, bubbles: true, cancelable: true });

    bar.dispatchEvent(below);
    expect(below.defaultPrevented).toBe(true);
    expect(scroll.lastCall()?.options).toEqual({ top: 300, behavior: 'smooth' });

    bar.dispatchEvent(new PointerEvent('pointerdown', { button: 0, clientY: 10, bubbles: true }));
    expect(scroll.lastCall()?.options).toEqual({ top: 100, behavior: 'smooth' });

    const drag = dragScrollbarThumb(query('.et-scrollbar-thumb', bar));

    drag.down({ x: 0, y: 0 });
    drag.move({ x: 0, y: 40 });
    s.tick();
    expect(bar.classList).toContain('et-scrollbar--dragging');
    expect(bar.classList).toContain('et-scrollbar--visible');
    expect(scroll.lastCall()?.options).toEqual({ top: 300, behavior: 'instant' });
    drag.up({ x: 0, y: 40 });
    s.tick();
    expect(bar.classList).not.toContain('et-scrollbar--dragging');

    app.autoHide.set(false);
    s.tick();
    expect(bar.classList).toContain('et-scrollbar--visible');

    app.disabled.set(true);
    s.tick();
    expect(bar.classList).not.toContain('et-scrollbar--visible');
    const callsBefore = scroll.calls().length;

    bar.dispatchEvent(new PointerEvent('pointerdown', { button: 0, clientY: 180, bubbles: true }));
    expect(scroll.calls().length).toBe(callsBefore);

    fixture.destroy();
    expect(roster.classList).not.toContain('et-scrollbar-host');
    expect(s.errors).toEqual([]);
  });

  it('drives a headless horizontal track through etScrollbar and etScrollbarThumb', () => {
    const resizeObserver = fakeResizeObserver();
    const scroll = fakeElementScroll();
    const s = scenario();
    const fixture = TestBed.createComponent(RosterPanelComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;

    s.tick();

    const timeline = query('.timeline', host);
    const bar = query('.timeline-bar', host);
    const thumb = query('.timeline-thumb', bar);
    const state = () => query('.timeline-state', host).textContent;

    expect(getDebugNode(bar)?.injector.get(ScrollbarDirective)).toBeInstanceOf(ScrollbarDirective);
    expect(getDebugNode(thumb)?.injector.get(ScrollbarThumbDirective)).toBeInstanceOf(ScrollbarThumbDirective);
    expect(bar.classList).toContain('et-scrollbar');
    expect(thumb.classList).toContain('et-scrollbar-thumb');
    expect(bar.getAttribute('data-orientation')).toBe('horizontal');
    expect(state()).toBe('false|false');

    fakeScrollbarTarget(timeline, 'horizontal', { viewportSize: 300, contentSize: 300 });
    fakeLayout([{ match: '.timeline-bar', clientWidth: 300 }]);
    resizeObserver.fire();
    s.tick();
    expect(state()).toBe('false|false');
    expect(bar.classList).not.toContain('et-scrollbar--visible');

    fakeScrollbarTarget(timeline, 'horizontal', { viewportSize: 300, contentSize: 30000 });
    resizeObserver.fire();
    s.tick();
    expect(state()).toBe('true|false');
    expect(bar.classList).toContain('et-scrollbar--visible');
    expect(thumbGeometry(bar)[0]).toBe('24px');

    app.minThumbSize.set(60);
    s.tick();
    expect(thumbGeometry(bar)[0]).toBe('60px');

    scrollTargetTo(timeline, 'scrollLeft', 29700);
    s.tick();
    expect(thumbGeometry(bar)[1]).toBe('240px');

    const drag = dragScrollbarThumb(thumb);

    drag.down({ x: 240, y: 0 });
    drag.move({ x: 120, y: 0 });
    s.tick();
    expect(state()).toBe('true|true');
    expect(scroll.lastCall()?.options).toEqual({ left: 14850, behavior: 'instant' });

    drag.cancel({ x: 120, y: 0 });
    s.tick();
    expect(state()).toBe('true|false');
    expect(scroll.lastCall()?.options).toEqual({ left: 29700, behavior: 'instant' });
    expect(s.errors).toEqual([]);
  });

  it('reports a missing thumb, a missing target and a string bound as the target', () => {
    const s = scenario();

    TestBed.createComponent(BrokenScrollbarsComponent);
    s.tick();

    expect(takeError(s, SCROLLBAR_ERROR_CODES.MISSING_THUMB)?.message).toContain('No thumb registered');
    expect(takeError(s, SCROLLBAR_ERROR_CODES.MISSING_TARGET)?.message).toContain('No scroll container to mirror');
    expect(s.errors.map((entry) => entry.source)).toEqual(['console.error', 'console.error']);
    s.errors.length = 0;

    expect(() => {
      TestBed.createComponent(MisboundScrollbarComponent);
      s.tick();
    }).toThrow(`ET${SCROLLBAR_ERROR_CODES.INVALID_TARGET}: [ScrollbarDirective] \`for\` must be an element`);
    s.tick(1);
    expect(s.errors.map((entry) => entry.source)).toEqual(['console.error']);
    s.errors.length = 0;
  });
});
