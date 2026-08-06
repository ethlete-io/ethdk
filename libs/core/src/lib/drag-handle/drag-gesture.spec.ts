import { DragGestureEvent, dragGestureFrom } from './drag-gesture';

const pointer = (type: string, x: number, y: number, pointerId = 1) => {
  const event = new PointerEvent(type, { clientX: x, clientY: y, pointerId, bubbles: true });

  document.dispatchEvent(event);
};

describe('dragGestureFrom', () => {
  let element: HTMLElement;
  let seen: DragGestureEvent['type'][];

  const start = (x = 0, y = 0) => {
    seen = [];
    const down = new PointerEvent('pointerdown', { clientX: x, clientY: y, pointerId: 1, bubbles: true });

    dragGestureFrom(down, element).subscribe((event) => seen.push(event.type));
  };

  beforeEach(() => {
    element = document.createElement('div');
    document.body.append(element);
    element.setPointerCapture = () => undefined;
  });

  afterEach(() => element.remove());

  it('ends a released drag with `end`', () => {
    start();
    pointer('pointermove', 40, 0);
    pointer('pointerup', 40, 0);

    expect(seen).toEqual(['start', 'move', 'end']);
  });

  it('ends a drag the browser took away with `cancelled`, not `end`', () => {
    start();
    pointer('pointermove', 40, 0);
    pointer('pointercancel', 40, 0);

    expect(seen).toEqual(['start', 'move', 'cancelled']);
  });

  it('reports a release below the commit threshold as a tap', () => {
    start();
    pointer('pointermove', 2, 0);
    pointer('pointerup', 2, 0);

    expect(seen).toEqual(['tapped']);
  });

  it('does not report a cancelled press as a tap - the user never completed it', () => {
    start();
    pointer('pointermove', 2, 0);
    pointer('pointercancel', 2, 0);

    expect(seen).toEqual(['cancelled']);
  });

  it('ignores a cancel belonging to another pointer', () => {
    start();
    pointer('pointermove', 40, 0);
    pointer('pointercancel', 0, 0, 2);
    pointer('pointerup', 40, 0);

    expect(seen).toEqual(['start', 'move', 'end']);
  });
});
