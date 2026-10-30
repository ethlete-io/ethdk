import { Camera, Point, Rect, Size, rectsIntersect, screenToWorld, visibleWorldRect } from './canvas-math';

export type LiveCandidate = Rect & { id: string; drawn: boolean };

export type LiveIdsOptions = {
  candidates: LiveCandidate[];
  camera: Camera;
  viewport: Size;
  margin: number;
  max: number;
};

const distanceTo = (rect: Rect, point: Point) =>
  Math.hypot(
    Math.max(rect.x - point.x, 0, point.x - rect.x - rect.width),
    Math.max(rect.y - point.y, 0, point.y - rect.y - rect.height),
  );

/** The candidates in view that go live: the `max` drawn ones nearest the viewport centre, and every one without a shot. */
export const liveIdsOf = ({ candidates, camera, viewport, margin, max }: LiveIdsOptions): ReadonlySet<string> => {
  const visible = visibleWorldRect({ camera, viewport, margin });
  const centre = screenToWorld(camera, { x: viewport.width / 2, y: viewport.height / 2 });
  const inView = candidates.filter((candidate) => rectsIntersect(candidate, visible));
  const nearest = inView
    .filter((candidate) => candidate.drawn)
    .map((candidate) => ({ id: candidate.id, distance: distanceTo(candidate, centre) }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, max);

  return new Set([
    ...inView.filter((candidate) => !candidate.drawn).map(({ id }) => id),
    ...nearest.map(({ id }) => id),
  ]);
};

export const keptLiveIds = ({
  wanted,
  live,
  max,
}: {
  wanted: ReadonlySet<string>;
  live: ReadonlySet<string>;
  max: number;
}): ReadonlySet<string> => new Set([...wanted, ...[...live].filter((id) => !wanted.has(id)).slice(0, max)]);

export const sameIds = (a: ReadonlySet<string>, b: ReadonlySet<string>) =>
  a.size === b.size && [...a].every((id) => b.has(id));
