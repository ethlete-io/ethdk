import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { IncomingMessage } from 'http';
import { tmpdir } from 'os';
import { join } from 'path';
import { Readable } from 'stream';
import { describe, expect, it, vi } from 'vitest';
import { DESIGN_DIR } from './paths';
import { openPointsAnswer } from './studio-api';
import { drawnFindingsOf } from './system/drawn-open-points';

vi.mock('./system/drawn-open-points', () => ({
  drawnFindingsOf: vi.fn(async () => ({
    contrasts: [{ part: 'components/chip', state: 'default', path: 'span' }],
    missingStates: [{ part: 'components/chip', control: 'remove' }],
  })),
}));

const checkout = () => {
  const target = mkdtempSync(join(tmpdir(), 'cli-design-open-points-answer-'));
  const design = join(target, DESIGN_DIR);
  const part = (path: string, source: string) => {
    mkdirSync(join(design, 'app-a', path), { recursive: true });
    writeFileSync(join(design, 'app-a', path, `${path.split('/')[1]}.ts`), source);
  };

  part(
    'components/chip',
    "export default definePart({ implements: 'libs/chip.component.ts', controls: { remove: {} }, states: { default: {} } });\n",
  );
  part('pages/home', "export default definePart({ implements: { route: '/' }, states: { default: {} } });\n");
  writeFileSync(join(design, 'config.json'), JSON.stringify({ products: { 'app-a': {} } }));

  return target;
};

const ask = (target: string, path: string, method = 'GET') => ({
  target,
  url: new URL(`http://localhost${path}`),
  request: Object.assign(Readable.from([]), { method }) as unknown as IncomingMessage,
});

describe('openPointsAnswer', () => {
  it('answers the open points of every part, or of one, without a draw', async () => {
    const target = checkout();

    expect(await openPointsAnswer(ask(target, '/?product=app-a'))).toEqual({
      status: 200,
      body: { drawn: false, parts: [] },
    });
    expect(await openPointsAnswer(ask(target, '/?product=app-a&part=pages/home'))).toEqual({
      status: 200,
      body: { part: 'pages/home', drawn: false, points: [] },
    });
    expect(drawnFindingsOf).not.toHaveBeenCalled();
  });

  it('draws one part for its contrasts and missing control states', async () => {
    const answer = await openPointsAnswer(ask(checkout(), '/?product=app-a&part=components/chip&draw=true'));

    expect(answer).toEqual({
      status: 200,
      body: {
        part: 'components/chip',
        drawn: true,
        points: [
          { kind: 'missing-state', control: 'remove' },
          { kind: 'contrast', state: 'default', path: 'span' },
        ],
      },
    });
  });

  it('refuses a bad parameter, an unknown part and a draw that cannot run', async () => {
    const target = checkout();
    const statusOf = async (path: string, method?: string) =>
      (await openPointsAnswer(ask(target, path, method))).status;

    expect(await statusOf('/')).toBe(400);
    expect(await statusOf('/?product=app-a&draw=true')).toBe(400);
    expect(await statusOf('/?product=app-a&part=pages/home&draw=yes')).toBe(400);
    expect(await statusOf('/?product=app-a&part=pages/gone')).toBe(404);
    expect(await statusOf('/?product=app-b')).toBe(404);
    expect(await statusOf('/?product=app-a', 'POST')).toBe(405);

    vi.mocked(drawnFindingsOf).mockResolvedValueOnce({ unavailable: 'no playwright' });

    expect(await openPointsAnswer(ask(target, '/?product=app-a&part=pages/home&draw=true'))).toEqual({
      status: 503,
      body: { error: 'cannot draw pages/home: no playwright' },
    });
  });
});
