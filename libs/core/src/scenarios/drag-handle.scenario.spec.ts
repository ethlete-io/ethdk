import { Component, Directive } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DragHandleDirective, provideDragHandleDefaults } from '../index';
import { useScenario } from './harness';

@Component({
  selector: 'et-scenario-drag-tile',
  imports: [DragHandleDirective],
  template: '<div etDragHandle (dragEnded)="ended = ended + 1">Drag me</div>',
})
class DragTileComponent {
  ended = 0;
}

@Component({
  selector: 'et-scenario-hold-tile',
  imports: [DragHandleDirective],
  template: `<div
    (dragStarted)="started = started + 1"
    (dragEnded)="ended = ended + 1"
    (dragCancelled)="cancelled = cancelled + 1"
    etDragHandle
    touchHoldDelay="250"
  >
    Hold me
  </div>`,
})
class HoldTileComponent {
  started = 0;
  ended = 0;
  cancelled = 0;
}

@Directive({
  selector: '[etScenarioHoldingTile]',
  hostDirectives: [DragHandleDirective],
  providers: [provideDragHandleDefaults({ touchHoldDelay: 250 })],
})
class HoldingTileDirective {}

@Component({
  selector: 'et-scenario-holding-tile',
  imports: [HoldingTileDirective, DragHandleDirective],
  template: `<div class="tile" etScenarioHoldingTile><span class="inner" etDragHandle>Grip</span></div>`,
})
class HoldingTileComponent {}

const pointer = (type: string, target: EventTarget, x: number, pointerType = 'mouse') =>
  target.dispatchEvent(
    new PointerEvent(type, { clientX: x, clientY: 0, pointerId: 1, button: 0, bubbles: true, pointerType }),
  );

const touchMove = () => {
  const event = new Event('touchmove', { bubbles: true, cancelable: true });

  document.dispatchEvent(event);

  return event.defaultPrevented;
};

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

  it('applies a host default only to the drag handle on its own element', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(HoldingTileComponent);
    s.tick();

    const host = fixture.nativeElement as HTMLElement;

    expect((host.querySelector('.tile') as HTMLElement).style.touchAction).toBe('manipulation');
    expect((host.querySelector('.inner') as HTMLElement).style.touchAction).toBe('none');

    fixture.destroy();
  });

  describe('with a touch hold delay', () => {
    const holdTile = () => {
      const fixture = TestBed.createComponent(HoldTileComponent);
      const handle = (fixture.nativeElement as HTMLElement).querySelector('div') as HTMLElement;

      return { fixture, handle, tile: fixture.componentInstance };
    };

    it('lets the page pan until the hold commits', () => {
      const s = scenario();
      const { fixture, handle } = holdTile();
      s.tick();

      expect(handle.style.touchAction).toBe('manipulation');

      fixture.destroy();
    });

    it('leaves a touch that moves before the hold to the browser', () => {
      const s = scenario();
      const { fixture, handle, tile } = holdTile();
      s.tick();

      pointer('pointerdown', handle, 0, 'touch');
      pointer('pointermove', document, 20, 'touch');
      s.tick(300);

      expect(tile.started).toBe(0);
      expect(tile.cancelled).toBe(1);
      expect(touchMove()).toBe(false);

      fixture.destroy();
    });

    it('drags a touch that held still, and blocks scrolling only while it drags', () => {
      const s = scenario();
      const { fixture, handle, tile } = holdTile();
      s.tick();

      pointer('pointerdown', handle, 0, 'touch');
      s.tick(260);

      expect(tile.started).toBe(1);
      expect(touchMove()).toBe(true);

      pointer('pointermove', document, 40, 'touch');
      pointer('pointerup', document, 40, 'touch');
      s.tick();

      expect(tile.ended).toBe(1);
      expect(touchMove()).toBe(false);

      fixture.destroy();
    });

    it('drags a mouse at once', () => {
      const s = scenario();
      const { fixture, handle, tile } = holdTile();
      s.tick();

      pointer('pointerdown', handle, 0);
      pointer('pointermove', document, 20);
      s.tick();

      expect(tile.started).toBe(1);

      pointer('pointerup', document, 20);
      s.tick();
      fixture.destroy();
    });
  });
});
