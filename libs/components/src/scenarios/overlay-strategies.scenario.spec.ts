import { Component, EnvironmentInjector, inject } from '@angular/core';
import { injectRenderer } from '@ethlete/core';
import {
  anchoredDialogOverlayStrategy,
  anchoredOverlayStrategy,
  bottomSheetOverlayStrategy,
  buildAnchoredRuntimePositionStrategy,
  centeredOverlayStrategy,
  createOverlayStrategyController,
  dialogOverlayStrategy,
  enableDragToDismiss,
  findNextRelevantHtmlElement,
  fullScreenDialogOverlayStrategy,
  getOriginCoordinatesAndDimensions,
  injectAnchoredDialogStrategy,
  injectAnchoredDialogStrategyDefaults,
  injectBottomSheetStrategy,
  injectBottomSheetStrategyDefaults,
  injectDialogStrategy,
  injectDialogStrategyDefaults,
  injectFullscreenDialogStrategy,
  injectFullscreenDialogStrategyDefaults,
  injectLeftSheetStrategy,
  injectLeftSheetStrategyDefaults,
  injectOverlayManager,
  injectRightSheetStrategy,
  injectRightSheetStrategyDefaults,
  injectTopSheetStrategy,
  injectTopSheetStrategyDefaults,
  isHtmlElement,
  isPointerEvent,
  isTouchEvent,
  leftSheetOverlayStrategy,
  mergeOverlayBreakpointConfigs,
  OVERLAY_CONFIG_CLASS_KEYS,
  OVERLAY_ERROR_CODES,
  OVERLAY_REF,
  OverlayConfig,
  OverlayRef,
  provideAnchoredDialogStrategy,
  provideAnchoredDialogStrategyDefaults,
  provideBottomSheetStrategy,
  provideBottomSheetStrategyDefaults,
  provideDialogStrategy,
  provideDialogStrategyDefaults,
  provideFullscreenDialogStrategy,
  provideFullscreenDialogStrategyDefaults,
  provideLeftSheetStrategy,
  provideLeftSheetStrategyDefaults,
  provideOverlay,
  provideRightSheetStrategy,
  provideRightSheetStrategyDefaults,
  provideTopSheetStrategy,
  provideTopSheetStrategyDefaults,
  rightSheetOverlayStrategy,
  topSheetOverlayStrategy,
  transformingBottomSheetToDialogOverlayStrategy,
  transformingFullScreenDialogToDialogOverlayStrategy,
  transformingFullScreenDialogToRightSheetOverlayStrategy,
} from '../index';
import { Scenario, useScenario } from './harness';

@Component({ selector: 'et-scenario-sheet-content', template: '<p>content</p>' })
class SheetContentComponent {
  ref = inject(OVERLAY_REF);
}

type MediaListener = (event: { matches: boolean; media: string }) => void;

const createFakeViewport = (initialWidth: number) => {
  let width = initialWidth;
  const lists: { media: string; matches: boolean; listeners: Set<MediaListener> }[] = [];
  const evaluate = (media: string) =>
    media.split(' and ').every((part) => {
      const [, feature, value] = /^\(([\w-]+):\s*([\d.]+)px\)$/.exec(part.trim()) ?? [];

      if (feature === 'min-width') return width >= Number(value);
      if (feature === 'max-width') return width <= Number(value);

      return false;
    });

  const matchMedia = (media: string) => {
    const entry = { media, matches: evaluate(media), listeners: new Set<MediaListener>() };

    lists.push(entry);

    return {
      media,
      get matches() {
        return entry.matches;
      },
      addEventListener: (_: 'change', listener: MediaListener) => entry.listeners.add(listener),
      removeEventListener: (_: 'change', listener: MediaListener) => entry.listeners.delete(listener),
    };
  };

  return {
    install: () => {
      Object.defineProperty(window, 'matchMedia', { configurable: true, value: matchMedia });

      return () => Reflect.deleteProperty(window, 'matchMedia');
    },
    resize: (next: number) => {
      width = next;

      for (const entry of lists) {
        const matches = evaluate(entry.media);

        if (matches === entry.matches) continue;

        entry.matches = matches;
        entry.listeners.forEach((listener) => listener({ matches, media: entry.media }));
      }
    },
  };
};

const pointer = (type: string, clientY: number) => {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: 100, clientY, button: 0 });

  Object.defineProperties(event, {
    pointerId: { value: 1 },
    isPrimary: { value: true },
    pointerType: { value: 'touch' },
  });

  return event;
};

const makeDraggable = (pane: HTMLElement) => {
  Object.defineProperty(pane, 'offsetHeight', { configurable: true, value: 400 });
  pane.setPointerCapture = () => undefined;
  pane.releasePointerCapture = () => undefined;
};

const dragDown = (s: Scenario, pane: HTMLElement, distance: number, stepMs = 16) => {
  pane.dispatchEvent(pointer('pointerdown', 100));

  for (let step = 1; step <= 5; step++) {
    s.tick(stepMs);
    pane.dispatchEvent(pointer('pointermove', 100 + (distance * step) / 5));
  }

  pane.dispatchEvent(pointer('pointerup', 100 + distance));
};

const elementsOf = (ref: { readonly elements: OverlayRef['elements'] }) => {
  const elements = ref.elements;

  if (!elements) throw new Error('overlay is not mounted');

  return elements;
};

const open = (s: Scenario, config: OverlayConfig) => {
  const ref = s.run(() => injectOverlayManager().open(SheetContentComponent, { autoFocus: false, ...config }));

  s.flush();

  return ref;
};

const closeAndFlush = (s: Scenario, ref: { close: () => void }) => {
  ref.close();
  s.flush();
  expect(document.querySelector('.et-overlay-runtime-root')).toBeNull();
};

describe('overlay strategy scenarios', () => {
  let viewport = createFakeViewport(1024);
  let uninstall = () => false;

  beforeEach(() => {
    viewport = createFakeViewport(1024);
    uninstall = viewport.install();
  });

  afterEach(() => uninstall());

  describe('with the built-in defaults', () => {
    const scenario = useScenario({ providers: [provideOverlay()] });

    it('gives each built-in shape its own pane class and backdrop default', () => {
      const s = scenario();
      const origin = document.body.appendChild(document.createElement('button'));
      const shapes = [
        [dialogOverlayStrategy(), 'et-overlay--dialog', true],
        [bottomSheetOverlayStrategy(), 'et-overlay--bottom-sheet', true],
        [topSheetOverlayStrategy(), 'et-overlay--top-sheet', true],
        [leftSheetOverlayStrategy(), 'et-overlay--left-sheet', true],
        [rightSheetOverlayStrategy(), 'et-overlay--right-sheet', true],
        [anchoredDialogOverlayStrategy(), 'et-overlay--anchored-dialog', false],
        [centeredOverlayStrategy({ containerClass: 'centered-pane' }), 'centered-pane', true],
        [anchoredOverlayStrategy({ containerClass: 'anchored-pane', placement: 'top' }), 'anchored-pane', true],
      ] as const;

      for (const [strategies, paneClass, hasBackdrop] of shapes) {
        const ref = open(s, { strategies, origin });

        expect(elementsOf(ref).paneElement.classList).toContain(paneClass);
        expect(elementsOf(ref).backdropElement() !== null).toBe(hasBackdrop);
        closeAndFlush(s, ref);
      }

      origin.remove();
    });

    it('renders the anchored dialog arrow and the bottom sheet drag handle only for their strategy', () => {
      const s = scenario();
      const origin = document.body.appendChild(document.createElement('button'));
      const anchored = open(s, { strategies: anchoredDialogOverlayStrategy({ placement: 'bottom-start' }), origin });

      expect(elementsOf(anchored).paneElement.querySelector('.et-overlay-arrow')).not.toBeNull();
      expect(elementsOf(anchored).paneElement.querySelector('.et-overlay-container-drag-handle')).toBeNull();
      closeAndFlush(s, anchored);

      const sheet = open(s, { strategies: bottomSheetOverlayStrategy(), origin });

      expect(elementsOf(sheet).paneElement.querySelector('.et-overlay-container-drag-handle')).not.toBeNull();
      expect(elementsOf(sheet).paneElement.querySelector('.et-overlay-arrow')).toBeNull();
      closeAndFlush(s, sheet);
      origin.remove();
    });

    it('dismisses a bottom sheet dragged far enough down and settles one dragged a little', () => {
      const s = scenario();
      const ref = open(s, { strategies: bottomSheetOverlayStrategy() });
      const sources: string[] = [];

      ref.afterClosedEvent().subscribe((event) => sources.push(event.source));
      makeDraggable(elementsOf(ref).paneElement);

      dragDown(s, elementsOf(ref).paneElement, 20, 200);
      s.tick(200);
      s.flush();
      expect(sources).toEqual([]);

      dragDown(s, elementsOf(ref).paneElement, 300);
      s.flush();
      expect(sources).toEqual(['drag']);
      expect(document.querySelector('.et-overlay-runtime-root')).toBeNull();
    });

    it('lets a custom overlay attach drag-to-dismiss to its own pane', () => {
      const s = scenario();
      const ref = open(s, { strategies: centeredOverlayStrategy() });
      const sources: string[] = [];

      ref.afterClosedEvent().subscribe((event) => sources.push(event.source));
      makeDraggable(elementsOf(ref).paneElement);

      const drag = s.run(() =>
        enableDragToDismiss({
          element: elementsOf(ref).paneElement,
          overlayRef: ref,
          renderer: injectRenderer(),
          config: { direction: 'to-bottom' },
        }),
      );

      dragDown(s, elementsOf(ref).paneElement, 300);
      s.flush();
      expect(sources).toEqual(['drag']);
      drag.unsubscribe();
    });

    it('marks the document while a full-screen dialog is open and animates it from its origin', () => {
      const s = scenario();
      const origin = document.body.appendChild(document.createElement('button'));
      const ref = open(s, { strategies: fullScreenDialogOverlayStrategy(), origin });

      expect(elementsOf(ref).paneElement.classList).toContain('et-overlay--full-screen-dialog');
      expect(document.documentElement.classList).toContain('et-overlay--full-screen-dialog-document');

      closeAndFlush(s, ref);
      expect(document.documentElement.classList).not.toContain('et-overlay--full-screen-dialog-document');
      origin.remove();
    });

    it('switches a transforming strategy live on resize without remounting the content', () => {
      const s = scenario();

      viewport.resize(400);

      const ref = open(s, { strategies: transformingBottomSheetToDialogOverlayStrategy({ breakpoint: 'md' }) });
      const content = ref.componentInstance();

      expect(elementsOf(ref).paneElement.classList).toContain('et-overlay--bottom-sheet');

      viewport.resize(1024);
      s.flush();
      expect(elementsOf(ref).paneElement.classList).toContain('et-overlay--dialog');
      expect(elementsOf(ref).paneElement.classList).not.toContain('et-overlay--bottom-sheet');
      expect(ref.componentInstance()).toBe(content);

      viewport.resize(400);
      s.flush();
      expect(elementsOf(ref).paneElement.classList).toContain('et-overlay--bottom-sheet');
      closeAndFlush(s, ref);
    });

    it('opens the full-screen presets as a full-screen dialog below their breakpoint', () => {
      const s = scenario();
      const origin = document.body.appendChild(document.createElement('button'));

      viewport.resize(400);

      for (const strategies of [
        transformingFullScreenDialogToDialogOverlayStrategy(),
        transformingFullScreenDialogToRightSheetOverlayStrategy({ breakpoint: 'lg' }),
      ]) {
        const ref = open(s, { strategies, origin });

        expect(elementsOf(ref).paneElement.classList).toContain('et-overlay--full-screen-dialog');
        closeAndFlush(s, ref);
      }

      viewport.resize(1400);

      const sheet = open(s, {
        strategies: transformingFullScreenDialogToRightSheetOverlayStrategy({ breakpoint: 'lg' }),
      });

      expect(elementsOf(sheet).paneElement.classList).toContain('et-overlay--right-sheet');
      closeAndFlush(s, sheet);
      origin.remove();
    });

    it('rejects an empty strategies array and warns for one without a base entry', () => {
      const s = scenario();
      const parent = s.injector;

      expect(() => createOverlayStrategyController({ strategies: () => [] }, parent)).toThrow(
        `ET${OVERLAY_ERROR_CODES.EMPTY_STRATEGIES}`,
      );

      const controller = s.run(() =>
        createOverlayStrategyController(
          {
            strategies: () => [{ breakpoint: 'md', strategy: injectDialogStrategy().build() }],
          },
          inject(EnvironmentInjector),
        ),
      );

      s.expectWarning('no entry without a `breakpoint`');
      expect(controller.initialMountConfig.paneClass).toContain('et-overlay--dialog');
      expect(controller.hasBackdrop()).toBe(true);
    });

    it('merges breakpoint configs and rejects two layout classes on one strategy', () => {
      scenario();

      expect(OVERLAY_CONFIG_CLASS_KEYS.has('containerClass')).toBe(true);
      expect(
        mergeOverlayBreakpointConfigs({ hostClass: 'a', width: '10px' }, { hostClass: ['b'], width: '20px' }),
      ).toMatchObject({ hostClass: ['a', 'b'], width: '20px' });
      expect(() =>
        mergeOverlayBreakpointConfigs(
          { containerClass: 'et-overlay--dialog' },
          { containerClass: 'et-overlay--top-sheet' },
        ),
      ).toThrow(`ET${OVERLAY_ERROR_CODES.MULTIPLE_LAYOUT_CLASSES}`);
    });

    it('builds an anchored runtime position from an origin and falls back to global without one', () => {
      scenario();

      const origin = document.createElement('button');
      const build = buildAnchoredRuntimePositionStrategy({ placement: 'right' });

      expect(build().kind).toBe('global');
      expect(build(origin).kind).not.toBe('global');
    });

    it('resolves the origin an overlay animates from out of the element or event that opened it', () => {
      scenario();

      const button = document.body.appendChild(document.createElement('button'));
      const icon = button.appendChild(document.createElement('span'));
      const click = new MouseEvent('click', { clientX: 10, clientY: 20 });

      expect(isHtmlElement(button)).toBe(true);
      expect(isHtmlElement(click)).toBe(false);
      expect(isPointerEvent(click)).toBe(true);
      expect(isTouchEvent(new Event('touchstart'))).toBe(true);
      expect(findNextRelevantHtmlElement(icon)).toBe(button);
      expect(getOriginCoordinatesAndDimensions(button)).toMatchObject({ width: 0, height: 0 });
      expect(getOriginCoordinatesAndDimensions(undefined)).toBeNull();
      button.remove();
    });
  });

  describe('with app-wide strategy defaults', () => {
    const scenario = useScenario({
      providers: [
        provideOverlay(),
        provideDialogStrategyDefaults({ width: '300px', containerClass: 'et-overlay--dialog' }),
        provideBottomSheetStrategyDefaults({ hostClass: 'app-bottom' }),
        provideTopSheetStrategyDefaults({ hostClass: 'app-top' }),
        provideLeftSheetStrategyDefaults({ hostClass: 'app-left' }),
        provideRightSheetStrategyDefaults({ hostClass: 'app-right' }),
        provideFullscreenDialogStrategyDefaults({ hostClass: 'app-full' }),
        provideAnchoredDialogStrategyDefaults({ hostClass: 'app-anchored', arrow: false }),
        provideDialogStrategy(),
        provideBottomSheetStrategy(),
        provideTopSheetStrategy(),
        provideLeftSheetStrategy(),
        provideRightSheetStrategy(),
        provideFullscreenDialogStrategy(),
        provideAnchoredDialogStrategy(),
      ],
    });

    it('reads the app defaults back and builds every strategy on top of them', () => {
      const s = scenario();

      s.run(() => {
        expect(injectDialogStrategyDefaults().width).toBe('300px');
        expect(injectBottomSheetStrategyDefaults().hostClass).toBe('app-bottom');
        expect(injectTopSheetStrategyDefaults().hostClass).toBe('app-top');
        expect(injectLeftSheetStrategyDefaults().hostClass).toBe('app-left');
        expect(injectRightSheetStrategyDefaults().hostClass).toBe('app-right');
        expect(injectFullscreenDialogStrategyDefaults().hostClass).toBe('app-full');
        expect(injectAnchoredDialogStrategyDefaults().arrow).toBe(false);

        expect(injectDialogStrategy().build({ height: '200px' }).config).toMatchObject({
          width: '300px',
          height: '200px',
        });
        expect(injectBottomSheetStrategy().build().config.hostClass).toEqual(['app-bottom']);
        expect(injectTopSheetStrategy().build().config.hostClass).toEqual(['app-top']);
        expect(injectLeftSheetStrategy().build().config.hostClass).toEqual(['app-left']);
        expect(injectRightSheetStrategy().build().config.hostClass).toEqual(['app-right']);
        expect(injectFullscreenDialogStrategy().build().config.hostClass).toEqual(['app-full']);
        expect(injectAnchoredDialogStrategy().build().config.arrow).toBe(false);
      });

      const origin = document.body.appendChild(document.createElement('button'));
      const anchored = open(s, { strategies: anchoredDialogOverlayStrategy(), origin });

      expect(elementsOf(anchored).hostElement.classList).toContain('app-anchored');
      expect(elementsOf(anchored).paneElement.querySelector('.et-overlay-arrow')).toBeNull();
      closeAndFlush(s, anchored);

      const dialog = open(s, { strategies: dialogOverlayStrategy() });

      expect(elementsOf(dialog).paneElement.style.width).toBe('300px');
      closeAndFlush(s, dialog);
      origin.remove();
    });
  });
});
