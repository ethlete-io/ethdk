import { firstValueFrom } from 'rxjs';
import { OLDER_SERVER_MESSAGE, callShotUrl, designAnswer$, designReadError, frameUrl, listedSystem$ } from './design';

describe('frameUrl', () => {
  it('encodes the slug and the variant', () => {
    expect(frameUrl({ port: 4300, slug: 'shop/a b', variant: 'x&y' })).toBe(
      'http://localhost:4300/frame.html?call=shop%2Fa%20b&variant=x%26y',
    );
  });

  it('appends a non-zero epoch only', () => {
    expect(frameUrl({ port: 1, slug: 's', variant: 'v', epoch: 0 })).not.toContain('epoch');
    expect(frameUrl({ port: 1, slug: 's', variant: 'v', epoch: 2 })).toMatch(/&epoch=2$/);
  });

  it('appends the surface and the colour it is given', () => {
    expect(frameUrl({ port: 1, slug: 's', variant: 'v', surface: 'dark', color: 'a b' })).toBe(
      'http://localhost:1/frame.html?call=s&variant=v&surface=dark&color=a%20b',
    );
    expect(frameUrl({ port: 1, slug: 's', variant: 'v', color: 'brand' })).toBe(
      'http://localhost:1/frame.html?call=s&variant=v&color=brand',
    );
  });
});

describe('callShotUrl', () => {
  it('asks the shot route for the variant at a width, under its theme, renewed by revision', () => {
    expect(
      callShotUrl({ port: 1, slug: 'shop/a b', variant: 'v', surface: 'dark', epoch: 2, width: 1280, revision: 3 }),
    ).toBe(
      'http://localhost:1/__design/shot?call=shop%2Fa%20b&variant=v&surface=dark&epoch=2&revision=3&width=1280&priority=low',
    );
    expect(callShotUrl({ port: 1, slug: 's', variant: 'v', width: 390 })).toBe(
      'http://localhost:1/__design/shot?call=s&variant=v&width=390&priority=low',
    );
  });
});

describe('designReadError', () => {
  it('names an outdated cli for a 404 and the status otherwise', () => {
    expect(designReadError(404)).toBe("This checkout's @ethlete/cli has no system view. Update it.");
    expect(designReadError(500)).toBe('The design server answered 500.');
  });
});

describe('an older design server', () => {
  const html = () =>
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve(new Response('<!doctype html><html></html>', { headers: { 'content-type': 'text/html' } })),
      ),
    );

  afterEach(() => vi.unstubAllGlobals());

  it('is named when a note or comment request gets its HTML index', async () => {
    html();

    await expect(firstValueFrom(designAnswer$('http://localhost:1/__design/notes'))).rejects.toThrow(
      OLDER_SERVER_MESSAGE,
    );
  });

  it('is named when the system read gets its HTML index', async () => {
    html();

    await expect(firstValueFrom(listedSystem$(1))).rejects.toThrow(OLDER_SERVER_MESSAGE);
  });
});
