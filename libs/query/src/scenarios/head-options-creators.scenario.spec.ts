import { Component, inject, InjectionToken, signal, WritableSignal } from '@angular/core';
import { describe, expect, it } from 'vitest';
import {
  createHeadQuery,
  createOptionsQuery,
  createSecureHeadQuery,
  createSecureOptionsQuery,
  QueryCreator,
  withArgs,
} from '../index';
import { Scenario, useScenario } from './harness';

type AssetHead = { response: null; pathParams: { id: string } };
type UploadOptions = { response: { allow: string[]; folder: string }; queryParams: { folder: string } };

type Creators = {
  headAsset: QueryCreator<AssetHead>;
  optionsUploads: QueryCreator<UploadOptions>;
};

const CREATORS = new InjectionToken<Creators>('CREATORS');
const ASSET_ID = new InjectionToken<WritableSignal<string>>('ASSET_ID');
const FOLDER = new InjectionToken<WritableSignal<string>>('FOLDER');

@Component({ template: '' })
class UploadPanelHost {
  private readonly creators = inject(CREATORS);
  private readonly assetId = inject(ASSET_ID);
  private readonly folder = inject(FOLDER);

  readonly assetQuery = this.creators.headAsset(withArgs(() => ({ pathParams: { id: this.assetId() } })));
  readonly uploadOptionsQuery = this.creators.optionsUploads(
    withArgs(() => ({ queryParams: { folder: this.folder() } })),
  );
}

const serve = (s: Scenario) => {
  s.api.on('HEAD', '/assets/:id', () => ({ headers: { 'content-length': '512' }, delay: 100 }));
  s.api.on('OPTIONS', '/uploads', ({ query }) => ({
    body: { allow: ['POST'], folder: query['folder'] },
    delay: 100,
  }));
};

const runArgChanges = (s: Scenario, creators: Creators) => {
  const assetId = signal('a1');
  const folder = signal('f1');
  const c = s.consumer([
    { provide: CREATORS, useValue: creators },
    { provide: ASSET_ID, useValue: assetId },
    { provide: FOLDER, useValue: folder },
  ]);
  const ref = s.mount(UploadPanelHost, c.injector);

  s.tick(10);

  for (const next of ['2', '3', '4']) {
    assetId.set(`a${next}`);
    folder.set(`f${next}`);
    s.tick(10);
  }

  s.tick(1000);

  expect(ref.instance.assetQuery.executionState()?.type).toBe('success');
  expect(ref.instance.uploadOptionsQuery.response()).toEqual({ allow: ['POST'], folder: 'f4' });

  for (const n of ['1', '2', '3', '4']) {
    expect(s.api.requestCount('HEAD', `/assets/a${n}`)).toBe(1);
  }

  expect(s.api.requestCount('OPTIONS', '/uploads')).toBe(4);
  expect(s.api.requests.filter((request) => request.method === 'HEAD').map((request) => request.aborted)).toEqual([
    true,
    true,
    true,
    false,
  ]);
  expect(s.api.requests.filter((request) => request.method === 'OPTIONS').map((request) => request.aborted)).toEqual([
    true,
    true,
    true,
    false,
  ]);

  return { ref, c };
};

describe('HEAD and OPTIONS creators', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('re-run once per args change from field-initialised withArgs and abort the superseded request', () => {
    const s = scenario();
    serve(s);

    const { ref, c } = runArgChanges(s, {
      headAsset: createHeadQuery(s.clientRef)<AssetHead>((p) => `/assets/${p.id}`),
      optionsUploads: createOptionsQuery(s.clientRef)<UploadOptions>('/uploads'),
    });

    ref.destroy();
    c.destroy();
  });

  it('send the bearer token from the secure twins', async () => {
    const s = scenario();
    const auth = s.auth();
    s.api.protect('/assets/**');
    s.api.protect('/uploads');
    serve(s);

    const login = s.consumer();
    login.run(() => auth.queries.login.execute({ body: {} }));
    await s.settle();

    const { ref, c } = runArgChanges(s, {
      headAsset: createSecureHeadQuery(s.clientRef, auth.ref)<AssetHead>((p) => `/assets/${p.id}`),
      optionsUploads: createSecureOptionsQuery(s.clientRef, auth.ref)<UploadOptions>('/uploads'),
    });

    for (const request of s.api.requests.filter((r) => r.method === 'HEAD' || r.method === 'OPTIONS')) {
      expect(request.headers.get('Authorization')).toBe(`Bearer ${auth.accessToken()}`);
    }

    ref.destroy();
    c.destroy();
    login.destroy();
  });
});
