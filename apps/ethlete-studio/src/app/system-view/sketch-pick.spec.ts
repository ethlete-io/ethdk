import { firstValueFrom } from 'rxjs';
import { MERGE_LABELS } from '../i18n/sketches-labels';
import { SketchPickRequest, sketchPickOutcome$ } from './sketch-pick';

const REQUEST: SketchPickRequest = {
  address: { port: 4402, product: 'web', sketch: 'components/card' },
  variant: 'a',
  discardSubSketches: false,
};

const answering = (status: number, body: unknown) => {
  const bodies: unknown[] = [];

  vi.stubGlobal('fetch', (_url: string, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body ?? '{}')));

    return Promise.resolve(new Response(JSON.stringify(body), { status }));
  });

  return bodies;
};

describe('sketchPickOutcome$', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('posts the pick and answers merged when it opened no sub-sketches', async () => {
    const bodies = answering(200, { merged: ['components/card'] });

    expect(await firstValueFrom(sketchPickOutcome$(REQUEST))).toEqual({ merged: true, error: null });
    expect(bodies).toEqual([{ kind: 'pick', variant: 'a' }]);
  });

  it('sends the discard confirmation and answers not merged when the pick opened sub-sketches', async () => {
    const bodies = answering(200, { merged: [], subSketches: ['components/card-badge'] });

    expect(await firstValueFrom(sketchPickOutcome$({ ...REQUEST, discardSubSketches: true }))).toEqual({
      merged: false,
      error: null,
    });
    expect(bodies).toEqual([{ kind: 'pick', variant: 'a', discardSubSketches: true }]);
  });

  it.each([
    {
      kind: 'stale baseline',
      status: 422,
      body: { error: 'stale', changed: ['components/card'], rebase: 'design sketch rebase' },
      error: MERGE_LABELS.needsRebase(['components/card']),
    },
    {
      kind: 'open sub-sketches',
      status: 422,
      body: {
        error: 'components/card waits on its sub-sketches components/card-badge - approve each',
        reason: 'sub-sketches-open',
        findings: ['components/card-badge'],
      },
      error: 'Wartet auf Freigabe: components/card-badge',
    },
    {
      kind: 'failed check',
      status: 422,
      body: {
        error: 'the check failed after the merge',
        reason: 'check-failed',
        findings: ['INLINE-SVG components/title-bar/shared/chrome.ts: draws an <svg> inline'],
      },
      error:
        'the check failed after the merge\nINLINE-SVG components/title-bar/shared/chrome.ts: draws an <svg> inline',
    },
    { kind: 'server failure', status: 500, body: { error: 'boom' }, error: 'boom' },
  ])('names a $kind refusal and answers not merged', async ({ status, body, error }) => {
    answering(status, body);

    expect(await firstValueFrom(sketchPickOutcome$(REQUEST))).toEqual({ merged: false, error });
  });
});
