import { provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ListedException, openExceptionsOf } from '../../host/design-exceptions';
import { createExceptionStore } from './exception-store';

const LISTED: ListedException[] = [
  { key: 'components/button.submit.focus', state: 'pending', reason: 'never takes focus' },
  {
    key: 'components/button.icon.touch',
    state: 'reopened',
    reason: 'icon only',
    approval: { by: 'designer', at: '2026-10-30T10:00:00.000Z', hash: 'old' },
  },
  {
    key: 'components/button.label.hover',
    state: 'approved',
    reason: 'static',
    approval: { by: 'designer', at: '2026-10-30T10:00:00.000Z', hash: 'h1' },
  },
  { key: 'components/buttons.row.focus', state: 'pending', reason: 'another part' },
];

const json = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status }));

const settle = async () => {
  for (let round = 0; round < 5; round++) {
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
  }
};

const storeOf = async (approve?: (body: { key: string; by: string }) => Promise<Response>) => {
  const posts: unknown[] = [];

  vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
    if (url.includes('/__design/exception-approve')) {
      const body = JSON.parse(String(init?.body)) as { key: string; by: string };

      posts.push(body);

      return approve
        ? approve(body)
        : json({ reason: 'x', requested: 'y', approval: { by: body.by, at: 'now', hash: 'h2' } });
    }

    return json(LISTED);
  });
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });

  const address = signal<{ port: number; product: string; revision: number } | null>({
    port: 4999,
    product: 'studio',
    revision: 0,
  });
  const store = TestBed.runInInjectionContext(() => createExceptionStore(address));

  await settle();

  const openKeys = () => openExceptionsOf(store.listed(), 'components/button').map(({ key }) => key);

  return { store, posts, address, openKeys };
};

describe('openExceptionsOf', () => {
  it('keeps the pending and reopened exceptions of the part only', () => {
    expect(openExceptionsOf(LISTED, 'components/button').map(({ key }) => key)).toEqual([
      'components/button.submit.focus',
      'components/button.icon.touch',
    ]);
  });
});

describe('createExceptionStore', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('approves an exception as the designer and drops it from the open ones', async () => {
    const { store, posts, openKeys } = await storeOf();

    expect(openKeys()).toEqual(['components/button.submit.focus', 'components/button.icon.touch']);

    store.approve('components/button.submit.focus');
    await settle();

    expect(posts).toEqual([{ key: 'components/button.submit.focus', by: 'designer' }]);
    expect(openKeys()).toEqual(['components/button.icon.touch']);
  });

  it('keeps the exception and names the refusal when the server refuses', async () => {
    const { store, openKeys } = await storeOf(() => json({ error: 'no exception was requested' }, 404));

    store.approve('components/button.submit.focus');
    await settle();

    expect(store.error()).toBe('no exception was requested');
    expect(openKeys()).toHaveLength(2);
  });

  it('lists nothing and approves nothing without a product', async () => {
    const { store, posts, address } = await storeOf();

    address.set(null);
    await settle();
    store.approve('components/button.submit.focus');

    expect(store.listed()).toEqual([]);
    expect(posts).toEqual([]);
  });
});
