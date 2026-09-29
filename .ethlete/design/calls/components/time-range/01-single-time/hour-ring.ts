import { CENTER, VALUE, point, ringBase } from './fixture';

/** The hour ring of C: the base ring and one handle snapped to the whole hour. */
export const hourRing = () => {
  const at = point(VALUE.hour, 24, 112);
  return `${ringBase()}<circle class="handle" cx="${at.x}" cy="${at.y}" r="12" />`;
};

export const center = CENTER;
