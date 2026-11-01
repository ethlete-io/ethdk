import { Browser } from '../thumb';
import { OVERLAY_ROOTS } from './action-press';

type Page = Awaited<ReturnType<Awaited<ReturnType<Browser['newContext']>>['newPage']>>;

const SAMPLES_PER_SIDE = 5;

const OCCLUDED_SCRIPT = `(({ host, port, overlayRoots, samples }) => {
  const root = document.querySelector(host);

  if (!root) return [];

  const rootBox = root.getBoundingClientRect();
  const describe = (element) => {
    const name = element.getAttribute('class');

    return '<' + element.localName + (name ? ' class="' + name + '"' : '') + '>';
  };
  const pinned = (element) => ['fixed', 'sticky'].includes(getComputedStyle(element).position);
  const moves = (element) => {
    const style = getComputedStyle(element);

    return style.transform !== 'none' || [style.overflowX, style.overflowY].some((value) => value === 'auto' || value === 'scroll');
  };
  const pathUpTo = (element, end) => {
    const path = [];

    for (let current = element; current && current !== end; current = current.parentElement) path.push(current);

    return path;
  };
  const visibleBoxOf = (element) => {
    const box = element.getBoundingClientRect();
    let left = Math.max(box.left, 0);
    let top = Math.max(box.top, 0);
    let right = Math.min(box.right, innerWidth);
    let bottom = Math.min(box.bottom, innerHeight);

    for (let current = element.parentElement; current; current = current.parentElement) {
      const style = getComputedStyle(current);

      if (style.overflowX === 'visible' && style.overflowY === 'visible') continue;

      const clip = current.getBoundingClientRect();

      left = Math.max(left, clip.left);
      top = Math.max(top, clip.top);
      right = Math.min(right, clip.right);
      bottom = Math.min(bottom, clip.bottom);
    }

    return { left, top, right, bottom };
  };
  const coverOf = (frame, hit) => {
    if (!hit || hit === frame || frame.contains(hit) || hit.closest(overlayRoots)) return null;

    let common = hit;

    while (common && !common.contains(frame)) common = common.parentElement;

    const coverPath = pathUpTo(hit, common);

    return coverPath.some(pinned) || pathUpTo(frame.parentElement, common).some(moves) ? coverPath[coverPath.length - 1] : null;
  };
  const frames = [...root.querySelectorAll('img[src], iframe[src]')].filter((element) => {
    try {
      return new URL(element.src, location.href).port === String(port);
    } catch {
      return false;
    }
  });

  return frames.flatMap((frame) => {
    const { left, top, right, bottom } = visibleBoxOf(frame);

    if (right - left < 1 || bottom - top < 1) return [];

    const covers = [];

    for (let row = 0; row < samples; row++)
      for (let column = 0; column < samples; column++) {
        const x = left + 0.5 + ((right - left - 1) * column) / (samples - 1);
        const y = top + 0.5 + ((bottom - top - 1) * row) / (samples - 1);
        const cover = coverOf(frame, document.elementFromPoint(x, y));

        if (cover) covers.push(cover);
      }

    if (covers.length === 0) return [];

    const box = frame.getBoundingClientRect();

    return [
      'the design frame ' + describe(frame).replace(/ class="[^"]*"/, '') + ' at ' +
        Math.round(box.left - rootBox.left) + ',' + Math.round(box.top - rootBox.top) + ' ' +
        Math.round(box.width) + 'x' + Math.round(box.height) + ' sits under ' + describe(covers[0]) +
        ' (' + covers.length + ' of ' + samples * samples + ' sample points)',
    ];
  });
})`;

/**
 * What covers each design frame inside `host`: an `img` or `iframe` the design server on `port` draws, with a point a
 * fixed or sticky element paints over, or an element that stays put while the frame moves with a transformed or
 * scrolled container. Overlay panes do not count.
 */
export const occludedFramesOf = (options: { page: Page; host: string; port: number }) =>
  options.page.evaluate(
    `${OCCLUDED_SCRIPT}(${JSON.stringify({
      host: options.host,
      port: options.port,
      overlayRoots: OVERLAY_ROOTS,
      samples: SAMPLES_PER_SIDE,
    })})`,
  ) as Promise<string[]>;
