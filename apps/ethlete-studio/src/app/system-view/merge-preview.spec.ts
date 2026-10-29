import { Subject, firstValueFrom } from 'rxjs';
import { designReadError } from '../../host/design';
import { comparingTextOf, sketchCompare$, whileWaiting$ } from './merge-preview';

const address = { port: 1, product: 'p', sketch: 's', variant: 'v' };

const answer = (body: unknown, status: number) =>
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status })));

describe('sketchCompare$', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('emits the comparison the server answers', async () => {
    const compare = { target: 't', variant: 'v', changed: [], unchanged: [] };
    answer(compare, 200);

    await expect(firstValueFrom(sketchCompare$(address))).resolves.toEqual(compare);
  });

  it('fails with the error message the server sends', async () => {
    answer({ error: 'no such variant' }, 400);

    await expect(firstValueFrom(sketchCompare$(address))).rejects.toThrow('no such variant');
  });

  it('fails with the read error when the server sends no message', async () => {
    answer({}, 500);

    await expect(firstValueFrom(sketchCompare$(address))).rejects.toThrow(designReadError(500));
  });
});

describe('whileWaiting$', () => {
  afterEach(() => vi.useRealTimers());

  it('counts the seconds until the answer, then emits the answer and stops counting', () => {
    vi.useFakeTimers();
    const answer$ = new Subject<string>();
    const seen: string[] = [];

    whileWaiting$(answer$, (seconds) => `${seconds} s`).subscribe((value) => seen.push(value));
    vi.advanceTimersByTime(2000);
    answer$.next('done');
    vi.advanceTimersByTime(3000);

    expect(seen).toEqual(['0 s', '1 s', '2 s', 'done']);
  });
});

describe('comparingTextOf', () => {
  it('names the part count, and the seconds once one passed', () => {
    expect(comparingTextOf({ parts: 1, seconds: 0 })).toBe('Comparing 1 part now and after the merge…');
    expect(comparingTextOf({ parts: 5, seconds: 12 })).toBe('Comparing 5 parts now and after the merge… 12 s');
  });
});
