import {
  DOCUMENT,
  DestroyRef,
  ElementRef,
  Signal,
  WritableSignal,
  afterRenderEffect,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { outputToObservable, takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  DragHandleDirective,
  DragMoveEvent,
  ResizeHandlesComponent,
  ResizeMoveEvent,
  injectRenderer,
  injectViewportSize,
} from '@ethlete/core';
import { exhaustMap, finalize, switchMap, takeUntil, tap } from 'rxjs';
import { animateScaleFadeOut } from './pip-animation';
import { PipWindowParamsDirective } from '../pip-window-params.directive';
import { PipWindowSize } from './pip-window-size';

const SNAP_DURATION_MS = 150;
const SNAP_EASE = 'cubic-bezier(0.4,0,0.2,1)';

export type PipWindowPositionOptions = {
  params: PipWindowParamsDirective;
  titleBarH: Signal<number>;
  size: PipWindowSize;
  resizeHandles: Signal<ResizeHandlesComponent>;
  dragHandle: Signal<DragHandleDirective>;
  forcedTitleBar: WritableSignal<boolean>;
};

export type PipWindowPosition = {
  position: Signal<string>;
  positionInitialized: WritableSignal<boolean>;
  isCollapsed: WritableSignal<boolean>;
  isDragging: Signal<boolean>;
  isResizing: Signal<boolean>;
  initPosition(): void;
  checkAndCollapse(): void;
  snapToViewport(): void;
  animateExit(callback: () => void): void;
  startModeTransition(duration?: number): void;
};

export const createPipWindowPosition = (options: PipWindowPositionOptions): PipWindowPosition => {
  const { params, titleBarH, size, resizeHandles, dragHandle, forcedTitleBar } = options;

  const el = inject<ElementRef<HTMLElement>>(ElementRef);
  const renderer = injectRenderer();
  const document = inject(DOCUMENT);
  const destroyRef = inject(DestroyRef);
  const viewportSize = injectViewportSize();

  const isDragging = computed(() => dragHandle().isDragging());
  const isResizing = computed(() => resizeHandles().isResizing());

  const pos = signal({ x: 0, y: 0 });
  const positionInitialized = signal(false);
  const isCollapsed = signal(false);

  let resizeBaseW = 0;
  let resizeBaseH = 0;
  let resizeBaseX = 0;
  let resizeBaseY = 0;

  const snapToPosition = (newX: number, newY: number): void => {
    renderer.setStyle(el.nativeElement, { transition: `translate ${SNAP_DURATION_MS}ms ${SNAP_EASE}` });
    pos.set({ x: newX, y: newY });
    setTimeout(() => renderer.removeStyle(el.nativeElement, 'transition'), SNAP_DURATION_MS + 10);
  };

  const snapTo = (newX: number, newY: number, collapsed = false): void => {
    renderer.setStyle(el.nativeElement, { transition: `translate ${SNAP_DURATION_MS}ms ${SNAP_EASE}` });
    pos.set({ x: newX, y: newY });
    if (collapsed) isCollapsed.set(true);
    setTimeout(() => renderer.removeStyle(el.nativeElement, 'transition'), SNAP_DURATION_MS + 10);
  };

  const snapToViewport = (): void => {
    const elem = el.nativeElement;
    const rect = elem.getBoundingClientRect();
    const vw = viewportSize().width;
    const vh = viewportSize().height;
    const pad = params.viewportPadding();
    const { x: lx, y: ly } = pos();
    let newX = lx;
    let newY = ly;

    if (rect.left < pad) newX += pad - rect.left;
    else if (rect.right > vw - pad) newX -= rect.right - (vw - pad);

    if (rect.top < pad) newY += pad - rect.top;
    else if (rect.bottom > vh - pad) newY -= rect.bottom - (vh - pad);

    isCollapsed.set(false);
    snapTo(newX, newY);
  };

  const checkAndCollapse = (): void => {
    const elem = el.nativeElement;
    const rect = elem.getBoundingClientRect();
    const vw = viewportSize().width;
    const vh = viewportSize().height;
    const peek = params.collapsePeek();

    const offLeft = Math.max(0, peek - rect.right);
    const offRight = Math.max(0, rect.left - (vw - peek));
    const offTop = Math.max(0, peek - rect.bottom);
    const offBottom = Math.max(0, rect.top - (vh - peek));

    const rawOffLeft = Math.max(0, -rect.left);
    const rawOffRight = Math.max(0, rect.right - vw);
    const rawOffTop = Math.max(0, -rect.top);
    const rawOffBottom = Math.max(0, rect.bottom - vh);

    const rawOffX = Math.max(rawOffLeft, rawOffRight);
    const rawOffY = Math.max(rawOffTop, rawOffBottom);

    if (rawOffX > rect.width * 0.5 || rawOffY > rect.height * 0.5) {
      const collapseOnX = rawOffX / rect.width >= rawOffY / rect.height;
      const { x: lx, y: ly } = pos();
      let newX = lx;
      let newY = ly;

      if (collapseOnX) {
        newX = rawOffLeft > rawOffRight ? lx + (peek - rect.right) : lx + (vw - peek - rect.left);
      } else {
        newY = rawOffTop > rawOffBottom ? ly + (peek - rect.bottom) : ly + (vh - peek - rect.top);
      }

      snapTo(newX, newY, true);
    } else if (offLeft > 0 || offRight > 0 || offTop > 0 || offBottom > 0) {
      const { x: lx, y: ly } = pos();
      const pad = params.viewportPadding();
      let newX = lx;
      let newY = ly;
      if (offLeft > 0) newX += offLeft;
      else if (offRight > 0) newX -= offRight;
      if (offTop > 0) newY += offTop;
      else if (offBottom > 0) newY -= offBottom;
      newX = Math.max(pad, Math.min(vw - pad - rect.width, newX));
      newY = Math.max(pad, Math.min(vh - pad - rect.height, newY));
      snapToPosition(newX, newY);
    } else {
      snapToViewport();
    }
  };

  let positionUpdateBlocked = false;
  let pendingPositionApply: (() => void) | null = null;

  let stickyLeft = false;
  let stickyRight = false;
  let stickyTop = false;
  let stickyBottom = false;

  let lastKnownW: number | null = null;

  const deriveStickyEdges = (): void => {
    const { x: lx, y: ly } = pos();
    const { w, h } = size.get();
    if (w === null || h === null) return;
    const vw = viewportSize().width;
    const vh = viewportSize().height;
    const pad = params.viewportPadding();
    stickyLeft = lx <= pad;
    stickyRight = lx + w >= vw - pad;
    stickyTop = ly <= pad;
    stickyBottom = ly + h >= vh - pad;
  };

  const handlePositionAfterResize = (): void => {
    const { w: newW, h: newH } = size.get();
    if (newW === null || newH === null) return;

    if (isDragging() || isResizing()) return;

    if (isCollapsed()) {
      if (positionInitialized()) checkAndCollapse();
      return;
    }

    if (!positionInitialized()) return;

    const { x: lx, y: ly } = pos();
    const vw = viewportSize().width;
    const vh = viewportSize().height;
    const pad = params.viewportPadding();

    let newX: number;
    let newY: number;

    if (stickyRight) {
      newX = vw - pad - newW;
    } else if (stickyLeft) {
      newX = pad;
    } else if (lastKnownW !== null && newW < lastKnownW && lx + lastKnownW / 2 >= vw / 2) {
      newX = Math.max(pad, Math.min(vw - pad - newW, lx + lastKnownW - newW));
    } else {
      newX = Math.max(pad, Math.min(vw - pad - newW, lx));
    }

    if (stickyBottom) {
      newY = vh - pad - newH;
    } else if (stickyTop) {
      newY = pad;
    } else {
      newY = Math.max(pad, Math.min(vh - pad - newH, ly));
    }

    if (newX === lx && newY === ly) return;

    if (positionUpdateBlocked) {
      pendingPositionApply = () => {
        snapToPosition(newX, newY);
        deriveStickyEdges();
      };
    } else {
      pos.set({ x: newX, y: newY });
      deriveStickyEdges();
    }
  };

  const startInteraction = (): void => {
    renderer.setStyle(document.body, { userSelect: 'none' });
    renderer.addClass(document.body, 'et-pip-interacting');
  };

  const endInteraction = (): void => {
    renderer.setStyle(document.body, { userSelect: null });
    renderer.removeClass(document.body, 'et-pip-interacting');
  };

  const applyInitialSize = (): void => {
    if (size.get().w !== null) return;
    const ratio = params.aspectRatio();
    const vw = document.documentElement.clientWidth;
    const vh = document.documentElement.clientHeight;
    const tbH = titleBarH();
    const desired = params.desiredSize();
    const pad = params.viewportPadding();
    const availW = Math.max(0, vw - pad * 2);
    const availH = Math.max(0, vh - pad * 2);
    let initW: number;
    if (ratio !== null && ratio > 0) {
      if (ratio < 1) {
        const targetH = Math.min(desired, availH);
        const maxContentH = Math.max(0, targetH - tbH);
        initW = Math.max(params.minWidth(), maxContentH * ratio);
      } else {
        const maxContentH = Math.max(0, availH - tbH);
        const maxWFromH = maxContentH * ratio;
        initW = Math.min(desired, params.maxWidth(), availW, maxWFromH);
        initW = Math.max(params.minWidth(), initW);
      }
    } else {
      initW = Math.min(desired, params.maxWidth(), availW);
      initW = Math.max(params.minWidth(), initW);
    }
    const initH = ratio !== null && ratio > 0 ? tbH + initW / ratio : null;
    size.update((s) => ({ w: s.w ?? initW, h: s.h ?? initH }));
  };

  const initPosition = (): void => {
    if (positionInitialized()) return;
    applyInitialSize();
    const rect = el.nativeElement.getBoundingClientRect();
    pos.set({ x: rect.left, y: rect.top });

    positionInitialized.set(true);
    deriveStickyEdges();
  };

  afterRenderEffect(() => {
    untracked(() => applyInitialSize());
  });

  const startDrag = (): void => {
    initPosition();
    isCollapsed.set(false);
    startInteraction();
  };

  const endDrag = (): void => {
    endInteraction();
    checkAndCollapse();
    deriveStickyEdges();
  };

  const applyDragStep = ({ stepX, stepY }: DragMoveEvent): void => {
    const elem = el.nativeElement;
    const vw = viewportSize().width;
    const vh = viewportSize().height;
    const peek = params.collapsePeek();
    const pad = params.viewportPadding();
    const minX = Math.min(pad - elem.offsetWidth, peek - elem.offsetWidth);
    const maxX = Math.max(vw - pad, vw - peek);
    const minY = Math.min(pad - elem.offsetHeight, peek - elem.offsetHeight);
    const maxY = Math.max(vh - pad, vh - peek);
    pos.update((p) => ({
      x: Math.max(minX, Math.min(maxX, p.x + stepX)),
      y: Math.max(minY, Math.min(maxY, p.y + stepY)),
    }));
  };

  const startResize = (): void => {
    initPosition();
    forcedTitleBar.set(true);
    const { w: lw, h: lh } = size.get();
    const { x: lx, y: ly } = pos();
    resizeBaseW = lw ?? el.nativeElement.offsetWidth;
    resizeBaseH = lh ?? el.nativeElement.offsetHeight;
    resizeBaseX = lx;
    resizeBaseY = ly;
    startInteraction();
  };

  const endResize = (): void => {
    size.clearResize();
    forcedTitleBar.set(false);
    endInteraction();
    snapToViewport();
    deriveStickyEdges();
  };

  const applyResizeDelta = ({ edge, dx, dy }: ResizeMoveEvent): void => {
    const movesE = edge.includes('e');
    const movesW = edge.includes('w');
    const movesN = edge.includes('n');
    const movesS = edge.includes('s');

    if (!movesE && !movesW && !movesS) return;

    const ratio = params.aspectRatio();
    const pad = params.viewportPadding();
    const vw = viewportSize().width;
    const vh = viewportSize().height;
    const maxViewportW = vw - pad * 2;
    const maxWFromHeight = ratio !== null ? Math.max(0, vh - pad * 2 - titleBarH()) * ratio : params.maxWidth();
    const maxW = Math.min(params.maxWidth(), maxViewportW, maxWFromHeight);

    let newW: number;
    let newX = resizeBaseX;
    let newY = resizeBaseY;

    if (movesS && !movesE && !movesW) {
      if (ratio !== null && ratio > 0) {
        const newContentH = Math.max(0, resizeBaseH - titleBarH() + dy);
        newW = Math.max(params.minWidth(), Math.min(maxW, newContentH * ratio));
      } else {
        newW = resizeBaseW;
      }
      newX = resizeBaseX + (resizeBaseW - newW) / 2;
    } else if (movesE) {
      newW = Math.max(params.minWidth(), Math.min(maxW, resizeBaseW + dx));
    } else {
      newW = Math.max(params.minWidth(), Math.min(maxW, resizeBaseW - dx));
      newX = resizeBaseX + (resizeBaseW - newW);
    }

    let newH: number;
    if (ratio !== null) {
      newH = titleBarH() + newW / ratio;
      if (movesN) newY = resizeBaseY + (resizeBaseH - newH);
    } else {
      newH = resizeBaseH;
    }

    size.setResize(newW, newH);
    pos.set({ x: newX, y: newY });
  };

  effect(() => {
    viewportSize();
    size.w();
    size.h();
    untracked(() => {
      handlePositionAfterResize();
      lastKnownW = size.get().w;
    });
  });

  destroyRef.onDestroy(() => endInteraction());

  toObservable(resizeHandles)
    .pipe(
      switchMap((handles) =>
        outputToObservable(handles.resizeStarted).pipe(
          exhaustMap(() => {
            startResize();
            return outputToObservable(handles.resizeMoved).pipe(
              tap((event) => applyResizeDelta(event)),
              takeUntil(outputToObservable(handles.resizeEnded)),
              finalize(() => endResize()),
            );
          }),
        ),
      ),
      takeUntilDestroyed(),
    )
    .subscribe();

  toObservable(dragHandle)
    .pipe(
      switchMap((handle) =>
        outputToObservable(handle.dragStarted).pipe(
          exhaustMap(() => {
            startDrag();
            return outputToObservable(handle.dragMoved).pipe(
              tap((event) => applyDragStep(event)),
              takeUntil(outputToObservable(handle.dragEnded)),
              finalize(() => endDrag()),
            );
          }),
        ),
      ),
      takeUntilDestroyed(),
    )
    .subscribe();

  toObservable(dragHandle)
    .pipe(
      switchMap((handle) =>
        outputToObservable(handle.dragTapped).pipe(
          tap(() => {
            initPosition();
            if (isCollapsed()) snapToViewport();
          }),
        ),
      ),
      takeUntilDestroyed(),
    )
    .subscribe();

  return {
    position: computed(() => `${pos().x}px ${pos().y}px`),
    positionInitialized,
    isCollapsed,
    isDragging,
    isResizing,
    initPosition,
    checkAndCollapse,
    snapToViewport,
    animateExit: (callback) => {
      animateScaleFadeOut(el.nativeElement, { onFinish: callback });
    },
    startModeTransition: (duration = 260) => {
      positionUpdateBlocked = true;
      renderer.addClass(el.nativeElement, 'et-pip-window--mode-transitioning');
      setTimeout(() => {
        positionUpdateBlocked = false;
        renderer.removeClass(el.nativeElement, 'et-pip-window--mode-transitioning');
        const apply = pendingPositionApply;
        pendingPositionApply = null;
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        apply ? apply() : snapToViewport();
      }, duration);
    },
  };
};
