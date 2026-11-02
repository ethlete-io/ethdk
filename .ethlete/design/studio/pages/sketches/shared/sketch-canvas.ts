import { type Camera, type Rect } from 'ethlete-studio/canvas';

type Focus = { zoom: number; frame?: number; dx?: number; dy?: number };

export type View = 'fit' | '100' | Camera | Focus;

export const measureFrames = (world: HTMLElement): Rect[] =>
  [...world.querySelectorAll<HTMLElement>('.sk-frame')].map((element) => ({
    x: element.offsetLeft,
    y: element.offsetTop,
    width: element.offsetWidth,
    height: element.offsetHeight,
  }));

const bounds = (frames: Rect[]): Rect => {
  const x = Math.min(...frames.map((frame) => frame.x));
  const y = Math.min(...frames.map((frame) => frame.y));
  const right = Math.max(...frames.map((frame) => frame.x + frame.width));
  const bottom = Math.max(...frames.map((frame) => frame.y + frame.height));
  return { x, y, width: right - x, height: bottom - y };
};

export const aim = (viewport: HTMLElement, frames: Rect[], view: Camera | Focus): Camera => {
  if ('x' in view) return view;
  const target = (view.frame === undefined ? undefined : frames[view.frame]) ?? bounds(frames);
  const { zoom } = view;
  if (view.dx === undefined || view.dy === undefined) {
    return {
      zoom,
      x: viewport.clientWidth / 2 - (target.x + target.width / 2) * zoom,
      y: viewport.clientHeight / 2 - (target.y + target.height / 2) * zoom,
    };
  }
  return { zoom, x: -(target.x + view.dx) * zoom, y: -(target.y + view.dy) * zoom };
};

export const projectColumn = (viewport: HTMLElement, camera: Camera, column: Rect) => {
  const start = viewport.offsetLeft + camera.x + column.x * camera.zoom;
  const top = viewport.offsetTop + camera.y + column.y * camera.zoom;
  return {
    start,
    end: start + column.width * camera.zoom,
    top,
    bottom: top + column.height * camera.zoom,
    left: Math.max(viewport.offsetLeft, start),
    right: Math.min(viewport.offsetLeft + viewport.clientWidth, start + column.width * camera.zoom),
  };
};
