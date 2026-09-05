import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { describe, expect, it, vi } from 'vitest';
import { createDefaultRetryFn, queryErrorMessage, querySequence, withArgs } from '../index';
import { Scenario, sequence, useScenario } from './harness';

/**
 * Drives a `querySequence` run to completion. Each step arms the next one's request a microtask
 * after the previous step settles, so a multi-step chain needs a loop that alternates microtasks
 * and fake time across the whole run.
 */
const driveSequence = async <T>(s: Scenario, run: Promise<T>): Promise<T | undefined> => {
  let settled: { value: T } | undefined;

  run.then((value) => (settled = { value }));

  for (let i = 0; i < 20 && settled === undefined; i++) {
    await Promise.resolve();
    s.tick(50);
  }

  return settled?.value;
};

describe('dependent queries scenario', () => {
  describe('reactive GET feeding GET', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('parks the dependent query until the dependency resolves, then executes with its response', () => {
      const s = scenario();
      s.api.on('GET', '/users/:id', ({ params }) => ({ body: { id: params['id'] }, delay: 100 }));
      s.api.on('GET', '/perms/:userId', ({ params }) => ({ body: { scopes: [`scopes-for-${params['userId']}`] } }));

      const getUser = s.get<{ response: { id: string }; pathParams: { id: string } }>((p) => `/users/${p.id}`);
      const getPermissions = s.get<{ response: { scopes: string[] }; pathParams: { userId: string } }>(
        (p) => `/perms/${p.userId}`,
      );

      const userId = signal('1');
      const c = s.consumer();
      const { userQuery, permsQuery } = c.run(() => {
        const userQuery = getUser(withArgs(() => ({ pathParams: { id: userId() } })));
        const permsQuery = getPermissions(
          withArgs(() => {
            const user = userQuery.response();
            return user ? { pathParams: { userId: user.id } } : null;
          }),
        );

        return { userQuery, permsQuery };
      });

      s.tick();
      expect(s.api.requestCount('GET', '/users/1')).toBe(1);
      expect(s.api.requestCount('GET', '/perms/1')).toBe(0);
      expect(permsQuery.loading()).toBeNull();
      expect(permsQuery.response()).toBeNull();

      s.tick(99);
      expect(s.api.requestCount('GET', '/perms/1')).toBe(0);

      s.tick(1);
      expect(userQuery.response()).toEqual({ id: '1' });

      s.tick();
      expect(s.api.requestCount('GET', '/perms/1')).toBe(1);
      expect(permsQuery.response()).toEqual({ scopes: ['scopes-for-1'] });

      userId.set('2');
      s.tick(100);
      expect(s.api.requestCount('GET', '/users/2')).toBe(1);
      expect(userQuery.response()).toEqual({ id: '2' });

      s.tick();
      expect(s.api.requestCount('GET', '/perms/2')).toBe(1);
      expect(permsQuery.response()).toEqual({ scopes: ['scopes-for-2'] });

      expect(s.api.requests.map((r) => r.url)).toEqual([
        'https://api.test/users/1',
        'https://api.test/perms/1',
        'https://api.test/users/2',
        'https://api.test/perms/2',
      ]);

      c.destroy();
    });

    it('leaves the dependent query idle and sends no request when the dependency errors', () => {
      const s = scenario();
      s.api.on('GET', '/broken-user', () => ({ status: 500, body: { message: 'boom' } }));

      const getUser = s.get<{ response: { id: string } }>('/broken-user');
      const getPermissions = s.get<{ response: { scopes: string[] }; pathParams: { userId: string } }>(
        (p) => `/perms/${p.userId}`,
      );

      const c = s.consumer();
      const { userQuery, permsQuery } = c.run(() => {
        const userQuery = getUser();
        const permsQuery = getPermissions(
          withArgs(() => {
            const user = userQuery.response();
            return user ? { pathParams: { userId: user.id } } : null;
          }),
        );

        return { userQuery, permsQuery };
      });

      s.tick();

      expect(userQuery.error()?.code).toBe(500);
      expect(permsQuery.response()).toBeNull();
      expect(permsQuery.loading()).toBeNull();
      expect(permsQuery.error()).toBeNull();
      expect(s.api.requestCount('GET', '/perms/:userId')).toBe(0);
      expect(s.api.requests.length).toBe(1);

      s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 500);
      c.destroy();
    });
  });

  describe('imperative waterfalls (querySequence)', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('resolves with the typed tuple of every response once a 2xx chain completes', async () => {
      const s = scenario();
      s.api.on('POST', '/orders', ({ body }) => ({
        body: { id: 'order-1', total: (body as { total: number }).total },
      }));
      s.api.on('POST', '/payments', ({ body }) => ({
        body: { id: 'payment-1', orderId: (body as { orderId: string }).orderId },
      }));
      s.api.on('POST', '/confirm', ({ body }) => ({
        body: { confirmed: true, ref: (body as { orderRef: string }).orderRef },
      }));

      const createOrder = s.post<{ response: { id: string; total: number }; body: { total: number } }>('/orders');
      const createPayment = s.post<{ response: { id: string; orderId: string }; body: { orderId: string } }>(
        '/payments',
      );
      const confirmOrder = s.post<{ response: { confirmed: boolean; ref: string }; body: { orderRef: string } }>(
        '/confirm',
      );

      const c = s.consumer();
      const checkout = c.run(() => {
        const orderQuery = createOrder();
        const paymentQuery = createPayment();
        const confirmQuery = confirmOrder();

        return querySequence(orderQuery, () => ({ args: { body: { total: 42 } } }))
          .then(paymentQuery, (order) => ({ args: { body: { orderId: order.id } } }))
          .then(confirmQuery, (_payment, [order]) => ({ args: { body: { orderRef: order.id } } }));
      });

      let result: Awaited<ReturnType<typeof checkout.run>> | undefined;
      checkout.run().then((r) => (result = r));

      // Each step arms the next one's request a microtask after the previous settles; settle() only
      // advances fake time once, so a multi-step chain needs its own loop across the whole run.
      for (let i = 0; i < 20 && result === undefined; i++) {
        await Promise.resolve();
        s.tick(50);
      }

      expect(result?.ok).toBe(true);
      if (result?.ok) {
        expect(result.responses).toEqual([
          { id: 'order-1', total: 42 },
          { id: 'payment-1', orderId: 'order-1' },
          { confirmed: true, ref: 'order-1' },
        ]);
        expect(result.snapshots).toHaveLength(3);
      }
      expect(checkout.status()).toBe('success');
      expect(checkout.currentStep()).toBe(3);
      expect(checkout.total).toBe(3);
      expect(checkout.responses()).toEqual([
        { id: 'order-1', total: 42 },
        { id: 'payment-1', orderId: 'order-1' },
        { confirmed: true, ref: 'order-1' },
      ]);
      expect(s.api.requestCount('POST', '/orders')).toBe(1);
      expect(s.api.requestCount('POST', '/payments')).toBe(1);
      expect(s.api.requestCount('POST', '/confirm')).toBe(1);

      c.destroy();
    });

    it('aborts at the first failing step, sends no request for later steps and reports the failing step', async () => {
      const s = scenario();
      s.api.on('POST', '/orders-b', ({ body }) => ({
        body: { id: 'order-1', total: (body as { total: number }).total },
      }));
      s.api.on('POST', '/payments-b', () => ({ status: 402, body: { message: 'card declined' } }));
      s.api.on('POST', '/confirm-b', () => ({ body: { confirmed: true } }));

      const createOrder = s.post<{ response: { id: string; total: number }; body: { total: number } }>('/orders-b');
      const createPayment = s.post<{ response: { id: string }; body: { orderId: string } }>('/payments-b');
      const confirmOrder = s.post<{ response: { confirmed: boolean }; body: { orderRef: string } }>('/confirm-b');

      const c = s.consumer();
      const checkout = c.run(() => {
        const orderQuery = createOrder();
        const paymentQuery = createPayment();
        const confirmQuery = confirmOrder();

        return querySequence(orderQuery, () => ({ args: { body: { total: 7 } } }))
          .then(paymentQuery, (order) => ({ args: { body: { orderId: order.id } } }))
          .then(confirmQuery, () => ({ args: { body: { orderRef: 'unreachable' } } }));
      });

      let result: Awaited<ReturnType<typeof checkout.run>> | undefined;
      checkout.run().then((r) => (result = r));

      for (let i = 0; i < 20 && result === undefined; i++) {
        await Promise.resolve();
        s.tick(50);
      }

      expect(result?.ok).toBe(false);
      if (result && !result.ok) {
        expect(result.failedAt).toBe(1);
        expect(result.error.code).toBe(402);
        expect(result.snapshots).toHaveLength(2);
      }
      expect(checkout.status()).toBe('error');
      expect(checkout.failedAt()).toBe(1);
      expect(checkout.error()?.code).toBe(402);
      expect(checkout.responses()).toEqual([{ id: 'order-1', total: 7 }]);
      expect(s.api.requestCount('POST', '/orders-b')).toBe(1);
      expect(s.api.requestCount('POST', '/payments-b')).toBe(1);
      expect(s.api.requestCount('POST', '/confirm-b')).toBe(0);

      s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 402);
      c.destroy();
    });

    it('reads the seed signal again on a second run instead of the value it was built with', async () => {
      const s = scenario();
      s.api.on('POST', '/orders-c', ({ body }) => ({ body: { id: `order-${(body as { total: number }).total}` } }));
      s.api.on('POST', '/payments-c', ({ body }) => ({
        body: { id: 'payment-1', orderId: (body as { orderId: string }).orderId },
      }));

      const createOrder = s.post<{ response: { id: string }; body: { total: number } }>('/orders-c');
      const createPayment = s.post<{
        response: { id: string; orderId: string };
        body: { orderId: string; note: string };
      }>('/payments-c');

      const total = signal(1);
      const note = signal('first');

      const c = s.consumer();
      const chain = c.run(() =>
        querySequence(createOrder(), () => ({ args: { body: { total: total() } } })).then(createPayment(), (order) => ({
          args: { body: { orderId: order.id, note: note() } },
        })),
      );

      const first = await driveSequence(s, chain.run());

      expect(first?.ok).toBe(true);
      expect(s.api.requests.map((r) => r.body)).toEqual([{ total: 1 }, { orderId: 'order-1', note: 'first' }]);

      total.set(2);
      note.set('second');

      const second = await driveSequence(s, chain.run());

      expect(second?.ok).toBe(true);
      expect(s.api.requests.map((r) => r.body)).toEqual([
        { total: 1 },
        { orderId: 'order-1', note: 'first' },
        { total: 2 },
        { orderId: 'order-2', note: 'second' },
      ]);

      c.destroy();
    });

    it('leaves the first run snapshots untouched when the chain is run again', async () => {
      const s = scenario();
      s.api.on('POST', '/orders-d', sequence([{ body: { id: 'order-1' } }, { body: { id: 'order-2' } }]));

      const createOrder = s.post<{ response: { id: string }; body: { total: number } }>('/orders-d');

      const c = s.consumer();
      const chain = c.run(() => querySequence(createOrder(), () => ({ args: { body: { total: 1 } } })));

      const first = await driveSequence(s, chain.run());

      expect(first?.ok).toBe(true);

      const resultSnapshots = first?.ok ? first.snapshots : [];
      const signalSnapshots = chain.snapshots();

      expect(resultSnapshots[0]?.response()).toEqual({ id: 'order-1' });
      expect(signalSnapshots[0]?.response()).toEqual({ id: 'order-1' });

      const second = await driveSequence(s, chain.run());

      expect(second?.ok).toBe(true);
      if (second?.ok) expect(second.responses).toEqual([{ id: 'order-2' }]);

      expect(resultSnapshots[0]?.response()).toEqual({ id: 'order-1' });
      expect(signalSnapshots[0]?.response()).toEqual({ id: 'order-1' });

      c.destroy();
    });

    it('walks currentStep from 0 to one per step as the waterfall advances', async () => {
      const s = scenario();
      s.api.on('POST', '/orders-e', () => ({ body: { id: 'order-1' }, delay: 100 }));
      s.api.on('POST', '/payments-e', () => ({ body: { id: 'payment-1' }, delay: 100 }));
      s.api.on('POST', '/confirm-e', () => ({ body: { confirmed: true }, delay: 100 }));

      const createOrder = s.post<{ response: { id: string }; body: { total: number } }>('/orders-e');
      const createPayment = s.post<{ response: { id: string }; body: { orderId: string } }>('/payments-e');
      const confirmOrder = s.post<{ response: { confirmed: boolean }; body: { paymentId: string } }>('/confirm-e');

      const c = s.consumer();
      const chain = c.run(() =>
        querySequence(createOrder(), () => ({ args: { body: { total: 1 } } }))
          .then(createPayment(), (order) => ({ args: { body: { orderId: order.id } } }))
          .then(confirmOrder(), (payment) => ({ args: { body: { paymentId: payment.id } } })),
      );

      expect(chain.currentStep()).toBe(0);
      expect(chain.status()).toBe('idle');
      expect(chain.running()).toBe(false);
      expect(chain.completed()).toBe(0);
      expect(chain.progress()).toBe(0);

      let result: Awaited<ReturnType<typeof chain.run>> | undefined;
      chain.run().then((r) => (result = r));

      expect(chain.currentStep()).toBe(1);
      expect(chain.status()).toBe('running');
      expect(chain.running()).toBe(true);

      await s.settle(100);
      expect(chain.currentStep()).toBe(2);
      expect(chain.completed()).toBe(1);

      await s.settle(100);
      expect(chain.currentStep()).toBe(3);
      expect(chain.completed()).toBe(2);

      await s.settle(100);
      expect(result?.ok).toBe(true);
      expect(chain.currentStep()).toBe(3);
      expect(chain.completed()).toBe(3);
      expect(chain.progress()).toBe(100);
      expect(chain.running()).toBe(false);

      c.destroy();
    });

    it('exposes each settled snapshot on the snapshots signal as the chain advances', async () => {
      const s = scenario();
      s.api.on('POST', '/orders-f', () => ({ body: { id: 'order-1' }, delay: 100 }));
      s.api.on('POST', '/payments-f', () => ({ body: { id: 'payment-1' }, delay: 100 }));

      const createOrder = s.post<{ response: { id: string }; body: { total: number } }>('/orders-f');
      const createPayment = s.post<{ response: { id: string }; body: { orderId: string } }>('/payments-f');

      const c = s.consumer();
      const chain = c.run(() =>
        querySequence(createOrder(), () => ({ args: { body: { total: 1 } } })).then(createPayment(), (order) => ({
          args: { body: { orderId: order.id } },
        })),
      );

      expect(chain.snapshots()).toEqual([]);

      let result: Awaited<ReturnType<typeof chain.run>> | undefined;
      chain.run().then((r) => (result = r));

      expect(chain.snapshots()).toEqual([]);

      await s.settle(100);
      expect(chain.snapshots()).toHaveLength(1);
      expect(chain.snapshots()[0]?.response()).toEqual({ id: 'order-1' });

      await s.settle(100);
      expect(result?.ok).toBe(true);
      expect(chain.snapshots()).toHaveLength(2);
      expect(chain.snapshots()[1]?.response()).toEqual({ id: 'payment-1' });

      c.destroy();
    });

    it('clears status, currentStep, error and failedAt when the sequence is run again', async () => {
      const s = scenario();
      s.api.on('POST', '/orders-g', () => ({ body: { id: 'order-1' } }));
      s.api.on(
        'POST',
        '/payments-g',
        sequence([{ status: 402, body: { message: 'card declined' } }, { body: { id: 'payment-1' } }]),
      );

      const createOrder = s.post<{ response: { id: string }; body: { total: number } }>('/orders-g');
      const createPayment = s.post<{ response: { id: string }; body: { orderId: string } }>('/payments-g');

      const c = s.consumer();
      const chain = c.run(() =>
        querySequence(createOrder(), () => ({ args: { body: { total: 1 } } })).then(createPayment(), (order) => ({
          args: { body: { orderId: order.id } },
        })),
      );

      const first = await driveSequence(s, chain.run());

      expect(first?.ok).toBe(false);
      expect(chain.status()).toBe('error');
      expect(chain.failedAt()).toBe(1);
      expect(chain.error()?.code).toBe(402);
      expect(chain.snapshots()).toHaveLength(2);
      expect(chain.responses()).toEqual([{ id: 'order-1' }]);

      const secondRun = chain.run();

      expect(chain.status()).toBe('running');
      expect(chain.running()).toBe(true);
      expect(chain.currentStep()).toBe(1);
      expect(chain.error()).toBeNull();
      expect(chain.failedAt()).toBeNull();
      expect(chain.snapshots()).toEqual([]);
      expect(chain.responses()).toEqual([]);
      expect(chain.completed()).toBe(0);
      expect(chain.progress()).toBe(0);

      const second = await driveSequence(s, secondRun);

      expect(second?.ok).toBe(true);
      expect(chain.status()).toBe('success');
      expect(chain.error()).toBeNull();
      expect(chain.failedAt()).toBeNull();
      expect(chain.responses()).toEqual([{ id: 'order-1' }, { id: 'payment-1' }]);

      s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 402);
      c.destroy();
    });

    it('reports at most 100% progress from an intermediate sequence link', async () => {
      const s = scenario();
      s.api.on('POST', '/orders-i', () => ({ body: { id: 'order-1' } }));
      s.api.on('POST', '/payments-i', () => ({ body: { id: 'payment-1' } }));
      s.api.on('POST', '/confirm-i', () => ({ body: { confirmed: true } }));

      const createOrder = s.post<{ response: { id: string }; body: { total: number } }>('/orders-i');
      const createPayment = s.post<{ response: { id: string }; body: { orderId: string } }>('/payments-i');
      const confirmOrder = s.post<{ response: { confirmed: boolean }; body: { paymentId: string } }>('/confirm-i');

      const c = s.consumer();
      const { seed, chain } = c.run(() => {
        const seed = querySequence(createOrder(), () => ({ args: { body: { total: 1 } } }));
        const chain = seed
          .then(createPayment(), (order) => ({ args: { body: { orderId: order.id } } }))
          .then(confirmOrder(), (payment) => ({ args: { body: { paymentId: payment.id } } }));

        return { seed, chain };
      });

      expect(seed.total).toBe(3);
      expect(seed.progress()).toBe(0);

      const result = await driveSequence(s, chain.run());

      expect(result?.ok).toBe(true);
      expect(seed.completed()).toBe(3);
      expect(seed.progress()).toBe(100);
      expect(chain.progress()).toBe(100);

      c.destroy();
    });

    it('hands the next mapArgs a null response when the previous step answers 204', async () => {
      const s = scenario();
      s.api.on('DELETE', '/carts/cart-1', () => ({ status: 204 }));
      s.api.on('POST', '/orders-j', () => ({ body: { id: 'order-1' } }));

      const clearCart = s.delete<{ response: { id: string } | null }>('/carts/cart-1');
      const createOrder = s.post<{ response: { id: string }; body: { cart: string | null } }>('/orders-j');

      const seen: unknown[] = [];

      const c = s.consumer();
      const chain = c.run(() =>
        querySequence(clearCart(), () => ({ args: {} })).then(createOrder(), (cleared) => {
          seen.push(cleared);

          return { args: { body: { cart: cleared?.id ?? null } } };
        }),
      );

      const result = await driveSequence(s, chain.run());

      expect(seen).toEqual([null]);
      expect(result?.ok).toBe(true);
      expect(chain.responses()).toEqual([null, { id: 'order-1' }]);

      c.destroy();
    });

    it('settles the run promise as a cancelled step when the host is destroyed mid-waterfall', async () => {
      const s = scenario();
      s.api.on('POST', '/orders-h', () => ({ body: { id: 'order-1' }, delay: 100 }));
      s.api.on('POST', '/payments-h', () => ({ body: { id: 'payment-1' }, delay: 100 }));

      const createOrder = s.post<{ response: { id: string }; body: { total: number } }>('/orders-h');
      const createPayment = s.post<{ response: { id: string }; body: { orderId: string } }>('/payments-h');

      const c = s.consumer();
      const chain = c.run(() =>
        querySequence(createOrder(), () => ({ args: { body: { total: 1 } } })).then(createPayment(), (order) => ({
          args: { body: { orderId: order.id } },
        })),
      );

      let result: Awaited<ReturnType<typeof chain.run>> | undefined;
      let rejection: unknown = null;
      chain.run().then(
        (value) => (result = value),
        (error: unknown) => (rejection = error),
      );

      await s.settle(100);
      expect(chain.currentStep()).toBe(2);
      expect(s.api.requestCount('POST', '/payments-h')).toBe(1);
      expect(s.api.pending()).toHaveLength(1);

      c.destroy();

      for (let i = 0; i < 10; i++) {
        await Promise.resolve();
        s.tick(100);
      }

      expect(s.api.pending()).toHaveLength(0);
      expect(rejection).toBeNull();
      expect(result?.ok).toBe(false);
      expect(result?.ok === false && result.failedAt).toBe(1);
      expect(result?.ok === false && queryErrorMessage(result.error)).toBe('The request was cancelled.');
    });
  });

  describe('execute() on a destroyed query', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('execute() after the owning scope is destroyed is a no-op that warns once per call in dev mode', () => {
      const s = scenario();
      s.api.on('GET', '/after-destroy', () => ({ body: { ok: true } }));

      const getAfterDestroy = s.get<{ response: { ok: boolean } }>('/after-destroy');
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      try {
        const c = s.consumer();
        const query = c.run(() => getAfterDestroy());
        s.tick();

        expect(s.api.requestCount('GET', '/after-destroy')).toBe(1);

        c.destroy();

        expect(() => query.execute()).not.toThrow();
        s.tick();

        expect(s.api.requestCount('GET', '/after-destroy')).toBe(1);
        expect(s.api.pending().length).toBe(0);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(String(warn.mock.calls[0]?.[0])).toContain('/after-destroy');
      } finally {
        warn.mockRestore();
      }
    });
  });

  describe('transformResponse throwing', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('a transformResponse that throws lands in error() as a failure and the next good response clears it', () => {
      const s = scenario();
      s.api.on('GET', '/transform-throws', sequence([{ body: { bad: true } }, { body: { bad: false, value: 42 } }]));

      const getTransformed = s.get<{ response: number; rawResponse: { bad: boolean; value?: number } }>(
        '/transform-throws',
        {
          transformResponse: (raw) => {
            if (raw.bad) throw new Error('cannot transform this response');
            return raw.value as number;
          },
        },
      );

      const c = s.consumer();
      const query = c.run(() => getTransformed());
      s.tick();

      expect(query.error()?.code).toBe(0);
      expect(query.error()?.raw.error).toBeInstanceOf(Error);
      expect(query.error()?.retryState.retry).toBe(false);
      expect(() => query.response()).not.toThrow();
      expect(query.response()).toBeNull();
      expect(query.loading()).toBeNull();
      expect(query.executionState()).toMatchObject({ type: 'failure', hasCachedResponse: false });

      query.execute();
      s.tick();
      expect(query.response()).toBe(42);
      expect(query.error()).toBeNull();
      expect(query.executionState()).toMatchObject({ type: 'success', response: 42 });

      c.destroy();
    });
  });

  describe('shared-key retryFn', () => {
    const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

    it('the retryFn of whichever consumer first creates the shared cache entry governs it - a later consumer bound to the same key cannot change it', () => {
      const s = scenario();
      s.api.on('GET', '/shared-flaky', sequence([{ status: 503 }, { body: { ok: true } }]));

      const getNoRetry = s.get<{ response: { ok: boolean } }>('/shared-flaky');
      const getWithRetry = s.get<{ response: { ok: boolean } }>('/shared-flaky', {
        retryFn: createDefaultRetryFn({ maxAttempts: 1, jitter: 0 }),
      });

      const a = s.consumer();
      const b = s.consumer();
      const queryA = a.run(() => getNoRetry());
      const queryB = b.run(() => getWithRetry());

      s.tick();

      expect(s.api.requestCount('GET', '/shared-flaky')).toBe(1);
      expect(queryA.error()?.code).toBe(503);
      expect(queryB.error()?.code).toBe(503);

      s.tick(30_000);

      expect(s.api.requestCount('GET', '/shared-flaky')).toBe(1);
      expect(queryA.error()?.code).toBe(503);
      expect(queryB.error()?.code).toBe(503);

      s.expectError((entry) => entry.error instanceof HttpErrorResponse && entry.error.status === 503);

      a.destroy();
      b.destroy();
    });
  });
});
