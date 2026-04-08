import { take, timer } from 'rxjs';
import type { AngularRenderer } from '@ethlete/core';

export const animateWithFixedWrapper = (config: {
  playerEl: HTMLElement;
  fromRect: DOMRect;
  toRect: DOMRect;
  document: Document;
  renderer: AngularRenderer;
  onFinish: () => void;
  duration?: number;
  easing?: string;
}) => {
  const {
    playerEl,
    fromRect,
    toRect,
    document,
    renderer,
    onFinish,
    duration = 250,
    easing = 'cubic-bezier(0.4, 0, 0.2, 1)',
  } = config;

  const dx = toRect.left - fromRect.left;
  const dy = toRect.top - fromRect.top;
  const sx = fromRect.width > 0 ? toRect.width / fromRect.width : 1;
  const sy = fromRect.height > 0 ? toRect.height / fromRect.height : 1;
  const finalTransform = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;

  const wrapper = renderer.createElement('div');
  renderer.setStyle(wrapper, {
    position: 'fixed',
    left: `${fromRect.left}px`,
    top: `${fromRect.top}px`,
    width: `${fromRect.width}px`,
    height: `${fromRect.height}px`,
    overflow: 'hidden',
    pointerEvents: 'none',
    zIndex: '2147483647',
  });
  renderer.appendChild(document.body, wrapper);
  renderer.moveBefore({ newParent: wrapper, child: playerEl, before: null });

  const anim = wrapper.animate(
    [
      { transformOrigin: 'top left', transform: 'none' },
      { transformOrigin: 'top left', transform: finalTransform },
    ],
    { duration, easing },
  );

  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    renderer.setStyle(wrapper, { transform: finalTransform, transformOrigin: 'top left', visibility: 'hidden' });
    anim.cancel();
    onFinish();
    renderer.removeChild(document.body, wrapper);
  };

  anim.onfinish = cleanup;
  anim.oncancel = cleanup;
};

export const animateElementTo = (config: {
  el: HTMLElement;
  fromRect: DOMRect;
  toRect: DOMRect;
  duration?: number;
  easing?: string;
}) => {
  const { el, fromRect, toRect, duration = 250, easing = 'cubic-bezier(0.4, 0, 0.2, 1)' } = config;
  const parent = el.parentElement;
  if (!parent) return;
  const pRect = parent.getBoundingClientRect();
  if (!pRect.width || !pRect.height) return;

  const mk = (r: DOMRect) =>
    `translate(${r.left - pRect.left}px,${r.top - pRect.top}px) scale(${r.width / pRect.width},${r.height / pRect.height})`;

  el.animate(
    [
      { transform: mk(fromRect), transformOrigin: 'top left', composite: 'replace' },
      { transform: mk(toRect), transformOrigin: 'top left', composite: 'replace' },
    ],
    { duration, easing },
  );
};

export const animatePulse = (el: HTMLElement) => {
  el.animate(
    [
      { transform: 'scale(1)', offset: 0 },
      { transform: 'scale(1)', offset: 0.15 },
      { transform: 'scale(1.22)', offset: 0.4 },
      { transform: 'scale(0.92)', offset: 0.65 },
      { transform: 'scale(1.06)', offset: 0.82 },
      { transform: 'scale(1)', offset: 1 },
    ],
    { duration: 600, easing: 'ease-out', fill: 'none' },
  );
};

export const animateScaleFadeIn = (el: HTMLElement) => {
  el.animate(
    [
      { transform: 'scale(0.85)', opacity: '0' },
      { transform: 'scale(1)', opacity: '1' },
    ],
    { duration: 200, easing: 'ease-out' },
  );
};

export const animateScaleFadeOut = (el: HTMLElement, config: { onFinish: () => void }) => {
  const anim = el.animate(
    [
      { transform: 'scale(1)', opacity: '1' },
      { transform: 'scale(0.85)', opacity: '0' },
    ],
    { duration: 160, easing: 'ease-in', fill: 'forwards' },
  );
  anim.onfinish = () => config.onFinish();
};

export type NewPipAnimationConfig = {
  cell: HTMLElement;
  stageEl: HTMLElement;
  stageRect: DOMRect;
  /** Natural aspect ratio of the video being animated (width/height). */
  aspectRatio: number;
  gridBtnEl: HTMLElement | undefined;
  renderer: AngularRenderer;
  showForcedTitleBar: () => void;
  hideForcedTitleBar: () => void;
};

export const animateNewPipInSingleMode = (config: NewPipAnimationConfig) => {
  const {
    cell,
    stageEl,
    stageRect,
    aspectRatio,
    gridBtnEl: gridBtn,
    renderer,
    showForcedTitleBar,
    hideForcedTitleBar,
  } = config;

  if (!stageRect.width || !stageRect.height) return;

  const videoW = Math.min(stageRect.width, stageRect.height * aspectRatio);
  const videoH = Math.min(stageRect.height, stageRect.width / aspectRatio);
  const videoX = (stageRect.width - videoW) / 2;
  const videoY = (stageRect.height - videoH) / 2;

  renderer.setStyle(cell, { width: `${videoW}px`, height: `${videoH}px`, left: `${videoX}px`, top: `${videoY}px` });

  const holdDuration = 550;
  const flyDuration = 350;
  const fadeInFrac = 0.15;

  const thumbW = videoW * 0.22;
  const thumbH = videoH * 0.22;
  const thumbSx = thumbW / videoW;
  const thumbSy = thumbH / videoH;

  const btnRectNow = gridBtn?.getBoundingClientRect();

  const showDxMax = stageRect.width - videoX - thumbW - 4;
  let showDx = showDxMax;
  if (btnRectNow && btnRectNow.width > 0) {
    const cx = btnRectNow.left + btnRectNow.width / 2 - (stageRect.left + videoX);
    showDx = Math.min(Math.max(-videoX, cx - thumbW / 2), showDxMax);
  }
  const showDy = 4 - videoY;

  showForcedTitleBar();
  renderer.setStyle(stageEl, { overflow: 'visible' });
  const phase1 = cell.animate(
    [
      {
        transform: `translate(${showDx}px,${showDy}px) scale(${thumbSx},${thumbSy})`,
        transformOrigin: 'top left',
        opacity: '0',
      },
      {
        transform: `translate(${showDx}px,${showDy}px) scale(${thumbSx},${thumbSy})`,
        transformOrigin: 'top left',
        opacity: '1',
        offset: fadeInFrac,
      },
      {
        transform: `translate(${showDx}px,${showDy}px) scale(${thumbSx},${thumbSy})`,
        transformOrigin: 'top left',
        opacity: '1',
      },
    ],
    { duration: holdDuration, fill: 'forwards' },
  );

  phase1.onfinish = () => {
    const freshStageRect = stageEl.getBoundingClientRect();
    const freshBtnRect = gridBtn?.getBoundingClientRect();
    const freshVideoX = (freshStageRect.width - videoW) / 2;
    const freshVideoY = (freshStageRect.height - videoH) / 2;

    const freshShowDx = showDx + (stageRect.left + videoX) - (freshStageRect.left + freshVideoX);
    const freshShowDy = showDy + (stageRect.top + videoY) - (freshStageRect.top + freshVideoY);

    const exitScaleW = thumbW * 0.15;
    const exitScaleH = thumbH * 0.15;
    const exitSx = thumbSx * 0.15;
    const exitSy = thumbSy * 0.15;

    let exitDx: number;
    let exitDy: number;
    if (freshBtnRect && freshBtnRect.width > 0) {
      exitDx = freshBtnRect.left + freshBtnRect.width / 2 - (freshStageRect.left + freshVideoX) - exitScaleW / 2;
      exitDy = freshBtnRect.top + freshBtnRect.height / 2 - (freshStageRect.top + freshVideoY) - exitScaleH / 2;
    } else {
      exitDx = freshShowDx + thumbW * 0.4;
      exitDy = freshShowDy - thumbH;
    }

    gridBtn?.animate(
      [
        { transform: 'scale(1)', offset: 0 },
        { transform: 'scale(1.5)', offset: 0.4 },
        { transform: 'scale(1)', offset: 1 },
      ],
      { duration: 400, easing: 'cubic-bezier(0.4,0,0.2,1)', fill: 'none' },
    );

    const phase2 = cell.animate(
      [
        {
          transform: `translate(${freshShowDx}px,${freshShowDy}px) scale(${thumbSx},${thumbSy})`,
          transformOrigin: 'top left',
          opacity: '1',
        },
        {
          transform: `translate(${exitDx}px,${exitDy}px) scale(${exitSx},${exitSy})`,
          transformOrigin: 'top left',
          opacity: '0',
        },
      ],
      { duration: flyDuration, easing: 'ease-in', fill: 'none' },
    );

    phase2.onfinish = () => {
      renderer.setStyle(cell, { width: null, height: null, left: null, top: null });
      phase1.cancel();
      renderer.removeStyle(stageEl, 'overflow');
      timer(100)
        .pipe(take(1))
        .subscribe(() => hideForcedTitleBar());
    };
  };
};
