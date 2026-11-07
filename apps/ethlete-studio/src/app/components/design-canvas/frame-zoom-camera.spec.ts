import { signal } from '@angular/core';
import { frameZoomCamera, FrameZoomOpening } from './frame-zoom-camera';

const elementAt = (left: number, size: { scrollWidth: number; offsetHeight: number; clientWidth: number }) => {
  const element = document.createElement('div');

  element.getBoundingClientRect = () => new DOMRect(left, 0, size.clientWidth, 600);
  Object.defineProperty(element, 'scrollWidth', { value: size.scrollWidth });
  Object.defineProperty(element, 'offsetHeight', { value: size.offsetHeight });
  Object.defineProperty(element, 'clientWidth', { value: size.clientWidth });
  Object.defineProperty(element, 'clientHeight', { value: 600 });

  return element;
};

const VIEW = { scrollWidth: 0, offsetHeight: 0, clientWidth: 1000 };
const CONTENT = { scrollWidth: 1300, offsetHeight: 900, clientWidth: 1300 };

describe('frameZoomCamera', () => {
  it('keeps the opening camera inside the content', () => {
    const camera = frameZoomCamera(() => ({ x: 120, y: -2000, zoom: 1 }));

    camera.measure(elementAt(300, VIEW), elementAt(0, CONTENT));

    expect(camera.pan()).toEqual({ x: 0, y: -300 });
  });

  it('follows the viewport when its left edge moves, past the content edge', () => {
    const camera = frameZoomCamera(() => ({ x: 0, y: 0, zoom: 'fit' }));
    const content = elementAt(0, CONTENT);

    camera.measure(elementAt(344, VIEW), content);
    camera.move({ x: -60, y: -90, zoom: 1.2 }, 1);
    camera.measure(elementAt(84, { ...VIEW, clientWidth: 1260 }), content);

    expect(camera.pan()).toEqual({ x: 200, y: -90 });
    expect(camera.zoom()).toBe(1.2);
    expect(camera.transform()).toBe('translate(200px, -90px) scale(1)');
  });

  it('stays at fit when the left edge moves and when a pan keeps the shown zoom', () => {
    const camera = frameZoomCamera(() => ({ x: 0, y: 0, zoom: 'fit' }));
    const content = elementAt(0, CONTENT);

    camera.measure(elementAt(344, VIEW), content);
    camera.move({ x: -40, y: 0, zoom: 0.5 }, 0.5);
    camera.measure(elementAt(84, VIEW), content);

    expect(camera.zoom()).toBe('fit');
    expect(camera.pan()).toEqual({ x: -40, y: 0 });
  });

  it('opens again when the opening changes', () => {
    const opening = signal<FrameZoomOpening>({ x: 0, y: 0, zoom: 1 });
    const camera = frameZoomCamera(opening);

    camera.move({ x: 50, y: 50, zoom: 2 }, 1);
    opening.set({ x: -10, y: -10, zoom: 0.5 });
    camera.measure(elementAt(0, VIEW), elementAt(0, CONTENT));

    expect(camera.pan()).toEqual({ x: -10, y: -10 });
    expect(camera.zoom()).toBe(0.5);
  });
});
