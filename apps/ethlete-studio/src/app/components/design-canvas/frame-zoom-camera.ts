import { computed, linkedSignal, signal, untracked } from '@angular/core';
import { Camera, clampZoom, panInsideRoom, Point } from './canvas-math';
import { panRoomOf } from './frame-zoom-viewport';

export type FrameZoom = 'fit' | number;

export type FrameZoomOpening = { x: number; y: number; zoom: FrameZoom };

type FrameZoomState = FrameZoomOpening & { moved: boolean };

const samePoint = (a: Point, b: Point) => a.x === b.x && a.y === b.y;

/**
 * The camera of a frame zoom viewport: pan and a zoom that stays `'fit'` until the user zooms. The opening camera is
 * kept inside the content; once the user moves it, it is free, and it follows the viewport when the viewport's left
 * edge moves, so the frames stay where they are on screen.
 */
export const frameZoomCamera = (opening: () => FrameZoomOpening) => {
  const state = linkedSignal<FrameZoomState>(() => ({ ...opening(), moved: false }));
  const room = signal<Point>({ x: 0, y: 0 }, { equal: samePoint });
  const zoom = computed(() => state().zoom);
  const pan = computed<Point>(() => {
    const { x, y, moved } = state();

    return moved ? { x, y } : panInsideRoom({ x, y }, room());
  });
  let originLeft: number | null = null;

  return {
    zoom,
    pan,
    stickyLeft: computed(() => Math.max(0, -pan().x)),
    transform: computed(() => `translate(${pan().x}px, ${pan().y}px) scale(1)`),

    /** Moves to `camera`; a zoom equal to `shownZoom` keeps `'fit'`. Returns the camera with its zoom clamped. */
    move: (camera: Camera, shownZoom: number): Camera => {
      const clamped = clampZoom(camera.zoom);

      state.set({ x: camera.x, y: camera.y, zoom: clamped === shownZoom ? zoom() : clamped, moved: true });

      return { ...camera, zoom: clamped };
    },

    fit: () => state.set({ x: 0, y: 0, zoom: 'fit', moved: false }),

    /** Reads the pan room and the viewport's left edge; call it after every layout change. */
    measure: (viewport: HTMLElement, content: HTMLElement) => {
      const left = viewport.getBoundingClientRect().left;
      const shift = originLeft === null ? 0 : originLeft - left;

      originLeft = left;
      room.set(panRoomOf(viewport, content));
      untracked(() => {
        const current = zoom();

        if (shift !== 0 && current !== 'fit') state.set({ x: pan().x + shift, y: pan().y, zoom: current, moved: true });
      });
    },
  };
};

export type FrameZoomCamera = ReturnType<typeof frameZoomCamera>;
