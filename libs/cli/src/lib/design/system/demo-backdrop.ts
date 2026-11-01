import { CompletenessGap, SeenFrame } from './complete';

const TRANSPARENT = new Set(['transparent', 'rgba(0, 0, 0, 0)']);

/**
 * A page script over the frame root `root`: the `data-et-part` root of `part` when it paints the very fill of the
 * surface it sits on, as `{ path, fill }`, else `null`. A control or a surface root is never one.
 */
export const findDemoBackdrop = (part: string) => `((root) => {
  const own = [root, ...root.querySelectorAll('[data-et-part]')].find((element) => (element.getAttribute('data-et-part') ?? '').split(' ').includes(${JSON.stringify(part)}));
  if (!own || !own.parentElement || own.hasAttribute('data-et-control') || own.hasAttribute('data-et-surface')) return null;
  const fill = getComputedStyle(own).backgroundColor;
  if (${JSON.stringify([...TRANSPARENT])}.includes(fill)) return null;
  const probe = document.createElement('div');
  probe.style.backgroundColor = 'rgb(var(--et-surface-background))';
  own.parentElement.appendChild(probe);
  const under = getComputedStyle(probe).backgroundColor;
  probe.remove();
  if (under !== fill) return null;
  const cls = [...own.classList].find((name) => /^[a-z][\\w-]*$/i.test(name));
  return { path: own.tagName.toLowerCase() + (cls ? '.' + cls : ''), fill };
})`;

/** A `DEMO-BACKDROP` gap when a drawn frame of `part` paints its root in the fill of the surface under it. */
export const demoBackdropGapsOf = (options: { part: string; frames: SeenFrame[] }): CompletenessGap[] => {
  const painted = options.frames.filter((frame) => frame.backdrop);
  const first = painted[0]?.backdrop;

  if (!first) return [];

  const states = [...new Set(painted.map((frame) => frame.state))];

  return [
    {
      code: 'DEMO-BACKDROP',
      target: options.part,
      detail: `${states.join(', ')}: the part root ${first.path} paints the surface it sits on (${first.fill}), a demo backdrop the app part does not draw - drop the fill from the drawing and let the part stay transparent`,
    },
  ];
};
