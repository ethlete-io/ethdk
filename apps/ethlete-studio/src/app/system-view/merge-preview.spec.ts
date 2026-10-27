import { firstValueFrom } from 'rxjs';
import { designReadError } from '../../host/design';
import { sketchCompare$ } from './merge-preview';

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
