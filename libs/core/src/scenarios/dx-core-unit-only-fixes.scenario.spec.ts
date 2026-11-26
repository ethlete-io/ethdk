import { Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { numberBreakpointTransform, ResizeHandlesComponent, scrollToElement } from '../index';
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

const createGrid = () => {
  const container = document.createElement('div');
  const writes: ScrollToOptions[] = [];

  Object.defineProperties(container, {
    clientWidth: { value: 200 },
    clientHeight: { value: 100 },
    scrollWidth: { value: 600 },
    scrollHeight: { value: 500 },
    scrollLeft: { value: 30 },
    scrollTop: { value: 40 },
    scrollTo: { value: (options: ScrollToOptions) => writes.push(options) },
  });
  container.getBoundingClientRect = () => rect(0, 0, 200, 100);

  const cell = (left: number, top: number) => {
    const element = document.createElement('div');

    element.getBoundingClientRect = () => rect(left, top, 20, 20);
    container.appendChild(element);

    return element;
  };

  return { container, cell, writes };
};

@Component({ selector: 'et-scenario-columns', template: '' })
class ColumnsComponent {
  columns = input(1, { transform: numberBreakpointTransform(1) });
}

@Component({
  selector: 'et-scenario-columns-host',
  imports: [ColumnsComponent],
  template: '<et-scenario-columns [columns]="columns" />',
})
class ColumnsHostComponent {
  columns: Record<string, number> = { md: 3 };
}

@Component({
  selector: 'et-scenario-resizable',
  imports: [ResizeHandlesComponent],
  template: '<et-resize-handles [edges]="[\'se\']" (resizeEnded)="ended = ended + 1" />',
})
class ResizableComponent {
  ended = 0;
}

const pointer = (type: string, target: EventTarget, x: number, y: number) =>
  target.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: 7, button: 0, bubbles: true }));

describe('dx-scan core fixes covered only by unit specs before', () => {
  const scenario = useScenario();

  describe('CORE-04 scrollToElement nearest in a two-axis container', () => {
    it('scrolls only the axis the cell is outside of', () => {
      scenario();
      const { container, cell, writes } = createGrid();

      scrollToElement({ container, element: cell(50, 150), behavior: 'auto' });
      scrollToElement({ container, element: cell(300, 50), behavior: 'auto' });
      scrollToElement({ container, element: cell(300, -50), behavior: 'auto' });

      expect(writes).toEqual([
        { behavior: 'auto', left: 30, top: 110 },
        { behavior: 'auto', left: 150, top: 40 },
        { behavior: 'auto', left: 150, top: -10 },
      ]);
    });
  });

  describe('CORE-07 breakpoint transform without provideBreakpointInstance', () => {
    it('warns once, naming provideBreakpointInstance, when a map is bound', () => {
      const s = scenario();
      const fixture = TestBed.createComponent(ColumnsHostComponent);

      s.tick();
      fixture.componentInstance.columns = { md: 4 };
      fixture.changeDetectorRef.markForCheck();
      s.tick();

      s.expectWarning(/provideBreakpointInstance\(\)/);
      fixture.destroy();
    });
  });

  describe('CORE-16 resize handle pointer capture', () => {
    it('captures the pointer on the pressed handle and still ends the gesture', () => {
      const s = scenario();
      const fixture = TestBed.createComponent(ResizableComponent);

      s.tick();

      const handle = (fixture.nativeElement as HTMLElement).querySelector('.et-resize-handle--se') as HTMLElement;
      const captured: number[] = [];

      handle.setPointerCapture = (pointerId) => captured.push(pointerId);

      pointer('pointerdown', handle, 100, 100);
      pointer('pointermove', document, 140, 120);
      pointer('pointerup', document, 140, 120);
      s.tick();

      expect(captured).toEqual([7]);
      expect(fixture.componentInstance.ended).toBe(1);
      fixture.destroy();
    });
  });
});
