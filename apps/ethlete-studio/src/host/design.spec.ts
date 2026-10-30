import { signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { followScheme } from './color-scheme';
import {
  OLDER_SERVER_MESSAGE,
  ServerState,
  callShotUrl,
  designAnswer$,
  designReadError,
  designServerState$,
  frameUrl,
  listedSystem$,
  partShotUrl,
} from './design';

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

describe('designServerState$', () => {
  const known: ServerState = {
    port: 1,
    listening: true,
    managed: false,
    foreign: true,
    stale: false,
    exited: true,
    log: ['kept'],
    logRevision: 7,
  };

  afterEach(() => delete (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__);

  it('names the known log revision and keeps the known log when the host sends none', async () => {
    const sent: unknown[] = [];

    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {
        invoke: (_: string, args: unknown) => {
          sent.push(args);

          return Promise.resolve({ ...known, log: sent.length === 1 ? null : ['new'], logRevision: 8 });
        },
      },
    });

    expect((await firstValueFrom(designServerState$('/c', known))).log).toEqual(['kept']);
    expect((await firstValueFrom(designServerState$('/c', known))).log).toEqual(['new']);
    expect(sent[0]).toEqual({ checkout: '/c', logRevision: 7 });
  });
});

describe('shot urls under a preferred colour scheme', () => {
  it('ask for the scheme the window prefers and follow it when it changes', () => {
    const dark = signal(true);
    const part = { port: 1, product: 'p', part: 'components/button', state: 'rest', revision: 2 };

    followScheme(dark);

    expect(partShotUrl(part)).toBe(
      'http://localhost:1/__design/shot?product=p&part=components%2Fbutton&state=rest&revision=2&scheme=dark&priority=low',
    );
    expect(callShotUrl({ port: 1, slug: 's', variant: 'v', width: 390 })).toBe(
      'http://localhost:1/__design/shot?call=s&variant=v&width=390&scheme=dark&priority=low',
    );

    dark.set(false);

    expect(partShotUrl(part)).toContain('&scheme=light&');
  });
});
