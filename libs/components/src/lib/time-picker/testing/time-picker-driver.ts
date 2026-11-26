import { angleToPoint, minuteToAngle } from '../headless/internals/time-ring';
import { TimeRangeSide } from '../headless/time-picker.directive';

const RING_SIZE = 280;

export const timeRing = (root: ParentNode = document) => {
  const ring = root.querySelector<HTMLElement>('[etTimePickerRing]');

  if (!ring) throw new Error('no time ring');

  return ring;
};

export const ringHandle = (side: TimeRangeSide = 'start', root: ParentNode = document) => {
  const handle = root.querySelector<HTMLElement>(`[etTimePickerRingHandle][data-side='${side}']`);

  if (!handle) throw new Error(`no ${side} ring handle`);

  return handle;
};

export const minuteOfDay = (hours: number, minutes = 0) => hours * 60 + minutes;

export const layOutRing = (ring: HTMLElement) => {
  ring.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 0, width: RING_SIZE, height: RING_SIZE });
};

export const tapRing = (ring: HTMLElement, minute: number) => {
  layOutRing(ring);

  const point = angleToPoint(minuteToAngle(minute), { x: RING_SIZE / 2, y: RING_SIZE / 2, radius: RING_SIZE * 0.4 });
  const init = { clientX: point.x, clientY: point.y, pointerId: 1, button: 0, bubbles: true };

  ring.dispatchEvent(new PointerEvent('pointerdown', init));
  ring.dispatchEvent(new PointerEvent('pointerup', init));
};

export const ringReadout = (root: ParentNode = document) =>
  root.querySelector('.et-time-picker-readout')?.textContent?.trim() ?? null;

export const ringNote = (root: ParentNode = document) =>
  root.querySelector('.et-time-picker-note')?.textContent?.trim() ?? null;
