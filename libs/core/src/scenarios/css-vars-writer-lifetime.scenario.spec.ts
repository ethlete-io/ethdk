import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { writeViewportSizeToCssVariables } from '../index';
import { useScenario } from './harness';

@Component({ selector: 'et-scenario-viewport-writer', template: '' })
class ViewportWriterComponent {
  constructor() {
    writeViewportSizeToCssVariables();
  }
}

const installFakeResizeObserver = () => {
  const globals = globalThis as { ResizeObserver?: typeof ResizeObserver };
  const original = globals.ResizeObserver;
  const observed = new Map<Element, ResizeObserverCallback>();

  class FakeResizeObserver {
    constructor(private readonly callback: ResizeObserverCallback) {}
    observe(target: Element) {
      observed.set(target, this.callback);
    }
    unobserve(target: Element) {
      observed.delete(target);
    }
    disconnect() {
      observed.clear();
    }
  }

  globals.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;

  return {
    resize: (target: Element) => observed.get(target)?.([{ target } as ResizeObserverEntry], {} as ResizeObserver),
    restore: () => {
      if (original) globals.ResizeObserver = original;
      else delete globals.ResizeObserver;
    },
  };
};

const sizeDocumentElement = (width: number, height: number) =>
  vi
    .spyOn(document.documentElement, 'getBoundingClientRect')
    .mockReturnValue(DOMRect.fromRect({ x: 0, y: 0, width, height }));

describe('css-vars writer lifetime scenarios', () => {
  let resizeObserver: ReturnType<typeof installFakeResizeObserver>;

  beforeEach(() => (resizeObserver = installFakeResizeObserver()));
  afterEach(() => {
    resizeObserver.restore();
    vi.restoreAllMocks();
    document.documentElement.style.removeProperty('--et-vw');
    document.documentElement.style.removeProperty('--et-vh');
  });

  const scenario = useScenario();

  it('keeps the viewport variables in step after the component that started the writer is destroyed', () => {
    const s = scenario();
    const html = document.documentElement;

    sizeDocumentElement(800, 600);

    const first = TestBed.createComponent(ViewportWriterComponent);
    s.flush();

    expect(html.style.getPropertyValue('--et-vw')).toBe('800px');

    first.destroy();

    const second = TestBed.createComponent(ViewportWriterComponent);
    s.flush();

    sizeDocumentElement(400, 300);
    resizeObserver.resize(html);
    s.flush();

    expect(html.style.getPropertyValue('--et-vw')).toBe('400px');
    expect(html.style.getPropertyValue('--et-vh')).toBe('300px');

    second.destroy();
  });
});
