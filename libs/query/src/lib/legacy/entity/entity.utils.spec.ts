import { firstValueFrom, of, take, toArray } from 'rxjs';
import { EntityStore } from './entity-store';
import { insertFrom } from './entity.utils';

type User = { id: string; name: string };

type SingleOrigin = { id: string; userId: string; user: User | null };

type MultiOrigin = { id: string; userIds: string[]; users: User[] };

const createStore = () => new EntityStore<User>({ name: 'users' });

const singleOrigin = (userId: string): SingleOrigin => ({ id: 'o1', userId, user: null });

const multiOrigin = (userIds: string[]): MultiOrigin => ({ id: 'o1', userIds, users: [] });

describe('insertFrom', () => {
  it('replaces the key with the entity when the id fn returns a single key', async () => {
    const store = createStore();
    store.set('u1', { id: 'u1', name: 'Ada' });

    const result = await firstValueFrom(
      of(singleOrigin('u1')).pipe(insertFrom(store, { for: 'user', id: (value) => value.userId })),
    );

    expect(result).toEqual({ id: 'o1', userId: 'u1', user: { id: 'u1', name: 'Ada' } });
  });

  it('replaces the key with null when the single key is not in the store', async () => {
    const store = createStore();

    const result = await firstValueFrom(
      of(singleOrigin('missing')).pipe(insertFrom(store, { for: 'user', id: (value) => value.userId })),
    );

    expect(result).toEqual({ id: 'o1', userId: 'missing', user: null });
  });

  it('replaces the key with an array of entities in id order when the id fn returns keys', async () => {
    const store = createStore();
    store.set('u1', { id: 'u1', name: 'Ada' });
    store.set('u2', { id: 'u2', name: 'Grace' });

    const result = await firstValueFrom(
      of(multiOrigin(['u2', 'u1'])).pipe(insertFrom(store, { for: 'users', id: (value) => value.userIds })),
    );

    expect(result).toEqual({
      id: 'o1',
      userIds: ['u2', 'u1'],
      users: [
        { id: 'u2', name: 'Grace' },
        { id: 'u1', name: 'Ada' },
      ],
    });
  });

  it('omits missing keys from the array instead of emitting holes', async () => {
    const store = createStore();
    store.set('u1', { id: 'u1', name: 'Ada' });

    const result = await firstValueFrom(
      of(multiOrigin(['missing', 'u1'])).pipe(insertFrom(store, { for: 'users', id: (value) => value.userIds })),
    );

    expect(result).toEqual({ id: 'o1', userIds: ['missing', 'u1'], users: [{ id: 'u1', name: 'Ada' }] });
  });

  it('re-emits when one of the array keys changes in the store', async () => {
    const store = createStore();
    store.set('u1', { id: 'u1', name: 'Ada' });

    const emissions = firstValueFrom(
      of(multiOrigin(['u1'])).pipe(
        insertFrom(store, { for: 'users', id: (value) => value.userIds }),
        take(2),
        toArray(),
      ),
    );

    store.set('u1', { id: 'u1', name: 'Ada Lovelace' });

    expect(await emissions).toEqual([
      { id: 'o1', userIds: ['u1'], users: [{ id: 'u1', name: 'Ada' }] },
      { id: 'o1', userIds: ['u1'], users: [{ id: 'u1', name: 'Ada Lovelace' }] },
    ]);
  });

  it('emits null when the origin value is nullish', async () => {
    const store = createStore();

    const result = await firstValueFrom(
      of<SingleOrigin | null>(null).pipe(insertFrom(store, { for: 'user', id: (value) => value.userId })),
    );

    expect(result).toBeNull();
  });
});
