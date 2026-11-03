import { OVERLAY_PANE_SELECTOR } from './see-through';

/** The rule a declared action or a projected region breaks when an opaque element of another subtree paints above it. */
export const COVERED_RULE = 'COVERED';

/** The rule a declared action breaks when the state that draws it hides it, fades it out, shrinks it to nothing or buries it. */
export const UNREACHABLE_RULE = 'UNREACHABLE';

const ACTION_SAMPLES_PER_SIDE = 3;
const REGION_SAMPLES_PER_SIDE = 5;
const OPAQUE = 0.95;
const PAN_STEP = 32;
const PAN_MAX_STEPS = 200;

/**
 * The statements of the reach check inside the frame script of `render-check`. They use `root`, `report` and
 * `pathOf` of that script. Each `data-et-action` element must be shown, sized and hit by a click at some point of its
 * unclipped box; each point where an opaque element of another subtree paints above an action, or above a projected
 * region nested in another projected region from inside that outer region, is a cover. An action inside such a nested
 * region is preview content and is not judged. The click pass runs before `pointer-events` is forced on for the paint pass, and the force is removed.
 */
export const REACH_STATEMENTS = `
  {
    const floating = ${JSON.stringify(OVERLAY_PANE_SELECTOR + ', [role="tooltip"]')};
    const alphaOf = (colour) => {
      if (colour === 'transparent') return 0;
      const slash = /\\/\\s*([\\d.]+)(%?)\\s*\\)$/.exec(colour);
      if (slash) return parseFloat(slash[1]) / (slash[2] ? 100 : 1);
      const rgba = /^rgba\\([^,]+,[^,]+,[^,]+,\\s*([\\d.]+)\\s*\\)$/.exec(colour);
      return rgba ? parseFloat(rgba[1]) : 1;
    };
    const opacityOf = (element) => {
      let opacity = 1;
      for (let at = element; at; at = at.parentElement) opacity *= parseFloat(getComputedStyle(at).opacity);
      return opacity;
    };
    const solid = (element) => {
      const style = getComputedStyle(element);
      const paints = element.matches('img, video, canvas, iframe, object, embed') || style.backgroundImage !== 'none' || alphaOf(style.backgroundColor) >= ${OPAQUE};
      return paints && style.visibility === 'visible' && opacityOf(element) >= ${OPAQUE};
    };
    const coverOf = (hit, target, opaqueOnly, within) => {
      if (!hit || target.contains(hit) || hit.contains(target) || hit.closest(floating) || !within.contains(hit)) return null;
      for (let at = hit; at && !at.contains(target); at = at.parentElement) if (!opaqueOnly || solid(at)) return at;
      return null;
    };
    const visibleBoxOf = (element) => {
      const rect = element.getBoundingClientRect();
      const box = { left: Math.max(rect.left, 0), top: Math.max(rect.top, 0), right: Math.min(rect.right, innerWidth), bottom: Math.min(rect.bottom, innerHeight) };
      for (let at = element.parentElement; at && at !== document.documentElement; at = at.parentElement) {
        const style = getComputedStyle(at);
        if (style.overflowX === 'visible' && style.overflowY === 'visible') continue;
        const clip = at.getBoundingClientRect();
        const left = clip.left + at.clientLeft;
        const top = clip.top + at.clientTop;
        if (style.overflowX !== 'visible') [box.left, box.right] = [Math.max(box.left, left), Math.min(box.right, left + at.clientWidth)];
        if (style.overflowY !== 'visible') [box.top, box.bottom] = [Math.max(box.top, top), Math.min(box.bottom, top + at.clientHeight)];
      }
      return box.right - box.left > 2 && box.bottom - box.top > 2 ? box : null;
    };
    const pointsOf = (box, perSide) => {
      const points = [];
      for (let x = 0; x < perSide; x++)
        for (let y = 0; y < perSide; y++)
          points.push([box.left + 1 + ((box.right - box.left - 2) * (x + 0.5)) / perSide, box.top + 1 + ((box.bottom - box.top - 2) * (y + 0.5)) / perSide]);
      return points;
    };
    const coversOf = (target, box, perSide, opaqueOnly, within = document.documentElement) => {
      const covers = new Map();
      const points = pointsOf(box, perSide);
      for (const [x, y] of points) {
        const cover = coverOf(document.elementFromPoint(x, y), target, opaqueOnly, within);
        if (cover) covers.set(cover, (covers.get(cover) ?? 0) + 1);
      }
      const hits = [...covers.values()].reduce((sum, count) => sum + count, 0);
      const most = [...covers.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      return { hits, total: points.length, most };
    };
    const labelOf = (element) => {
      const text = (element.getAttribute('aria-label') || element.textContent || '').trim().replace(/\\s+/g, ' ');
      const short = text.length > 32 ? text.slice(0, 31) + '…' : text;
      return (short ? '"' + short + '" ' : '') + '(' + element.getAttribute('data-et-action') + ')';
    };
    const hiddenOf = (element) => {
      let gone = null;
      for (let at = element; at && at !== root; at = at.parentElement) {
        if (at.hasAttribute('hidden') || at.matches('template')) return { skip: true };
        if (!gone && getComputedStyle(at).display === 'none') gone = at;
      }
      if (gone) return { why: 'not displayed (display: none on ' + pathOf(gone) + ')' };
      const style = getComputedStyle(element);
      if (style.visibility !== 'visible') return { why: 'hidden (visibility: ' + style.visibility + ')' };
      for (let at = element; at && at !== root; at = at.parentElement)
        if (parseFloat(getComputedStyle(at).opacity) === 0) return { why: 'invisible (opacity 0 on ' + pathOf(at) + ')' };
      const rect = element.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return { why: 'zero-size (' + Math.round(rect.width) + 'x' + Math.round(rect.height) + ')' };
      if (style.pointerEvents === 'none') return { why: 'not clickable (pointer-events: none)' };
      return null;
    };
    const previewed = (element) => element.closest('[data-et-projected]')?.parentElement?.closest('[data-et-projected]');
    const actions = [...root.querySelectorAll('[data-et-action]')].filter((element) => !element.closest('[inert], [aria-hidden="true"]') && !previewed(element));
    const shownActions = [];
    for (const element of actions) {
      const hidden = hiddenOf(element);
      if (hidden?.skip) continue;
      if (hidden) report('${UNREACHABLE_RULE}', element, labelOf(element) + ' is ' + hidden.why + ' in a state that declares it, so it can not be pressed');
      else shownActions.push(element);
    }
    const force = document.createElement('style');
    force.textContent = '* { pointer-events: auto !important; }';
    const judge = (pose) => {
      const sampled = [];
      for (const element of shownActions) {
        const box = visibleBoxOf(element);
        if (box) sampled.push({ element, points: pointsOf(box, ${ACTION_SAMPLES_PER_SIDE}).map((point) => ({ point, click: null, cover: null })) });
      }
      for (const { points, element } of sampled)
        for (const sample of points) sample.click = coverOf(document.elementFromPoint(...sample.point), element, false, document.documentElement);
      document.head.append(force);
      try {
        for (const { points, element } of sampled)
          for (const sample of points) sample.cover = coverOf(document.elementFromPoint(...sample.point), element, true, document.documentElement) ?? sample.click;
      } finally {
        force.remove();
      }
      for (const { element, points } of sampled) {
        const counts = new Map();
        for (const { cover } of points) if (cover) counts.set(cover, (counts.get(cover) ?? 0) + 1);
        const hits = [...counts.values()].reduce((sum, count) => sum + count, 0);
        if (hits === 0) continue;
        const most = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
        if (points.every(({ click }) => click)) {
          report('${UNREACHABLE_RULE}', element, labelOf(element) + ' is covered: a click at any point of it lands on ' + pathOf(most) + pose);
          continue;
        }
        const under = solid(most) ? 'the opaque ' + pathOf(most) : pathOf(most) + ', which takes the click there';
        report('${COVERED_RULE}', element, labelOf(element) + ': ' + hits + ' of ' + points.length + ' points lie under ' + under + pose);
      }
    };
    judge('');
    const placesOf = (elements) => elements.map((element) => element.getBoundingClientRect()).map((rect) => [rect.left, rect.top]);
    const wheel = (canvas, x, y) => canvas.dispatchEvent(new WheelEvent('wheel', { deltaX: x, deltaY: y, bubbles: true, cancelable: true }));
    const canvases = new Set();
    for (const element of shownActions)
      for (let at = element.parentElement; at && at !== root; at = at.parentElement) {
        const style = getComputedStyle(at);
        if (style.overflowX !== 'visible' || style.overflowY !== 'visible') canvases.add(at);
      }
    for (const canvas of canvases) {
      const inside = shownActions.filter((element) => canvas.contains(element));
      for (const [dx, dy, way] of [[1, 0, 'right'], [-1, 0, 'left'], [0, 1, 'down'], [0, -1, 'up']]) {
        const start = placesOf(inside);
        for (let step = 1; step <= ${PAN_MAX_STEPS}; step++) {
          const before = placesOf(inside).join(' ');
          wheel(canvas, dx * ${PAN_STEP}, dy * ${PAN_STEP});
          if (placesOf(inside).join(' ') === before) break;
          judge(' when ' + pathOf(canvas) + ' is panned ' + step * ${PAN_STEP} + 'px ' + way);
        }
        const back = placesOf(inside)
          .map(([left, top], index) => [left - start[index][0], top - start[index][1]])
          .sort((a, b) => Math.abs(b[0]) + Math.abs(b[1]) - Math.abs(a[0]) - Math.abs(a[1]))[0];
        if (back[0] || back[1]) wheel(canvas, back[0], back[1]);
      }
    }
    document.head.append(force);
    try {
      for (const element of root.querySelectorAll('[data-et-projected]')) {
        const outer = element.parentElement?.closest('[data-et-projected]');
        if (!outer || element.closest('[inert], [aria-hidden="true"]') || element.getClientRects().length === 0) continue;
        const box = visibleBoxOf(element);
        if (!box) continue;
        const covered = coversOf(element, box, ${REGION_SAMPLES_PER_SIDE}, true, outer);
        if (covered.hits > 0)
          report('${COVERED_RULE}', element, 'the projected region "' + element.getAttribute('data-et-projected') + '": ' + covered.hits + ' of ' + covered.total + ' points lie under the opaque ' + pathOf(covered.most));
      }
    } finally {
      force.remove();
    }
  }
`;
