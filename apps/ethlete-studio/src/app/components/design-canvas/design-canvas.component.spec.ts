import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideColorThemesWithTailwind4 } from '@ethlete/core';
import { THEMES } from '../../../themes';
import { rememberedView } from '../../studio-view/remembered';
import { ListedCall } from '../../../host/design';
import { callFramesOf } from '../../system-view/system-tree';
import { CanvasFrame, SCHEME_GAP, SIDE_BY_SIDE_MAX_WIDTH } from './canvas-frame';
import { DesignCanvasComponent } from './design-canvas.component';
import { CanvasFrameComponent } from './partials/canvas-frame.component';

const FITTED: CanvasFrame = { id: 'default', src: 'about:blank', label: 'default', error: 'not drawn in jsdom' };

const LEGACY_CALL: ListedCall = {
  slug: 'acme/components/button',
  project: 'acme',
  eyebrow: 'Button',
  headline: 'Which button?',
  stage: 'component',
  legacy: true,
  transferred: false,
  closed: null,
  frameWidth: 960,
  variants: [{ key: 'a', name: 'Solid' }],
};

const render = async (frames: CanvasFrame[]) => {
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection(), ...provideColorThemesWithTailwind4(THEMES)],
  });

  const fixture: ComponentFixture<DesignCanvasComponent> = TestBed.createComponent(DesignCanvasComponent);

  fixture.componentRef.setInput('frames', frames);
  fixture.componentRef.setInput('cameraKey', 'acme components/button');
  await fixture.whenStable();

  return fixture;
};

const frameElement = (fixture: ComponentFixture<DesignCanvasComponent>) =>
  fixture.debugElement.query(By.directive(CanvasFrameComponent));

describe('DesignCanvasComponent', () => {
  beforeEach(() => localStorage.clear());

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('is a focusable region named like the canvas viewport part', async () => {
    const fixture = await render([FITTED]);
    const host: HTMLElement = fixture.nativeElement;

    expect(host.getAttribute('tabindex')).toBe('0');
    expect(host.getAttribute('aria-label')).toBe('Design Canvas');
  });

  it('leaves Space alone on a button inside the canvas', async () => {
    const fixture = await render([FITTED]);
    const button = document.createElement('button');

    (fixture.nativeElement as HTMLElement).appendChild(button);

    const onButton = new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true, cancelable: true });

    button.dispatchEvent(onButton);
    expect(onButton.defaultPrevented).toBe(false);

    const onCanvas = new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true, cancelable: true });

    fixture.nativeElement.dispatchEvent(onCanvas);
    expect(onCanvas.defaultPrevented).toBe(true);
    button.remove();
  });

  it('asks for the pictures of a switched-to view at high priority, and leaves the first view to the browser', async () => {
    const shotFrame = (part: string): CanvasFrame => ({
      id: part,
      src: 'about:blank',
      label: part,
      width: 390,
      height: 600,
      screenshot: `http://localhost/__design/shot?part=${part}&priority=low`,
    });
    const fixture = await render([shotFrame('system')]);
    const priorities = () =>
      [...(fixture.nativeElement as HTMLElement).querySelectorAll('img[src*="/__design/shot?"]')].map((img) =>
        img.getAttribute('fetchpriority'),
      );

    expect(priorities()).toEqual([null]);

    fixture.componentRef.setInput('frames', [shotFrame('icons')]);
    fixture.componentRef.setInput('cameraKey', 'acme foundations/icons');
    await fixture.whenStable();

    expect(priorities()).toEqual(['high']);
  });

  it('draws no row label beside a frame row', async () => {
    const fixture = await render([
      { id: 'default 640', src: 'about:blank', label: 'button', row: 'default', width: 640 },
    ]);

    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('default');
  });

  it('hides a fitted frame until its size is known', async () => {
    const fixture = await render([FITTED]);
    const frame = frameElement(fixture);

    expect(frame.nativeElement.hasAttribute('data-unsized')).toBe(true);

    (frame.componentInstance as CanvasFrameComponent).widthChange.emit(150);
    (frame.componentInstance as CanvasFrameComponent).heightChange.emit(70);
    await fixture.whenStable();

    expect(frame.nativeElement.hasAttribute('data-unsized')).toBe(false);
    expect(frame.nativeElement.style.width).toBe('150px');
    expect(frame.nativeElement.style.height).toBe('70px');
  });

  it('remembers the measured size and places the frame by it after a reload', async () => {
    const fixture = await render([FITTED]);
    const frame = frameElement(fixture).componentInstance as CanvasFrameComponent;

    vi.useFakeTimers();

    frame.widthChange.emit(150);
    frame.heightChange.emit(70);
    vi.advanceTimersByTime(500);

    expect(rememberedView().measuredSizes).toEqual({ 'acme components/button default': { width: 150, height: 70 } });

    fixture.destroy();
    TestBed.resetTestingModule();
    vi.useRealTimers();

    const reloaded = frameElement(await render([FITTED])).nativeElement as HTMLElement;

    expect(reloaded.hasAttribute('data-unsized')).toBe(false);
    expect(reloaded.style.width).toBe('150px');
    expect(reloaded.style.height).toBe('70px');
  });

  it('zooms to 100 % at the opening place of the frames, wherever the camera was', async () => {
    const fixture = await render([
      { id: 'default 640', src: 'about:blank', label: 'button', row: 'default', width: 640 },
    ]);
    const canvas = fixture.componentInstance;

    canvas.camera.set({ x: -500, y: -300, zoom: 0.5 });
    await fixture.whenStable();
    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('[aria-label="Auf 100 % zoomen"]')?.click();

    expect(canvas.camera()).toEqual({ x: 40, y: 48, zoom: 1 });
  });

  it('opens at a restored camera before any frame has a size, and shows its zoom in the chip', async () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);

    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), ...provideColorThemesWithTailwind4(THEMES)],
    });

    const fixture = TestBed.createComponent(DesignCanvasComponent);

    fixture.componentRef.setInput('restoredCamera', { x: 12, y: 8, zoom: 2.5 });
    fixture.componentRef.setInput('cameraKey', 'acme components/button');
    await fixture.whenStable();

    expect(fixture.componentInstance.camera()).toEqual({ x: 12, y: 8, zoom: 2.5 });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('250');
  });

  it('reports a camera the user moved, and a fit as no camera to keep', async () => {
    const fixture = await render([FITTED]);
    const canvas = fixture.componentInstance;
    const reported: unknown[] = [];

    vi.useFakeTimers();
    canvas.cameraChange.subscribe((camera) => reported.push(camera));
    canvas.camera.set({ x: 5, y: -900, zoom: 0.2 });
    vi.advanceTimersByTime(400);
    expect(reported).toEqual([]);

    canvas['zoomBy'](2);
    vi.advanceTimersByTime(400);
    expect(reported).toEqual([{ x: 10, y: -1800, zoom: 0.4 }]);

    canvas.fitAll();
    vi.advanceTimersByTime(400);
    expect(reported.at(-1)).toBeNull();
  });

  describe('when the canvas width changes', () => {
    const setup = async () => {
      const size = { width: 1200, height: 1000, panel: 320 };
      const resized: (() => void)[] = [];
      let host: unknown = null;

      vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
        return this === host ? size.width : 0;
      });
      vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
        return this.matches('[class*="--st-shell-inset-left"]') ? size.panel : 0;
      });
      vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) {
        return this === host ? size.height : 0;
      });
      vi.stubGlobal(
        'ResizeObserver',
        class {
          constructor(callback: ResizeObserverCallback) {
            resized.push(() => callback([{ target: this.target } as ResizeObserverEntry], this as never));
          }
          private target: Element | null = null;
          observe(target: Element) {
            this.target = target;
          }
          disconnect() {
            return undefined;
          }
        },
      );

      const fixture = await render([{ ...FITTED, id: 'a', width: 1000, height: 600 }]);

      host = fixture.nativeElement;
      resized.forEach((resize) => resize());
      await fixture.whenStable();

      const resizeTo = async (width: number) => {
        size.width = width;
        resized.forEach((resize) => resize());
        await fixture.whenStable();
      };

      const hidePanel = async () => {
        size.panel = 0;
        resized.forEach((resize) => resize());
        await fixture.whenStable();
      };

      return { fixture, canvas: fixture.componentInstance, resizeTo, hidePanel };
    };

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    it('opens at 100 % with the frames at the panel edge plus the opening padding', async () => {
      const { canvas, resizeTo } = await setup();

      expect(canvas.camera()).toEqual({ x: 360, y: 48, zoom: 1 });

      await resizeTo(600);

      expect(canvas.camera()).toEqual({ x: 360, y: 48, zoom: 1 });
    });

    it('keeps the frames in place when the panel hides', async () => {
      const { canvas, hidePanel } = await setup();

      await hidePanel();

      expect(canvas.camera()).toEqual({ x: 360, y: 48, zoom: 1 });
    });

    it('keeps the opening camera when the canvas resizes', async () => {
      const { canvas, resizeTo, hidePanel } = await setup();

      const opened = canvas.camera();

      await resizeTo(600);
      await hidePanel();
      await resizeTo(1500);

      expect(canvas.camera()).toEqual(opened);
    });

    it('shifts the camera by the move of its left edge, so the frames keep their screen position', async () => {
      const { fixture, canvas, resizeTo } = await setup();

      const opened = canvas.camera();
      const left = { value: 0 };
      const host = fixture.nativeElement as HTMLElement;

      vi.spyOn(host, 'getBoundingClientRect').mockImplementation(() => new DOMRect(left.value, 0, 1200, 1000));
      left.value = 320;
      await resizeTo(880);

      expect(canvas.camera()).toEqual({ ...opened, x: opened.x - 320 });

      left.value = 0;
      await resizeTo(1200);

      expect(canvas.camera()).toEqual(opened);
    });

    it('fits the view again while it is still fitted', async () => {
      const { canvas, resizeTo } = await setup();

      canvas.fitAll();
      const before = canvas.camera().zoom;

      await resizeTo(600);

      expect(canvas.camera().zoom).toBeLessThan(before);
    });

    it('keeps the zoom the user set, and fits again after a fit', async () => {
      const { canvas, resizeTo } = await setup();

      canvas['zoomBy'](0.5);
      const zoomed = canvas.camera();

      await resizeTo(600);

      expect(canvas.camera()).toEqual(zoomed);

      canvas.fitAll();
      const fitted = canvas.camera().zoom;

      await resizeTo(300);

      expect(canvas.camera().zoom).toBeLessThan(fitted);
    });
  });

  it('keeps a focused frame in view when the canvas shrinks, until the user moves the camera', async () => {
    const size = { width: 1200, height: 1000 };
    const resized: (() => void)[] = [];
    let host: unknown = null;

    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this === host ? size.width : 0;
    });
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) {
      return this === host ? size.height : 0;
    });
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          resized.push(() => callback([{ target: this.target } as ResizeObserverEntry], this as never));
        }
        private target: Element | null = null;
        observe(target: Element) {
          this.target = target;
        }
        disconnect() {
          return undefined;
        }
      },
    );

    const fixture = await render([
      { ...FITTED, id: 'a', width: 390, height: 600 },
      { ...FITTED, id: 'b', width: 390, height: 600 },
    ]);
    const canvas = fixture.componentInstance;

    host = fixture.nativeElement;
    resized.forEach((resize) => resize());
    await fixture.whenStable();

    const shrink = async (height: number) => {
      size.height = height;
      resized.forEach((resize) => resize());
      await fixture.whenStable();
    };
    const bottomOf = (id: string) => {
      const placed = canvas['framesById']().get(id);
      const { y, zoom } = canvas.camera();

      return placed ? y + (placed.y + placed.height) * zoom : NaN;
    };

    canvas['zoomBy'](1);
    canvas.camera.set({ x: -5000, y: -5000, zoom: 1 });
    canvas.focusFrame('b');

    expect(bottomOf('b')).toBeGreaterThan(500);

    await shrink(500);

    expect(bottomOf('b')).toBeLessThanOrEqual(500);

    canvas['zoomBy'](2);
    const moved = canvas.camera();

    await shrink(400);

    expect(canvas.camera()).toEqual(moved);
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('sizes a fitted frame by its measured content, whatever size an older Studio stored for it', async () => {
    localStorage.setItem(
      'ethlete-studio.call-view',
      JSON.stringify({
        frameSizes: { 'acme components/button default': { width: 160, height: 80 } },
        measuredSizes: { 'acme components/button default': { width: 100, height: 68 } },
      }),
    );

    const fixture = await render([FITTED]);
    const frame = frameElement(fixture).nativeElement as HTMLElement;

    expect(frame.style.width).toBe('100px');
    expect(frame.style.height).toBe('68px');

    frameElement(fixture).triggerEventHandler('dblclick', new MouseEvent('dblclick'));
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('et-resize-handles')).toBeNull();
  });

  it('sets a state group of fitted matrix rows apart by twice the row gap', async () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), ...provideColorThemesWithTailwind4(THEMES)],
    });

    const fixture = TestBed.createComponent(DesignCanvasComponent);
    const cell = (row: string, group: string): CanvasFrame => ({
      ...FITTED,
      id: row,
      row,
      rowGroup: group,
      column: 'current',
    });

    fixture.componentRef.setInput('frames', [
      cell('solid · rest', 'solid'),
      cell('solid · hover', 'solid'),
      cell('outline · rest', 'outline'),
    ]);
    fixture.componentRef.setInput('arrangement', 'matrix');
    fixture.componentRef.setInput('columns', [{ key: 'current', label: 'current' }]);
    await fixture.whenStable();

    const [rest, hover, outline] = fixture.debugElement
      .queryAll(By.directive(CanvasFrameComponent))
      .map((frame) => frame.nativeElement as HTMLElement);
    const gapBelow = (above: HTMLElement | undefined, below: HTMLElement | undefined) =>
      parseFloat(below?.style.top ?? '') - parseFloat(above?.style.top ?? '') - parseFloat(above?.style.height ?? '');

    expect(gapBelow(rest, hover)).toBe(48);
    expect(gapBelow(hover, outline)).toBe(96);
  });

  it('dims a pending frame under its label', async () => {
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), ...provideColorThemesWithTailwind4(THEMES)],
    });

    const fixture = TestBed.createComponent(DesignCanvasComponent);
    const cell = (column: string, row: string, pending?: string): CanvasFrame => ({
      ...FITTED,
      id: `${column} ${row}`,
      row,
      column,
      width: 200,
      height: 100,
      ...(pending ? { pending } : {}),
    });

    fixture.componentRef.setInput('frames', [cell('c', 'default', 'Still drawing'), cell('a', 'default')]);
    fixture.componentRef.setInput('arrangement', 'matrix');
    fixture.componentRef.setInput('columns', [
      { key: 'c', label: 'c' },
      { key: 'a', label: 'a' },
    ]);
    await fixture.whenStable();

    const [drawn, other] = fixture.debugElement
      .queryAll(By.directive(CanvasFrameComponent))
      .map((frame) => frame.nativeElement as HTMLElement);

    expect(drawn?.hasAttribute('data-pending')).toBe(true);
    expect(drawn?.querySelector('[data-frame-pending]')?.textContent?.trim()).toBe('Still drawing');
    expect(other?.querySelector('[data-frame-pending]')).toBeNull();
  });

  it('widens every fitted tile in a matrix column to the widest one, so the right edges line up', async () => {
    localStorage.setItem(
      'ethlete-studio.call-view',
      JSON.stringify({
        measuredSizes: {
          'acme components/button solid': { width: 100, height: 40 },
          'acme components/button outline': { width: 140, height: 40 },
        },
      }),
    );
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), ...provideColorThemesWithTailwind4(THEMES)],
    });

    const fixture = TestBed.createComponent(DesignCanvasComponent);
    const cell = (row: string): CanvasFrame => ({ ...FITTED, id: row, row, column: 'current' });

    fixture.componentRef.setInput('frames', [cell('solid'), cell('outline')]);
    fixture.componentRef.setInput('cameraKey', 'acme components/button');
    fixture.componentRef.setInput('arrangement', 'matrix');
    fixture.componentRef.setInput('columns', [{ key: 'current', label: 'current' }]);
    await fixture.whenStable();

    const rightEdges = fixture.debugElement
      .queryAll(By.directive(CanvasFrameComponent))
      .map(({ nativeElement }) => parseFloat(nativeElement.style.left) + parseFloat(nativeElement.style.width));

    expect(rightEdges).toEqual([140, 140]);
  });

  it('heads a row with its rowHead and draws the frames of a group side by side in one row', async () => {
    const frame = (id: string, row: string, rowHead?: string): CanvasFrame => ({
      ...FITTED,
      id,
      row,
      width: 200,
      height: 100,
      ...(rowHead === undefined ? {} : { rowHead }),
    });
    const fixture = await render([
      frame('a', 'Vergleich', 'Vergleich · 2'),
      frame('b', 'Vergleich', 'Vergleich · 2'),
      frame('c', 'Fehler', 'Fehler · 1'),
    ]);
    const host = fixture.nativeElement as HTMLElement;
    const heads = [...host.querySelectorAll<HTMLElement>('[data-row-head]')];
    const [a, b, c] = fixture.debugElement
      .queryAll(By.directive(CanvasFrameComponent))
      .map((placed) => placed.nativeElement as HTMLElement);

    expect(heads.map((head) => head.textContent?.trim())).toEqual(['Vergleich · 2', 'Fehler · 1']);
    expect(heads.map((head) => head.style.marginTop)).toEqual([a?.style.top, c?.style.top]);
    expect(heads[0]?.className).toContain('top-[calc(-6.4rem*var(--et-design-canvas-label-scale))]');
    expect(b?.style.top).toBe(a?.style.top);
    expect(b?.style.left).not.toBe(a?.style.left);
    expect(c?.style.left).toBe(a?.style.left);
  });

  it('draws no border on a fitted frame, but keeps it on a frame at a width', async () => {
    const fixture = await render([FITTED, { ...FITTED, id: 'wide', width: 320, height: 200 }]);
    const [fitted, wide] = fixture.debugElement
      .queryAll(By.directive(CanvasFrameComponent))
      .map((frame) => frame.nativeElement as HTMLElement);

    expect(fitted?.hasAttribute('data-fitted')).toBe(true);
    expect(wide?.hasAttribute('data-fitted')).toBe(false);
  });

  it('draws the border of every frame but an empty one above its content', async () => {
    const fixture = await render([
      FITTED,
      { ...FITTED, id: 'wide', width: 320, height: 200 },
      { ...FITTED, id: 'empty', width: 320, height: 200, empty: 'Nothing here' },
    ]);
    const frames = () =>
      fixture.debugElement
        .queryAll(By.directive(CanvasFrameComponent))
        .map((frame) => frame.nativeElement as HTMLElement);
    const border = (frame: HTMLElement | undefined) => frame?.querySelector(':scope > [data-frame-border]');

    const [fitted, wide, empty] = frames();

    expect(fitted?.lastElementChild?.hasAttribute('data-frame-border')).toBe(true);
    expect(border(empty)).toBeNull();
    expect(wide?.lastElementChild?.hasAttribute('data-frame-border')).toBe(true);
    expect(border(wide)?.classList).toContain('pointer-events-none');

    fixture.componentInstance.selectedId.set('empty');
    await fixture.whenStable();

    expect(frames()[2]?.lastElementChild?.hasAttribute('data-frame-border')).toBe(true);
  });

  it('sets the text of an empty frame in its own line height, so wrapped lines stay apart at any zoom', async () => {
    const fixture = await render([{ ...FITTED, id: 'empty', width: 390, height: 120, empty: 'every page uses it' }]);
    const cell = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('[data-empty-cell]');

    expect(cell?.classList).toContain('leading-tight');
    expect(cell?.className).toContain('min(var(--et-design-canvas-label-scale),4)');
  });

  describe('a frame in both colour schemes', () => {
    const PAGE: CanvasFrame = {
      id: 'page',
      src: 'about:blank',
      label: 'page',
      width: 390,
      height: 600,
      screenshot: 'http://localhost/__design/shot?part=home',
      schemes: ['light', 'dark'],
      place: { part: 'pages/home', state: 'default', size: 'phone' },
    };

    const copiesOf = (fixture: ComponentFixture<DesignCanvasComponent>) =>
      [...(frameElement(fixture).nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[data-scheme-copy]')].map(
        (copy) => ({
          scheme: copy.dataset['schemeCopy'],
          left: copy.style.left,
          top: copy.style.top,
          shot: copy.querySelector('img')?.getAttribute('src'),
        }),
      );

    const labelsOf = (fixture: ComponentFixture<DesignCanvasComponent>) =>
      [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[data-scheme-label]')]
        .map((label) => [label.textContent?.trim(), label.style.left, label.style.top])
        .sort();

    it('draws a page in the light scheme, then the dark one beside it, each under its label', async () => {
      const fixture = await render([PAGE]);
      const host = frameElement(fixture).nativeElement as HTMLElement;

      expect(host.style.width).toBe(`${390 * 2 + SCHEME_GAP}px`);
      expect(host.style.height).toBe('600px');
      expect(copiesOf(fixture)).toEqual([
        { scheme: 'light', left: '', top: '', shot: 'http://localhost/__design/shot?part=home&scheme=light' },
        {
          scheme: 'dark',
          left: `${390 + SCHEME_GAP}px`,
          top: '0px',
          shot: 'http://localhost/__design/shot?part=home&scheme=dark',
        },
      ]);
      expect(labelsOf(fixture)).toEqual([
        ['Dark', `${390 + SCHEME_GAP}px`, '0px'],
        ['Light', '', ''],
      ]);
    });

    it('stacks the dark scheme below the light one when the two do not fit side by side', async () => {
      const fixture = await render([{ ...PAGE, width: SIDE_BY_SIDE_MAX_WIDTH + 1 }]);
      const host = frameElement(fixture).nativeElement as HTMLElement;

      expect(host.style.width).toBe(`${SIDE_BY_SIDE_MAX_WIDTH + 1}px`);
      expect(host.style.height).toBe(`${600 * 2 + SCHEME_GAP}px`);
      expect(copiesOf(fixture).map(({ scheme, left, top }) => [scheme, left, top])).toEqual([
        ['light', '', ''],
        ['dark', '0px', `${600 + SCHEME_GAP}px`],
      ]);
      expect(labelsOf(fixture)).toEqual([
        ['Dark', '0px', `${600 + SCHEME_GAP}px`],
        ['Light', '', ''],
      ]);
    });

    it('points pins at the light scheme', async () => {
      const fixture = await render([PAGE]);

      fixture.componentRef.setInput('pins', [{ id: 'p', frameId: 'page', label: '1', text: 'one' }]);
      await fixture.whenStable();

      const host = frameElement(fixture).nativeElement as HTMLElement;
      const left = (element: Element | null) =>
        parseFloat((element as HTMLElement | null)?.style.left ?? '') - parseFloat(host.style.left);

      expect(left(fixture.nativeElement.querySelector('[data-comment-pin]')?.parentElement)).toBe(390);
    });

    it('draws a legacy call shot once, without schemes', async () => {
      const fixture = await render(
        callFramesOf({ port: 4402, call: LEGACY_CALL }).map((frame) => ({ ...frame, height: 600 })),
      );
      const host = frameElement(fixture).nativeElement as HTMLElement;

      expect(host.style.width).toBe('960px');
      expect(copiesOf(fixture)).toEqual([]);
      expect(labelsOf(fixture)).toEqual([]);
    });
  });

  it('goes live once the camera rests, on the frames nearest the centre, and keeps them for a while after', async () => {
    const frames = Array.from({ length: 12 }, (_, index) => ({
      ...FITTED,
      id: `f${index}`,
      label: `f${index}`,
      screenshot: `shot-${index}.png`,
      width: 40,
      height: 40,
    }));
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const fixture = await render(frames);
    const canvas = fixture.componentInstance;
    const liveIds = () =>
      fixture.debugElement
        .queryAll(By.directive(CanvasFrameComponent))
        .filter((frame) => (frame.nativeElement as HTMLElement).getAttribute('data-live') === 'true')
        .map((frame) => (frame.componentInstance as CanvasFrameComponent).frame().id);

    const wait = async (ms: number) => {
      TestBed.tick();
      await vi.advanceTimersByTimeAsync(ms);
      TestBed.tick();
      TestBed.tick();
    };

    canvas.camera.set({ x: 0, y: 0, zoom: 0.5 });
    await wait(200);

    expect(liveIds()).toEqual([]);

    await wait(100);

    expect(liveIds()).toEqual(['f0', 'f1', 'f2', 'f3', 'f4', 'f5']);

    canvas.camera.set({ x: 100000, y: 0, zoom: 0.5 });
    await wait(300);

    expect(liveIds()).toHaveLength(6);

    await wait(5000);

    expect(liveIds()).toEqual([]);
  });

  it('makes a double-clicked frame live, marks it, and ends it on Esc from the frame', async () => {
    const frames = [
      { ...FITTED, width: 320, height: 200 },
      { ...FITTED, id: 'other', width: 320, height: 200 },
    ];
    const fixture = await render(frames);
    const [first, second] = fixture.debugElement.queryAll(By.directive(CanvasFrameComponent));
    const isLive = (frame = first) => (frame?.nativeElement as HTMLElement).hasAttribute('data-active');

    first?.triggerEventHandler('dblclick', new MouseEvent('dblclick'));
    await fixture.whenStable();

    expect(isLive()).toBe(true);
    expect(first?.nativeElement.querySelector('[data-live-badge]')).not.toBeNull();

    second?.triggerEventHandler('dblclick', new MouseEvent('dblclick'));
    await fixture.whenStable();

    expect([isLive(first), isLive(second)]).toEqual([false, true]);

    (second?.componentInstance as CanvasFrameComponent).escapeKeydown.emit();
    await fixture.whenStable();

    expect(isLive(second)).toBe(false);
  });

  it('clips and isolates its own paint so no frame can paint outside the pane', async () => {
    const fixture = await render([{ id: 'a', src: 'http://localhost:1/frame.html', label: 'a', width: 320 }]);
    const host = fixture.nativeElement as HTMLElement;

    expect(host.classList).toContain('isolate');
    expect(host.classList).toContain('overflow-hidden');
    expect(host.classList).toContain('contain-paint');
  });

  it('draws the page of a live frame whose height follows its content in the viewport of a shot, clipped to the frame', async () => {
    const frames = [
      { id: 'followed', src: 'http://localhost:1/frame.html', label: 'followed', width: 320 },
      { id: 'sized', src: 'http://localhost:1/frame.html', label: 'sized', width: 390, height: 600 },
    ];
    const fixture = await render(frames);
    const [followed, sized] = fixture.debugElement.queryAll(By.directive(CanvasFrameComponent));

    followed?.triggerEventHandler('dblclick', new MouseEvent('dblclick'));
    await fixture.whenStable();

    const iframeOf = (frame = followed) => (frame?.nativeElement as HTMLElement).querySelector('iframe');

    expect(iframeOf()?.style.minHeight).toBe('800px');
    expect(iframeOf()?.parentElement?.classList).toContain('overflow-hidden');

    sized?.triggerEventHandler('dblclick', new MouseEvent('dblclick'));
    await fixture.whenStable();

    expect(iframeOf(sized)?.style.minHeight).toBe('');
  });

  it('takes no height from the blank document a live iframe loads before its page', async () => {
    const fixture = await render([{ id: 'followed', src: 'about:blank', label: 'followed', width: 320 }]);
    const frame = frameElement(fixture);
    const heights: number[] = [];

    (frame.componentInstance as CanvasFrameComponent).heightChange.subscribe((height) => heights.push(height));
    frame.triggerEventHandler('dblclick', new MouseEvent('dblclick'));
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(heights).toEqual([]);
  });

  it('emits the key of a column group whose switch is clicked, and shows whether it is on', async () => {
    const fixture = await render([{ ...FITTED, id: 'a', column: 'a', width: 390, height: 844 }]);
    const switched: string[] = [];

    fixture.componentInstance.groupSwitch.subscribe((key) => switched.push(key));
    fixture.componentRef.setInput('arrangement', 'matrix');
    fixture.componentRef.setInput('columns', [
      { key: 'a', label: 'a', group: { key: 'round r1', label: 'r1', switch: { label: 'Changed area', on: true } } },
    ]);
    await fixture.whenStable();

    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-group-switch]');

    button?.click();

    expect(button?.textContent?.trim()).toBe('Changed area');
    expect(button?.getAttribute('aria-pressed')).toBe('true');
    expect(switched).toEqual(['round r1']);
    expect(switched).not.toContain('r1');
  });

  it('draws a cropped frame as a small whole page with the crop outlined, above the crop enlarged twice', async () => {
    const crop = { areas: [{ x: 100, y: 200, width: 72, height: 54 }], frame: { width: 1440, height: 900 } };
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), ...provideColorThemesWithTailwind4(THEMES)],
    });

    const fixture = TestBed.createComponent(CanvasFrameComponent);

    fixture.componentRef.setInput('frame', {
      id: 'a',
      src: 'about:blank',
      label: 'a',
      screenshot: 'shot.png',
      crop,
      width: 1440,
      height: 312,
    });
    fixture.componentRef.setInput('width', 1440);
    await fixture.whenStable();

    const frame = fixture.nativeElement as HTMLElement;
    const outline = frame.querySelector<HTMLElement>('[data-crop-outline]');
    const view = frame.querySelector<HTMLElement>('[data-crop-view]');

    expect(frame.querySelector<HTMLElement>('[data-crop-thumb]')?.style.width).toBe('288px');
    expect([outline?.style.left, outline?.style.top, outline?.style.width]).toEqual(['20px', '40px', '14.4px']);
    expect([view?.style.top, view?.style.width, view?.style.height]).toEqual(['204px', '144px', '108px']);
    expect((view?.firstElementChild as HTMLElement | null)?.style.transform).toBe('scale(2) translate(-100px, -200px)');
  });
  describe('on a cropped frame', () => {
    const crop = { areas: [{ x: 100, y: 200, width: 72, height: 54 }], frame: { width: 1440, height: 900 } };
    const cropped: CanvasFrame = {
      ...FITTED,
      id: 'a',
      width: 1440,
      height: 312,
      crop,
      place: { part: 'p', state: 'rest', size: 'fitted' },
    };

    it('places a pin through the crop and a pin outside it on the small whole page', async () => {
      const fixture = await render([cropped]);

      fixture.componentRef.setInput('pins', [
        { id: 'in', frameId: 'a', label: '1', text: 'in', point: { x: 110, y: 210 } },
        { id: 'out', frameId: 'a', label: '2', text: 'out', point: { x: 10, y: 10 } },
      ]);
      await fixture.whenStable();

      const host = fixture.nativeElement as HTMLElement;
      const frame = frameElement(fixture).nativeElement as HTMLElement;
      const pins = [...host.querySelectorAll<HTMLElement>('[data-comment-pin]')];
      const offset = (element: HTMLElement | undefined) => [
        parseFloat(element?.style.left ?? '') - parseFloat(frame.style.left),
        parseFloat(element?.style.top ?? '') - parseFloat(frame.style.top),
      ];

      expect(pins).toHaveLength(2);
      expect(offset(pins[0]?.parentElement ?? undefined)).toEqual([20, 224]);
      expect(offset(pins[1]?.parentElement ?? undefined)).toEqual([2, 2]);
    });
  });

  it('selects the cell clicked in a grid frame, keeps it on a second click, and moves it to another cell', async () => {
    const cell = (id: string) => ({ id, row: 'filled', column: id, label: id, src: 'about:blank', width: 100 });
    const fixture = await render([
      {
        id: 'grid',
        src: '',
        label: 'grid',
        grid: { columns: ['a', 'b'], rows: ['filled'], cells: [cell('a'), cell('b')] },
      },
    ]);
    const host = fixture.nativeElement as HTMLElement;
    const click = (id: string) =>
      host.querySelector(`[data-cell-id="${id}"]`)?.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    click('a');
    expect([fixture.componentInstance.selectedId(), fixture.componentInstance.selectedCellId()]).toEqual(['grid', 'a']);

    click('a');
    expect(fixture.componentInstance.selectedCellId()).toBe('a');

    click('b');
    expect(fixture.componentInstance.selectedCellId()).toBe('b');

    fixture.componentInstance.selectedId.set(null);
    expect(fixture.componentInstance.selectedCellId()).toBeNull();
  });

  it('marks the canvas wheeling during a wheel gesture so the shield also covers the active frame', async () => {
    const fixture = await render([FITTED]);
    const host = fixture.nativeElement as HTMLElement;

    fixture.componentInstance.activate(FITTED.id);
    await fixture.whenStable();
    vi.useFakeTimers();

    const shield = host.querySelector('ethlete-frame-shield');

    expect(shield?.classList.contains('hidden')).toBe(true);
    expect(shield?.className).toContain('group-data-wheeling/canvas:block');

    host.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 40 }));
    fixture.detectChanges();

    expect(host.hasAttribute('data-wheeling')).toBe(true);

    vi.advanceTimersByTime(150);
    host.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaY: 40 }));
    vi.advanceTimersByTime(150);
    fixture.detectChanges();

    expect(host.hasAttribute('data-wheeling')).toBe(true);

    vi.advanceTimersByTime(100);
    fixture.detectChanges();

    expect(host.hasAttribute('data-wheeling')).toBe(false);
  });

  it('selects the cell under a click that lands on the shield over an inactive grid frame', async () => {
    const cell = (id: string) => ({ id, row: 'filled', column: id, label: id, src: 'about:blank', width: 100 });
    const fixture = await render([
      {
        id: 'grid',
        src: '',
        label: 'grid',
        grid: { columns: ['a', 'b'], rows: ['filled'], cells: [cell('a'), cell('b')] },
      },
    ]);
    const host = fixture.nativeElement as HTMLElement;
    const frame = host.querySelector('ethlete-canvas-frame');
    const shield = [...(frame?.children ?? [])].find((child) => child.localName === 'ethlete-frame-shield');
    const cellB = host.querySelector('[data-cell-id="b"]');

    expect(shield).toBeDefined();
    Object.defineProperty(document, 'elementsFromPoint', {
      configurable: true,
      value: (x: number) => (x >= 100 ? [shield, cellB, frame] : [shield, frame]),
    });

    try {
      shield?.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 150, clientY: 20 }));
    } finally {
      Reflect.deleteProperty(document, 'elementsFromPoint');
    }

    expect([fixture.componentInstance.selectedId(), fixture.componentInstance.selectedCellId()]).toEqual(['grid', 'b']);
  });
});
