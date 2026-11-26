import { scrollToElement } from '../index';
import { useScenario } from './harness';

const SLOT = 100;
const VISIBLE_SLOTS = 3;
const SLOTS = 6;

const rect = (left: number, top: number, width: number, height: number) =>
  ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  }) as DOMRect;

const createTrack = (axis: 'inline' | 'block') => {
  const track = document.createElement('div');
  const writes: ScrollToOptions[] = [];
  const span = SLOT * VISIBLE_SLOTS;
  const extent = SLOT * SLOTS;

  Object.defineProperties(track, {
    clientWidth: { value: axis === 'inline' ? span : SLOT },
    clientHeight: { value: axis === 'block' ? span : SLOT },
    scrollWidth: { value: axis === 'inline' ? extent : SLOT },
    scrollHeight: { value: axis === 'block' ? extent : SLOT },
    scrollLeft: { value: 0 },
    scrollTop: { value: 0 },
    scrollTo: { value: (options: ScrollToOptions) => writes.push(options) },
  });
  track.getBoundingClientRect = () => (axis === 'inline' ? rect(0, 0, span, SLOT) : rect(0, 0, SLOT, span));

  const items = Array.from({ length: SLOTS }, (_, index) => {
    const item = document.createElement('div');
    const offset = index * SLOT;

    item.getBoundingClientRect = () => (axis === 'inline' ? rect(offset, 0, SLOT, SLOT) : rect(0, offset, SLOT, SLOT));
    track.appendChild(item);

    return item;
  });

  return { track, items, writes };
};

describe('scroll into view scenarios', () => {
  const scenario = useScenario();

  it.each(['inline', 'block'] as const)(
    'brings the %s item that starts exactly at the track end into view',
    (direction) => {
      scenario();
      const { track, items, writes } = createTrack(direction);

      scrollToElement({ container: track, element: items[VISIBLE_SLOTS], direction, behavior: 'auto' });

      const axis = direction === 'inline' ? 'left' : 'top';
      expect(writes.map((write) => write[axis])).toEqual([SLOT]);
    },
  );

  it.each(['inline', 'block'] as const)('leaves a %s item flush with the track end where it is', (direction) => {
    scenario();
    const { track, items, writes } = createTrack(direction);

    scrollToElement({ container: track, element: items[VISIBLE_SLOTS - 1], direction, behavior: 'auto' });
    scrollToElement({ container: track, element: items[0], direction, behavior: 'auto' });

    const axis = direction === 'inline' ? 'left' : 'top';
    expect(writes.map((write) => write[axis])).toEqual([0, 0]);
  });
});
