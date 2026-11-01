import { mountCanvasViewport } from './canvas-viewport';

class SilentResizeObserver {
  public observe() {
    return undefined;
  }

  public disconnect() {
    return undefined;
  }
}

const mount = (covered: number) => {
  vi.stubGlobal('ResizeObserver', SilentResizeObserver);
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: Object.assign(new EventTarget(), { ready: Promise.resolve() }),
  });

  const viewport = document.createElement('div');
  const world = document.createElement('div');

  Object.defineProperty(viewport, 'clientWidth', { value: 1000 });
  Object.defineProperty(viewport, 'clientHeight', { value: 600 });
  Object.defineProperty(world, 'offsetWidth', { value: 400 });
  Object.defineProperty(world, 'offsetHeight', { value: 200 });
  viewport.append(world);

  return mountCanvasViewport({ viewport, world, frameSelector: 'figure', padding: 20, covered: () => covered });
};

describe('mountCanvasViewport', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('starts a fit right of the covered width', () => {
    const open = mount(0);
    const covered = mount(300);

    open.show({ kind: 'all' });
    covered.show({ kind: 'all' });

    expect(covered.camera().x).toBeGreaterThanOrEqual(open.camera().x + 300 - 1);
  });

  it('keeps a 100 % reset right of the covered width', () => {
    const viewport = mount(300);

    viewport.show({ kind: 'visible', zoom: 1 });

    expect(viewport.camera().x).toBeGreaterThanOrEqual(300);
  });
});
