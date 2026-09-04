import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  arrow,
  autoUpdate,
  computePosition,
  hide,
  Middleware,
  MiddlewareState,
  platform,
  Placement,
  SideObject,
  size,
  VirtualElement,
} from '@floating-ui/dom';
import { injectRenderer } from '../providers';
import { createAnchoredPositionCleanup, registerAnchoredPositionMiddlewareExtras } from './overlay-position-anchored';
import { createOverlayRuntimeRef } from './overlay-runtime-ref';
import { OverlayRuntimeAnchoredPosition } from './overlay-runtime.types';

vi.mock('@floating-ui/dom', async (importOriginal) => {
  const original = await importOriginal<typeof import('@floating-ui/dom')>();

  return {
    ...original,
    autoUpdate: vi.fn(),
    computePosition: vi.fn(),
  };
});

const REFERENCE_RECT = { x: 100, y: 100, width: 80, height: 40 };
const FLOATING_RECT = { x: 0, y: 0, width: 200, height: 100 };

describe('anchored overlay position', () => {
  let capturedMiddleware: Middleware[];
  let paneElement: HTMLElement;
  let referenceElement: VirtualElement;

  beforeAll(() => {
    registerAnchoredPositionMiddlewareExtras({ arrow, hide, size });
  });

  beforeEach(() => {
    capturedMiddleware = [];
    paneElement = document.createElement('div');
    referenceElement = {
      getBoundingClientRect: () =>
        new DOMRect(REFERENCE_RECT.x, REFERENCE_RECT.y, REFERENCE_RECT.width, REFERENCE_RECT.height),
    };

    vi.mocked(autoUpdate).mockImplementation((_reference, _floating, update) => {
      update();

      return vi.fn();
    });
    vi.mocked(computePosition).mockImplementation((_reference, _floating, config) => {
      const resolvedConfig = config ?? {};

      capturedMiddleware = (resolvedConfig.middleware ?? []).filter((middleware): middleware is Middleware =>
        Boolean(middleware),
      );

      return Promise.resolve({
        x: 0,
        y: 0,
        placement: resolvedConfig.placement ?? 'bottom',
        strategy: resolvedConfig.strategy ?? 'absolute',
        middlewareData: {},
      });
    });
  });

  const createPreferredSideMiddleware = (strategy: Partial<OverlayRuntimeAnchoredPosition> = {}): Middleware => {
    const rootElement = document.createElement('div');
    const hostElement = document.createElement('div');
    const overlayRef = createOverlayRuntimeRef(
      'preferred-side-test',
      { id: 'preferred-side-test' },
      {
        rootElement,
        hostElement,
        backdropElement: signal<HTMLElement | null>(null),
        paneElement,
      },
      vi.fn(),
    );
    const renderer = TestBed.runInInjectionContext(() => injectRenderer());
    const cleanup = createAnchoredPositionCleanup(
      {
        kind: 'anchored',
        referenceElement,
        minAvailableSpace: 80,
        autoResize: true,
        shift: false,
        ...strategy,
      },
      paneElement,
      overlayRef,
      renderer,
    );
    const middleware = capturedMiddleware.find(({ name }) => name === 'etPreferredSide');

    cleanup();

    if (!middleware) {
      throw new Error('Expected the preferred-side middleware to be installed');
    }

    return middleware;
  };

  const createMiddlewareState = ({
    placement,
    initialPlacement = placement,
    overflow,
    availableSpace = {},
  }: {
    placement: Placement;
    initialPlacement?: Placement;
    overflow: SideObject;
    availableSpace?: Partial<Record<'top' | 'right' | 'bottom' | 'left', number>>;
  }) => {
    const detectOverflow = vi.fn().mockResolvedValue(overflow);
    const state: MiddlewareState = {
      x: 0,
      y: 0,
      initialPlacement,
      placement,
      strategy: 'absolute',
      middlewareData: Object.keys(availableSpace).length ? { etPreferredSide: { availableSpace } } : {},
      elements: { reference: referenceElement, floating: paneElement },
      rects: { reference: REFERENCE_RECT, floating: FLOATING_RECT },
      platform: { ...platform, detectOverflow },
    };

    return { state, detectOverflow };
  };

  it('keeps the current side when it meets the minimum', async () => {
    const middleware = createPreferredSideMiddleware();
    const { state } = createMiddlewareState({
      placement: 'bottom',
      overflow: { top: 0, right: 0, bottom: 20, left: 0 },
    });

    await expect(middleware.fn(state)).resolves.toEqual({});
  });

  it('measures the opposite side while preserving alignment', async () => {
    const middleware = createPreferredSideMiddleware();
    const { state } = createMiddlewareState({
      placement: 'bottom-start',
      overflow: { top: 0, right: 0, bottom: 30, left: 0 },
    });

    await expect(middleware.fn(state)).resolves.toEqual({
      data: { availableSpace: { bottom: 70 } },
      reset: { placement: 'top-start' },
    });
  });

  it('lets the initial side win a tie', async () => {
    const middleware = createPreferredSideMiddleware();
    const { state } = createMiddlewareState({
      placement: 'bottom',
      overflow: { top: 0, right: 0, bottom: 40, left: 0 },
      availableSpace: { top: 60 },
    });

    await expect(middleware.fn(state)).resolves.toEqual({
      data: { availableSpace: { top: 60, bottom: 60 } },
    });
  });

  it('keeps a non-initial side only when it has strictly more space', async () => {
    const middleware = createPreferredSideMiddleware();
    const tiedState = createMiddlewareState({
      placement: 'top',
      initialPlacement: 'bottom',
      overflow: { top: 40, right: 0, bottom: 0, left: 0 },
      availableSpace: { bottom: 60 },
    }).state;
    const roomierState = createMiddlewareState({
      placement: 'top',
      initialPlacement: 'bottom',
      overflow: { top: 39, right: 0, bottom: 0, left: 0 },
      availableSpace: { bottom: 60 },
    }).state;

    await expect(middleware.fn(tiedState)).resolves.toEqual({
      data: { availableSpace: { bottom: 60, top: 60 } },
      reset: { placement: 'bottom' },
    });
    await expect(middleware.fn(roomierState)).resolves.toEqual({
      data: { availableSpace: { bottom: 60, top: 61 } },
    });
  });

  it('terminates after both sides have been measured', async () => {
    const middleware = createPreferredSideMiddleware();
    const firstState = createMiddlewareState({
      placement: 'bottom',
      overflow: { top: 0, right: 0, bottom: 60, left: 0 },
    }).state;
    const firstResult = await middleware.fn(firstState);
    const secondState = createMiddlewareState({
      placement: 'top',
      initialPlacement: 'bottom',
      overflow: { top: 60, right: 0, bottom: 0, left: 0 },
      availableSpace: firstResult.data?.['availableSpace'],
    }).state;
    const secondResult = await middleware.fn(secondState);
    const finalState = createMiddlewareState({
      placement: 'bottom',
      overflow: { top: 0, right: 0, bottom: 60, left: 0 },
      availableSpace: secondResult.data?.['availableSpace'],
    }).state;

    expect(firstResult.reset).toEqual({ placement: 'top' });
    expect(secondResult.reset).toEqual({ placement: 'bottom' });
    await expect(middleware.fn(finalState)).resolves.toEqual({
      data: { availableSpace: { bottom: 40, top: 40 } },
    });
  });

  it.each([
    { placement: 'top' as const, overflow: { top: 25, right: 0, bottom: 0, left: 0 }, available: 75 },
    { placement: 'left' as const, overflow: { top: 0, right: 0, bottom: 0, left: 25 }, available: 175 },
  ])('calculates $placement space along its main axis', async ({ placement, overflow, available }) => {
    const middleware = createPreferredSideMiddleware({ minAvailableSpace: 300 });
    const { state } = createMiddlewareState({ placement, overflow });

    await expect(middleware.fn(state)).resolves.toMatchObject({
      data: { availableSpace: { [placement]: available } },
    });
  });

  it('forwards viewport padding and the boundary to overflow detection', async () => {
    const boundary = document.createElement('section');
    const middleware = createPreferredSideMiddleware({
      boundary,
      viewportPadding: { top: 1, right: 2, bottom: 3, left: 4 },
    });
    const { state, detectOverflow } = createMiddlewareState({
      placement: 'bottom',
      overflow: { top: 0, right: 0, bottom: 20, left: 0 },
    });

    await middleware.fn(state);

    expect(detectOverflow).toHaveBeenCalledWith(state, {
      padding: { top: 1, right: 2, bottom: 3, left: 4 },
      boundary,
    });
  });
});
