import { firstValueFrom } from 'rxjs';
import { diffLinesOf, diffOutlineOf, diffSummaryOf, variantDiff$ } from './variant-diff';

describe('variantDiff$', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('asks the server for the diff of one variant at the size and theme', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ target: 't', variant: 'v', states: [] })));

    vi.stubGlobal('fetch', fetch);

    await firstValueFrom(
      variantDiff$({ port: 1, product: 'p', sketch: 'pages/home', variant: 'v', size: 'phone', surface: 'dark' }),
    );

    expect(fetch.mock.calls[0]?.[0]).toBe(
      'http://localhost:1/__design/sketch-diff?product=p&sketch=pages%2Fhome&variant=v&size=phone&surface=dark',
    );
  });
});

describe('diffLinesOf', () => {
  it('names the changed box, no change, a new state and one not drawn', () => {
    expect(
      diffLinesOf({
        target: 't',
        variant: 'v',
        states: [
          { state: 'a', box: { x: 1, y: 2, width: 8, height: 4 } },
          { state: 'b', box: null },
          { state: 'c', new: true },
          { state: 'd', error: 'boom' },
        ],
      }),
    ).toEqual([
      { state: 'a', text: 'a · 8 × 4 px', box: { x: 1, y: 2, width: 8, height: 4 } },
      { state: 'b', text: 'b · no pixel change', box: null, unchanged: true },
      { state: 'c', text: 'c · new', box: null },
      { state: 'd', text: 'd · not drawn', box: null, title: 'boom' },
    ]);
  });
});

describe('diffOutlineOf', () => {
  it('outlines the box on the frame of the variant and state at rest', () => {
    expect(diffOutlineOf({ variant: 'v', state: 'a', box: { x: 1, y: 2, width: 8, height: 4 } })).toEqual({
      frameId: 'v a',
      x: 1,
      y: 2,
      width: 8,
      height: 4,
    });
  });
});

describe('diffSummaryOf', () => {
  it('counts the states that differ, and lists only those', () => {
    const changed = { state: 'a', text: 'a · 8 × 4 px', box: { x: 0, y: 0, width: 8, height: 4 } };
    const same = { state: 'b', text: 'b · no pixel change', box: null, unchanged: true as const };

    expect(diffSummaryOf([changed, same])).toEqual({ text: '1 of 2 states differs in pixels', listed: [changed] });
    expect(diffSummaryOf([same]).text).toBe('No pixel change in 1 state');
  });
});
