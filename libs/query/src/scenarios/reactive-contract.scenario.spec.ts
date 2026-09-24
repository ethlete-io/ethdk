import { effect, signal } from '@angular/core';
import { createSecurePostQuery, withArgs } from '../index';
import { describe, expect, it } from 'vitest';
import { useScenario } from './harness';

const BASE_URL = 'https://api.test';

type User = { id: string; name: string };
type CreateUserArgs = { body: { name: string }; response: User };

describe('reactive contract scenario', () => {
  const scenario = useScenario({ baseUrl: BASE_URL, clientOptions: { keepUnusedFor: 0 } });

  describe('v3 execute() and reset() inside an effect', () => {
    it('sends one POST per signal change from execute({ args }) in an effect', () => {
      const s = scenario();
      s.api.on('POST', '/users', ({ body }) => ({ status: 201, body, delay: 100 }));

      const createUser = s.post<CreateUserArgs>('/users');
      const name = signal('Ada');

      const c = s.consumer();
      const mutation = c.run(() => createUser());

      c.run(() => effect(() => mutation.execute({ args: { body: { name: name() } } })));

      s.tick(1000);
      expect(s.api.requestCount('POST', '/users')).toBe(1);

      for (const [index, next] of ['Grace', 'Linus', 'Barbara'].entries()) {
        name.set(next);
        s.tick(1000);

        expect(s.api.requestCount('POST', '/users')).toBe(index + 2);
        expect(mutation.response()).toMatchObject({ name: next });
      }

      c.destroy();
    });

    it('sends one secure POST per signal change from execute({ args }) in an effect', async () => {
      const s = scenario();
      const auth = s.auth();

      s.api.protect('/secure/**');
      s.api.on('POST', '/secure/users', ({ body }) => ({ status: 201, body, delay: 100 }));

      const createSecureUser = createSecurePostQuery(s.clientRef, auth.ref)<CreateUserArgs>('/secure/users');
      const name = signal('Ada');

      const c = s.consumer();
      c.run(() => auth.queries.login.execute({ body: {} }));
      await s.settle();

      const mutation = c.run(() => createSecureUser());

      c.run(() => effect(() => mutation.execute({ args: { body: { name: name() } } })));

      s.tick(1000);
      expect(s.api.requestCount('POST', '/secure/users')).toBe(1);

      for (const [index, next] of ['Grace', 'Linus', 'Barbara'].entries()) {
        name.set(next);
        s.tick(1000);

        expect(s.api.requestCount('POST', '/secure/users')).toBe(index + 2);
        expect(mutation.response()).toMatchObject({ name: next });
      }

      c.destroy();
    });

    it('aborts the superseded GET when an effect executes with new args', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'], name: 'Ada' }, delay: 100 }));

      const getUser = s.get<{ response: User; pathParams: { id: string } }>((p) => `/users/${p.id}`);
      const id = signal('1');

      const c = s.consumer();
      const query = c.run(() =>
        getUser(
          { onlyManualExecution: true },
          withArgs(() => ({ pathParams: { id: '1' } })),
        ),
      );

      c.run(() => effect(() => query.execute({ args: { pathParams: { id: id() } } })));

      s.tick(10);

      for (const next of ['2', '3', '4']) {
        id.set(next);
        s.tick(10);
      }

      s.tick(1000);

      for (const done of ['1', '2', '3', '4']) {
        expect(s.api.requestCount('GET', `/users/${done}`)).toBe(1);
      }

      expect(s.api.requests.map((request) => request.aborted)).toEqual([true, true, true, false]);
      expect(query.response()).toMatchObject({ id: '4' });

      c.destroy();
    });

    it('re-executes a query without args from an effect exactly once per trigger', () => {
      const s = scenario();
      s.api.on('POST', '/refresh', () => ({ status: 201, body: { id: 'r', name: 'Refresh' } }));

      const refresh = s.post<CreateUserArgs>('/refresh');
      const trigger = signal(0);

      const c = s.consumer();
      const mutation = c.run(() => refresh());

      mutation.execute({ args: { body: { name: 'x' } } });
      s.tick();

      c.run(() =>
        effect(() => {
          trigger();
          mutation.execute();
        }),
      );

      s.tick();
      expect(s.api.requestCount('POST', '/refresh')).toBe(2);

      for (const count of [1, 2, 3]) {
        trigger.set(count);
        s.tick();

        expect(s.api.requestCount('POST', '/refresh')).toBe(count + 2);
      }

      c.destroy();
    });

    it('resets from an effect without re-running it', () => {
      const s = scenario();
      s.api.on('POST', '/users', ({ body }) => ({ status: 201, body }));

      const createUser = s.post<CreateUserArgs>('/users');
      const clear = signal(0);
      let runs = 0;

      const c = s.consumer();
      const mutation = c.run(() => createUser());

      c.run(() =>
        effect(() => {
          clear();
          runs++;
          mutation.reset();
        }),
      );

      s.tick();

      for (const [index, next] of ['Ada', 'Grace', 'Linus'].entries()) {
        mutation.execute({ args: { body: { name: next } } });
        s.tick();
        expect(mutation.response()).toMatchObject({ name: next });

        clear.set(index + 1);
        s.tick();

        expect(mutation.response()).toBeNull();
      }

      expect(runs).toBe(4);

      c.destroy();
    });
  });
});
