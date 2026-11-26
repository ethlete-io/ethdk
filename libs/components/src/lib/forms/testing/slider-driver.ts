import { Provider, Type } from '@angular/core';
import { ComponentFixture } from '@angular/core/testing';
import { createControlDriver, mountControl } from '../../testing/control-driver';
import { focusEvent, pressKey, textOf, tick } from '../../testing/driver-core';
import { RangeSliderDirective, SliderDirective, SliderOrientation } from '../slider/headless';

const THUMB_POSITION = '--_et-slider-thumb-position';

const TRACK_RECTS: Record<SliderOrientation, DOMRect> = {
  horizontal: { left: 0, width: 100, top: 0, height: 28, right: 100, bottom: 28, x: 0, y: 28 } as DOMRect,
  vertical: { left: 0, width: 28, top: 0, height: 100, right: 28, bottom: 100, x: 0, y: 0 } as DOMRect,
};

/**
 * jsdom measures every element as 0x0, so a slider can map no pointer position until its track
 * reports a size. Every driver stubs the horizontal rect at mount; switch it with `stubTrack`.
 */
const createSliderDriverCore = <T, D>(fixture: ComponentFixture<T>, directiveType: Type<D>, prefix: string) => {
  const base = createControlDriver(fixture, directiveType, { directiveSelector: prefix });

  const sliderEl = () => base.query(prefix)!;
  const trackEl = () => base.query(`.${prefix}-interaction`)!;
  const fillEl = () => base.query(`.${prefix}-fill`)!;
  const thumbEls = () => base.queryAll(`.${prefix}-thumb`);
  const thumbEl = (index = 0) => thumbEls()[index]!;
  const markEls = () => base.queryAll(`.${prefix}-mark`);

  const cssVar = (element: HTMLElement, name: string) => element.style.getPropertyValue(name);

  const stubTrack = (orientation: SliderOrientation) => {
    const rect = TRACK_RECTS[orientation];

    trackEl().getBoundingClientRect = () => rect;
  };

  stubTrack('horizontal');

  return {
    ...base,

    sliderEl,
    attr: (name: string) => sliderEl().getAttribute(name),
    hasAttr: (name: string) => sliderEl().hasAttribute(name),

    thumbEls,
    thumbAttr: (name: string, index = 0) => thumbEl(index).getAttribute(name),
    thumbAttrs: (name: string) => thumbEls().map((thumb) => thumb.getAttribute(name)),
    thumbPosition: (index = 0) => cssVar(thumbEl(index), THUMB_POSITION),
    thumbPositions: () => thumbEls().map((thumb) => cssVar(thumb, THUMB_POSITION)),
    thumbTouchActions: () => thumbEls().map((thumb) => thumb.style.touchAction),

    trackTouchAction: () => trackEl().style.touchAction,
    fillStart: () => cssVar(fillEl(), '--_et-slider-fill-start'),
    fillEnd: () => cssVar(fillEl(), '--_et-slider-fill-end'),

    marksEl: () => base.query(`.${prefix}-marks`),
    markEls,
    markPositions: () => markEls().map((mark) => cssVar(mark, '--_et-slider-mark-position')),
    markActives: () => markEls().map((mark) => mark.hasAttribute('data-active')),
    markLabels: () => markEls().map(textOf),

    press: (key: string, thumbIndex = 0) => pressKey(thumbEl(thumbIndex), key),
    blurThumb: (thumbIndex = 0) => focusEvent(thumbEl(thumbIndex), 'blur'),

    pointer: (type: string, clientX: number, clientY = 0) => {
      trackEl().dispatchEvent(new MouseEvent(type, { clientX, clientY, bubbles: true, button: 0 }));
      tick();
    },
    pointerOnMark: (index: number, clientX = 0) => {
      markEls()[index]!.dispatchEvent(new MouseEvent('pointerdown', { clientX, bubbles: true, button: 0 }));
      tick();
    },

    stubTrack,
  };
};

export const createSliderDriver = <T>(fixture: ComponentFixture<T>) =>
  createSliderDriverCore(fixture, SliderDirective, 'et-slider');

export const createRangeSliderDriver = <T>(fixture: ComponentFixture<T>) =>
  createSliderDriverCore(fixture, RangeSliderDirective, 'et-range-slider');

export type SliderDriver<T> = ReturnType<typeof createSliderDriver<T>>;
export type RangeSliderDriver<T> = ReturnType<typeof createRangeSliderDriver<T>>;

export const mountSlider = <T>(component: Type<T>, providers: Provider[] = []) =>
  createSliderDriver(mountControl(component, providers));

export const mountRangeSlider = <T>(component: Type<T>, providers: Provider[] = []) =>
  createRangeSliderDriver(mountControl(component, providers));
