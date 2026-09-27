import { signal } from '@angular/core';
import { form, submit } from '@angular/forms/signals';
import { describe, expect, it, vi } from 'vitest';
import { createQuerySubmission, executeUntilSettled, querySequence, queryErrorMessage } from '../index';
import { Scenario, useScenario } from './harness';

type Model = { name: string };
type CreateArgs = { body: Model; response: { id: number } };

const drive = async <T>(s: Scenario, pending: Promise<T>, onRound?: (round: number) => void) => {
  let settled: { value: T } | undefined;
  pending.then((value) => (settled = { value }));

  for (let i = 0; i < 20 && settled === undefined; i++) {
    onRound?.(i);
    await Promise.resolve();
    s.tick(50);
  }

  return settled?.value;
};

describe('abort helpers scenario', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  describe('createQuerySubmission', () => {
    it('does not run onSuccess when the execution is aborted', async () => {
      const s = scenario();
      s.api.on('POST', '/items', () => ({ body: { id: 1 }, delay: 500 }));

      const createItem = s.post<CreateArgs>('/items');
      const onSuccess = vi.fn();
      const c = s.consumer();
      const submission = c.run(() =>
        createQuerySubmission({ queryCreator: createItem, args: (value: Model) => ({ body: value }), onSuccess }),
      );
      const testForm = c.run(() => form(signal<Model>({ name: 'a' }), { submission: { action: submission.action } }));

      const submitted = submit(testForm);
      s.tick(50);
      expect(submission.query.loading()).not.toBeNull();
      expect(submission.query.abort()).toBe(true);

      const result = await drive(s, submitted);

      expect(result).toBe(true);
      expect(onSuccess).not.toHaveBeenCalled();
      expect(testForm().submitting()).toBe(false);
      expect(testForm().errors()).toEqual([]);
      expect(s.api.requestCount('POST', '/items')).toBe(1);

      c.destroy();
    });

    it('runs onSuccess when the same value is resubmitted after an abort', async () => {
      const s = scenario();
      s.api.on('POST', '/items', () => ({ body: { id: 1 }, delay: 500 }));

      const createItem = s.post<CreateArgs>('/items');
      const onSuccess = vi.fn();
      const c = s.consumer();
      const submission = c.run(() =>
        createQuerySubmission({ queryCreator: createItem, args: (value: Model) => ({ body: value }), onSuccess }),
      );
      const testForm = c.run(() => form(signal<Model>({ name: 'a' }), { submission: { action: submission.action } }));

      const first = submit(testForm);
      s.tick(50);
      submission.query.abort();
      expect(await drive(s, first)).toBe(true);
      expect(onSuccess).not.toHaveBeenCalled();

      const second = submit(testForm);
      s.tick(600);

      expect(await drive(s, second)).toBe(true);
      expect(onSuccess).toHaveBeenCalledTimes(1);
      expect(onSuccess).toHaveBeenCalledWith({ id: 1 }, expect.anything());

      c.destroy();
    });
  });

  describe('querySequence', () => {
    it('stops at an aborted step: no later step runs and the run is not a success', async () => {
      const s = scenario();
      s.api.on('POST', '/orders', () => ({ body: { id: 'order-1' }, delay: 500 }));
      s.api.on('POST', '/payments', () => ({ body: { id: 'payment-1' } }));

      const createOrder = s.post<{ response: { id: string }; body: { total: number } }>('/orders');
      const createPayment = s.post<{ response: { id: string }; body: { orderId: string } }>('/payments');
      const mapPayment = vi.fn((order: { id: string }) => ({ args: { body: { orderId: order.id } } }));

      const c = s.consumer();
      const { checkout, orderQuery } = c.run(() => {
        const orderQuery = createOrder();
        const paymentQuery = createPayment();

        return {
          orderQuery,
          checkout: querySequence(orderQuery, () => ({ args: { body: { total: 1 } } })).then(paymentQuery, mapPayment),
        };
      });

      const run = checkout.run();
      s.tick(50);
      expect(orderQuery.abort()).toBe(true);

      const result = await drive(s, run);

      expect(result).toEqual({ ok: false, failedAt: 0, error: null, snapshots: expect.any(Array) });
      expect(mapPayment).not.toHaveBeenCalled();
      expect(s.api.requestCount('POST', '/payments')).toBe(0);
      expect(checkout.status()).toBe('error');
      expect(checkout.error()).toBeNull();
      expect(checkout.failedAt()).toBe(0);
      expect(checkout.running()).toBe(false);
      expect(checkout.responses()).toEqual([]);

      c.destroy();
    });
  });

  describe('executeUntilSettled on a destroyed query', () => {
    it('resolves with a settled cancelled snapshot instead of throwing', async () => {
      const s = scenario();
      s.api.on('POST', '/items', () => ({ body: { id: 1 } }));

      const createItem = s.post<CreateArgs>('/items');
      const c = s.consumer();
      const query = c.run(() => createItem());

      c.destroy();

      const snapshot = await executeUntilSettled(query, { args: { body: { name: 'a' } } });

      expect(snapshot.isAlive()).toBe(false);
      expect(snapshot.loading()).toBeNull();
      expect(snapshot.response()).toBeNull();
      expect(snapshot.latestHttpEvent()).toEqual({ type: 'cancel' });
      expect(queryErrorMessage(snapshot.error())).toBe('The request was cancelled.');
      expect(s.api.requestCount('POST', '/items')).toBe(0);
    });
  });
});
