import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DragHandleDirective } from '../index';
import { useScenario } from './harness';

@Component({
  selector: 'et-scenario-drag-tile',
  imports: [DragHandleDirective],
  template: '<div etDragHandle (dragEnded)="ended = ended + 1">Drag me</div>',
})
class DragTileComponent {
  ended = 0;
}

const pointer = (type: string, target: EventTarget, x: number) =>
  target.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: 0, pointerId: 1, button: 0, bubbles: true }));

describe('drag handle scenarios', () => {
  const scenario = useScenario();

  it('suppresses prefixed and unprefixed text selection during a drag and restores both', () => {
    const s = scenario();
    const style = document.documentElement.style;

    style.userSelect = 'text';
    style.webkitUserSelect = 'auto';

    const fixture = TestBed.createComponent(DragTileComponent);
    s.tick();

    const handle = (fixture.nativeElement as HTMLElement).querySelector('div') as HTMLElement;

    try {
      pointer('pointerdown', handle, 0);
      pointer('pointermove', document, 40);
      s.tick();

      expect(style.userSelect).toBe('none');
      expect(style.webkitUserSelect).toBe('none');

      pointer('pointerup', document, 40);
      s.tick();

      expect(fixture.componentInstance.ended).toBe(1);
      expect(style.userSelect).toBe('text');
      expect(style.webkitUserSelect).toBe('auto');
    } finally {
      fixture.destroy();
      style.userSelect = '';
      style.webkitUserSelect = '';
    }
  });
});
