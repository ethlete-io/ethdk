import {
  DOCUMENT,
  DestroyRef,
  ElementRef,
  Signal,
  WritableSignal,
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
  injectViewportDimensions,
} from '@ethlete/core';
import { exhaustMap, finalize, switchMap, takeUntil, tap } from 'rxjs';
import { animateScaleFadeOut } from './pip-animation';
import { PipWindowSize } from './pip-window-size';

const SNAP_DURATION_MS = 150;
const SNAP_EASE = 'cubic-bezier(0.4,0,0.2,1)';

export type PipWindowPositionOptions = {
  collapsePeek: Signal<number>;
  viewportPadding: Signal<number>;
  aspectRatio: Signal<number | null>;
  minWidth: Signal<number>;
  maxWidth: Signal<number>;
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

export function createPipWindowPosition(options: PipWindowPositionOptions): PipWindowPosition {
  const {
    collapsePeek,
    viewportPadding,
    aspectRatio,
    minWidth,
    maxWidth,
    titleBarH,
    size,
    resizeHandles,
    dragHandle,
    forcedTitleBar,
  } = options;

  const el = inject<ElementRef<HTMLElement>>(ElementRef);
  const renderer = injectRenderer();
  const document = inject(DOCUMENT);
  const destroyRef = inject(DestroyRef);
  const viewportDims = injectViewportDimensions();

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
    const vw = viewportDims().client?.width ?? 0;
    const vh = viewportDims().client?.height ?? 0;
    const pad = viewportPadding();
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
    const vw = viewportDims().client?.width ?? 0;
    const vh = viewportDims().client?.height ?? 0;
    const peek = collapsePeek();

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
      let newX = lx;
      let newY = ly;
      if (offLeft > 0) newX += offLeft;
      else if (offRight > 0) newX -= offRight;
      if (offTop > 0) newY += offTop;
      else if (offBottom > 0) newY -= offBottom;
      snapToPosition(newX, newY);
    } else {
      snapToViewport();
    }
  };

  const handleViewportResize = (): void => {
    if (isDragging() || isResizing()) return;

    if (isCollapsed()) {
      if (positionInitialized()) checkAndCollapse();
      return;
    }

    if (!positionInitialized()) return;

    const { w: newW, h: newH } = size.get();
    if (newW === null || newH === null) return;

    const { x: lx, y: ly } = pos();
    const vw = viewportDims().client?.width ?? 0;
    const vh = viewportDims().client?.height ?? 0;
    const pad = viewportPadding();

    let newX = lx;
    let newY = ly;

    if (lx + newW > vw - pad) newX = vw - pad - newW;
    if (newX < pad) newX = pad;
    if (ly + newH > vh - pad) newY = vh - pad - newH;
    if (newY < pad) newY = pad;

    if (newX !== lx || newY !== ly) snapToPosition(newX, newY);
  };

  const startInteraction = (): void => {
    renderer.setStyle(document.body, { userSelect: 'none' });
    renderer.addClass(document.body, 'et-pip-interacting');
  };

  const endInteraction = (): void => {
    renderer.setStyle(document.body, { userSelect: null });
    renderer.removeClass(document.body, 'et-pip-interacting');
  };

  const initPosition = (): void => {
    if (positionInitialized()) return;
    const rect = el.nativeElement.getBoundingClientRect();
    size.update((s) => ({ w: s.w ?? rect.width, h: s.h ?? rect.height }));
    pos.set({ x: rect.left, y: rect.top });
    positionInitialized.set(true);
  };

  const startDrag = (): void => {
    initPosition();
    isCollapsed.set(false);
    startInteraction();
  };

  const endDrag = (): void => {
    endInteraction();
    checkAndCollapse();
  };

  const applyDragStep = ({ stepX, stepY }: DragMoveEvent): void => {
    const elem = el.nativeElement;
    const vw = viewportDims().client?.width ?? 0;
    const vh = viewportDims().client?.height ?? 0;
    const peek = collapsePeek();
    const minX = peek - elem.offsetWidth;
    const maxX = vw - peek;
    const minY = peek - elem.offsetHeight;
    const maxY = vh - peek;
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
  };

  const applyResizeDelta = ({ edge, dx }: ResizeMoveEvent): void => {
    const movesE = edge.includes('e');
    const movesW = edge.includes('w');
    const movesN = edge.includes('n');

    if (!movesE && !movesW) return;

    const ratio = aspectRatio();
    const pad = viewportPadding();
    const vw = viewportDims().client?.width ?? 0;
    const vh = viewportDims().client?.height ?? 0;
    const maxWFromHeight = ratio !== null ? (vh - pad - resizeBaseY - titleBarH()) * ratio : maxWidth();

    let newW: number;
    let newX = resizeBaseX;
    let newY = resizeBaseY;

    if (movesE) {
      const maxW = Math.min(maxWidth(), maxWFromHeight, vw - pad - resizeBaseX);
      newW = Math.max(minWidth(), Math.min(maxW, resizeBaseW + dx));
    } else {
      const maxW = Math.min(maxWidth(), maxWFromHeight, resizeBaseX + resizeBaseW - pad);
      newW = Math.max(minWidth(), Math.min(maxW, resizeBaseW - dx));
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
    if (!viewportDims().client) return;
    untracked(() => handleViewportResize());
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
    animateExit: (callback) => animateScaleFadeOut(el.nativeElement, { onFinish: callback }),
    startModeTransition: (duration = 260) => {
      renderer.addClass(el.nativeElement, 'et-pip-window--mode-transitioning');
      setTimeout(() => renderer.removeClass(el.nativeElement, 'et-pip-window--mode-transitioning'), duration);
    },
  };
}
