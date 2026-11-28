import { IncomingMessage, ServerResponse } from 'http';

export const SHOT_VIEW_PATH = '/__design/view';

const UNRANKED_PARAMS = ['view', 'rank', 'priority'];

/** The key of a shot URL on the board: its query without the ranking params, in a fixed order. */
export const shotKeyOf = (url: string) => {
  const { searchParams } = new URL(url, 'http://localhost');

  UNRANKED_PARAMS.forEach((name) => searchParams.delete(name));
  searchParams.sort();

  return searchParams.toString();
};

export type ShownShots = { view: number; shown: string[]; active: string[] };

const isShotList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((url) => typeof url === 'string');

export const shownShotsOf = (body: unknown): ShownShots | null => {
  if (typeof body !== 'object' || body === null) return null;

  const { view, shown, active } = body as Record<string, unknown>;

  return typeof view === 'number' && Number.isFinite(view) && isShotList(shown) && isShotList(active)
    ? { view, shown, active }
    : null;
};

/**
 * The shots the viewer shows now, as its last `POST /__design/view` named them. A view older than the one
 * on the board is ignored. `laneOf` places an ask by its shot key and the board view it was asked under:
 * active 1, shown 2, asked under an older view and not shown now 4, otherwise null.
 */
export const createShotBoard = () => {
  let view = 0;
  let shown = new Set<string>();
  let active = new Set<string>();

  return {
    view: () => view,
    show: (next: ShownShots) => {
      if (next.view <= view) return false;

      view = next.view;
      shown = new Set(next.shown.map(shotKeyOf));
      active = new Set(next.active.map(shotKeyOf));

      return true;
    },
    laneOf: ({ key, boardView }: { key: string; boardView: number }) => {
      if (active.has(key)) return 1;
      if (shown.has(key)) return 2;

      return boardView < view ? 4 : null;
    },
  };
};

export type ShotBoard = ReturnType<typeof createShotBoard>;

const parsedOf = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

/** Answers `POST /__design/view` with a JSON body `{ view, shown, active }` of shot URLs, sent as text/plain. */
export const shotViewMiddleware = (board: ShotBoard) => (request: IncomingMessage, response: ServerResponse) => {
  response.setHeader('access-control-allow-origin', '*');

  if (request.method !== 'POST') {
    response.statusCode = 405;
    response.end();

    return;
  }

  const chunks: Buffer[] = [];

  request.on('data', (chunk: Buffer) => chunks.push(chunk));
  request.on('end', () => {
    const shots = shownShotsOf(parsedOf(Buffer.concat(chunks).toString('utf8')));

    if (shots) board.show(shots);

    response.statusCode = shots ? 204 : 400;
    response.end();
  });
};
