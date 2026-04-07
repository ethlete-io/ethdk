import { ElementRef, Signal, afterRenderEffect, effect, untracked } from '@angular/core';
import { injectRenderer } from '@ethlete/core';
import { StreamPlayerId } from '../stream-manager.types';
import { animateElementTo, animateNewPipInSingleMode } from './pip-animation';
import type { PipChromeState } from './pip-chrome-state';
import type { PipWindowComponent } from './pip-window.component';

type FlipItem = { el: HTMLElement; fromRect: DOMRect };

type PipChromeAnimationRefs = {
  stageRef: Signal<ElementRef<HTMLElement> | undefined>;
  gridBtnRef: Signal<ElementRef<HTMLElement> | undefined>;
  pipWindowRef: Signal<PipWindowComponent | undefined>;
};

export type PipChromeAnimations = {
  enterMultiView(): void;
  exitMultiView(): void;
  toggleMultiView(): void;
  selectCell(playerId: StreamPlayerId): void;
};

export function createPipChromeAnimations(state: PipChromeState, refs: PipChromeAnimationRefs): PipChromeAnimations {
  const renderer = injectRenderer();

  let pendingFlips: FlipItem[] = [];
  let prevPipCount = 0;
  let prevPipIds = new Set<StreamPlayerId>();
  let pendingNewInSingleMode = new Set<StreamPlayerId>();

  const captureAllCellRects = (): FlipItem[] => {
    const stageEl = refs.stageRef()?.nativeElement;
    const els = stageEl?.querySelectorAll<HTMLElement>('.et-stream-pip-chrome__cell');
    if (!els || !stageEl) return [];
    return Array.from(els).map((el) => ({ el, fromRect: el.getBoundingClientRect() }));
  };

  const enterMultiView = (): void => {
    if (state.multiView()) return;
    pendingFlips = captureAllCellRects();
    state.multiView.set(true);
  };

  const exitMultiView = (): void => {
    if (!state.multiView()) return;
    pendingFlips = captureAllCellRects();
    state.multiView.set(false);
  };

  const toggleMultiView = (): void => {
    if (state.multiView()) exitMultiView();
    else enterMultiView();
  };

  const selectCell = (playerId: StreamPlayerId): void => {
    if (!state.multiView()) return;
    const newPip = state.allPips().find((p) => p.playerId === playerId);
    const newRatio = newPip?.aspectRatio ?? 16 / 9;
    const currentRatio = untracked(() => state.windowAspectRatio());
    if (newRatio !== currentRatio) {
      refs.pipWindowRef()?.posState.startModeTransition(260);
    }
    pendingFlips = captureAllCellRects();
    state.featuredId.set(playerId);
    state.multiView.set(false);
  };

  effect(() => {
    const pipCount = state.allPips().length;
    if (pipCount <= 1 && untracked(() => state.multiView())) {
      untracked(() => {
        pendingFlips = captureAllCellRects();
        state.multiView.set(false);
      });
    }
  });

  effect(() => {
    const newPips = state.allPips();
    const isGrid = state.multiView();
    const newCount = newPips.length;
    const oldCount = prevPipCount;
    prevPipCount = newCount;

    if (oldCount > 0 && newCount !== oldCount) {
      if (isGrid) {
        pendingFlips = captureAllCellRects();
      } else if (newCount > oldCount) {
        for (const pip of newPips) {
          if (!prevPipIds.has(pip.playerId)) {
            pendingNewInSingleMode.add(pip.playerId);
          }
        }
      }
    }

    prevPipIds = new Set(newPips.map((p) => p.playerId));
  });

  afterRenderEffect(() => {
    state.multiView();
    state.featuredPip();
    state.allPips();

    const newInSingle = pendingNewInSingleMode;
    if (newInSingle.size > 0) {
      pendingNewInSingleMode = new Set();
      const stageEl = refs.stageRef()?.nativeElement;
      if (stageEl) {
        const stageRect = stageEl.getBoundingClientRect();
        for (const playerId of newInSingle) {
          const cell = stageEl.querySelector<HTMLElement>(`[data-cell-player-id="${playerId}"]`);
          if (cell) {
            const pip = state.allPips().find((p) => p.playerId === playerId);
            animateNewPipInSingleMode({
              cell,
              stageEl,
              stageRect,
              aspectRatio: pip?.aspectRatio ?? 16 / 9,
              gridBtnEl: refs.gridBtnRef()?.nativeElement,
              renderer,
              showForcedTitleBar: () => refs.pipWindowRef()?.forcedTitleBar.set(true),
              hideForcedTitleBar: () => refs.pipWindowRef()?.forcedTitleBar.set(false),
            });
          }
        }
      }
    }

    const pending = pendingFlips;
    if (!pending.length) return;
    pendingFlips = [];

    for (const item of pending) {
      const toRect = item.el.getBoundingClientRect();
      if (toRect.width > 0 && toRect.height > 0) {
        animateElementTo({ el: item.el, fromRect: item.fromRect, toRect });
      }
    }
  });

  return { enterMultiView, exitMultiView, toggleMultiView, selectCell };
}
