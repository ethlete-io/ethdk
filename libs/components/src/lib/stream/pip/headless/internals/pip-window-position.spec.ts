import { ElementRef, Injector, OutputEmitterRef, runInInjectionContext, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DragHandleDirective, ResizeHandlesComponent, ResizeMoveEvent } from '@ethlete/core';
import '../../../../../test-helpers';
import { PipWindowParamsDirective } from '../pip-window-params.directive';
import { createPipWindowPosition } from './pip-window-position';
import { createPipWindowSize } from './pip-window-size';

const VIEWPORT_W = 1000;
const VIEWPORT_H = 800;
const PAD = 8;
const PEEK = 40;
const TITLE_BAR_H = 32;

const build = ({ left, top }: { left: number; top: number }) => {
  const host = document.createElement('div');
  const box = { left, top, width: 0, height: 0 };

  vi.spyOn(host, 'getBoundingClientRect').mockImplementation(
    () =>
      ({
        ...box,
        right: box.left + box.width,
        bottom: box.top + box.height,
      }) as DOMRect,
  );

  const params = {
    aspectRatio: signal(16 / 9),
    minWidth: signal(200),
    maxWidth: signal(640),
    desiredSize: signal(320),
    collapsePeek: signal(PEEK),
    viewportPadding: signal(PAD),
  } as unknown as PipWindowParamsDirective;

  const resizeStarted = new OutputEmitterRef<void>();
  const resizeMoved = new OutputEmitterRef<ResizeMoveEvent>();
  const resizeEnded = new OutputEmitterRef<void>();
  const resizeCancelled = new OutputEmitterRef<void>();
  const resizeHandles = signal({
    isResizing: signal(false),
    resizeStarted,
    resizeMoved,
    resizeEnded,
    resizeCancelled,
  } as unknown as ResizeHandlesComponent);
  const dragHandle = signal({
    isDragging: signal(false),
    dragStarted: new OutputEmitterRef<void>(),
    dragMoved: new OutputEmitterRef<never>(),
    dragEnded: new OutputEmitterRef<void>(),
    dragCancelled: new OutputEmitterRef<void>(),
    dragTapped: new OutputEmitterRef<void>(),
  } as unknown as DragHandleDirective);

  const injector = Injector.create({
    parent: TestBed.inject(Injector),
    providers: [{ provide: ElementRef, useValue: new ElementRef(host) }],
  });

  const { position, size } = runInInjectionContext(injector, () => {
    const titleBarH = signal(TITLE_BAR_H);
    const size = createPipWindowSize({ params, titleBarH });
    const position = createPipWindowPosition({
      params,
      titleBarH,
      size,
      resizeHandles,
      dragHandle,
      holdTitleBar: () => () => undefined,
    });

    return { position, size };
  });

  const place = () => {
    position.initPosition();
    box.width = size.get().w ?? 0;
    box.height = size.get().h ?? 0;
    TestBed.tick();
  };

  const moveTo = (x: number, y: number) => {
    box.left = x;
    box.top = y;
  };

  const resize = (move: ResizeMoveEvent) => {
    resizeStarted.emit();
    resizeMoved.emit(move);
  };

  const endResize = () => resizeEnded.emit();

  const setViewport = (width: number, height: number) => {
    window.innerWidth = width;
    window.innerHeight = height;
    window.dispatchEvent(new Event('resize'));
    TestBed.tick();
  };

  return { box, position, size, place, moveTo, resize, endResize, setViewport };
};

const setup = (start: { left: number; top: number }) => TestBed.runInInjectionContext(() => build(start));

describe('pip window position', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.innerWidth = VIEWPORT_W;
    window.innerHeight = VIEWPORT_H;
    vi.spyOn(document.documentElement, 'clientWidth', 'get').mockReturnValue(VIEWPORT_W);
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(VIEWPORT_H);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('sizes the window from the desired size and the aspect ratio', () => {
    const { place, size } = setup({ left: 100, top: 100 });

    place();

    expect(size.get()).toEqual({ w: 320, h: TITLE_BAR_H + 180 });
  });

  it('collapses a window dragged mostly off the left edge so only the peek stays visible', () => {
    const { place, moveTo, position } = setup({ left: 100, top: 100 });

    place();
    moveTo(-200, 100);
    position.checkAndCollapse();

    expect(position.isCollapsed()).toBe(true);
    expect(position.position()).toBe(`${100 + (PEEK - 120)}px 100px`);
  });

  it('collapses on the axis it is furthest off when dragged past the bottom edge', () => {
    const { place, moveTo, position } = setup({ left: 100, top: 100 });

    place();
    moveTo(100, 740);
    position.checkAndCollapse();

    expect(position.isCollapsed()).toBe(true);
    expect(position.position()).toBe(`100px ${100 + (VIEWPORT_H - PEEK - 740)}px`);
  });

  it('pulls a window that is only slightly off screen back inside the padding without collapsing', () => {
    const { place, moveTo, position } = setup({ left: 100, top: 100 });

    place();
    moveTo(-40, 100);
    position.checkAndCollapse();

    expect(position.isCollapsed()).toBe(false);
    expect(position.position()).toBe(`${100 + PAD + 40}px 100px`);
  });

  it('grows by the drag delta when resizing from the east edge and keeps the window on the aspect ratio', () => {
    const { place, resize, size } = setup({ left: 100, top: 100 });

    place();
    resize({ edge: 'e', dx: 80, dy: 0 } as ResizeMoveEvent);

    expect(size.get().w).toBe(400);
    expect(size.get().h).toBeCloseTo(TITLE_BAR_H + 400 / (16 / 9));
  });

  it('keeps the east edge fixed when resizing from the west edge', () => {
    const { place, resize, position } = setup({ left: 300, top: 100 });

    place();
    resize({ edge: 'w', dx: -80, dy: 0 } as ResizeMoveEvent);

    expect(position.position()).toBe('220px 100px');
  });

  it('keeps the bottom edge fixed when resizing from a north corner', () => {
    const { place, resize, position, size } = setup({ left: 300, top: 300 });

    place();
    resize({ edge: 'nw', dx: -80, dy: -45 } as ResizeMoveEvent);

    const { h } = size.get();

    expect(h).toBeCloseTo(TITLE_BAR_H + 400 / (16 / 9));
    expect(position.position()).toBe(`220px ${300 + TITLE_BAR_H + 180 - (h ?? 0)}px`);
  });

  it('centres the window when resizing from the south edge alone', () => {
    const { place, resize, position } = setup({ left: 300, top: 100 });

    place();
    resize({ edge: 's', dx: 0, dy: 90 } as ResizeMoveEvent);

    expect(position.position()).toBe(`${300 + (320 - 480) / 2}px 100px`);
  });

  it('drops the resize preview when the gesture ends', () => {
    const { place, resize, endResize, size } = setup({ left: 100, top: 100 });

    place();
    resize({ edge: 'e', dx: 80, dy: 0 } as ResizeMoveEvent);
    endResize();

    expect(size.get().w).toBe(320);
  });

  it('ignores a resize from an edge that only moves north', () => {
    const { place, resize, size } = setup({ left: 300, top: 100 });

    place();
    resize({ edge: 'n', dx: -50, dy: -50 } as ResizeMoveEvent);

    expect(size.get().w).toBe(320);
  });

  it('never resizes below the minimum width', () => {
    const { place, resize, size } = setup({ left: 300, top: 100 });

    place();
    resize({ edge: 'e', dx: -500, dy: 0 } as ResizeMoveEvent);

    expect(size.get().w).toBe(200);
  });

  it('stays glued to the right edge when the viewport grows', () => {
    const { place, setViewport, position } = setup({ left: VIEWPORT_W - PAD - 320, top: 100 });

    place();
    setViewport(1200, VIEWPORT_H);

    expect(position.position()).toBe(`${1200 - PAD - 320}px 100px`);
  });

  it('stays glued to the bottom edge when the viewport grows', () => {
    const { place, setViewport, position } = setup({ left: 100, top: VIEWPORT_H - PAD - 212 });

    place();
    setViewport(VIEWPORT_W, 1000);

    expect(position.position()).toBe(`100px ${1000 - PAD - 212}px`);
  });

  it('clamps a floating window into a shrunken viewport', () => {
    const { place, setViewport, position } = setup({ left: 100, top: 100 });

    place();
    setViewport(350, VIEWPORT_H);

    expect(position.position()).toBe(`${350 - PAD - 320}px 100px`);
  });
});
