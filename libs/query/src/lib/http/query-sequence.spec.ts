import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it } from 'vitest';
import { createQueryClient } from './query-client';
import { createPostQuery } from './query-creator-templates';
import { querySequence } from './query-sequence';

type CreateOrderArgs = {
  body: { item: string };
  response: { id: number; item: string };
};

type CreatePaymentArgs = {
  body: { orderId: number };
  response: { id: number; paid: boolean };
};

type ArchiveArgs = {
  body: { item: string };
  response: { id: number } | null;
};

type ConfirmArgs = {
  body: { orderId: number; paymentId: number };
  response: { confirmed: boolean };
};

describe('querySequence', () => {
  const client = createQueryClient({ baseUrl: 'https://example.com', name: 'sequence-test' });

  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve));

  // Flushes the currently pending request of the in-flight step and lets `run()` resume and issue
  // the next step's request.
  const settleStep = async <T>(url: string, response: T, opts?: { status: number; statusText: string }) => {
    TestBed.tick();
    httpTesting.expectOne(url).flush(response as object, opts);
    TestBed.tick();
    await flushMicrotasks();
    TestBed.tick();
    await flushMicrotasks();
  };

  const makeQueries = () =>
    TestBed.runInInjectionContext(() => ({
      createOrder: createPostQuery(client)<CreateOrderArgs>('/orders')(),
      createPayment: createPostQuery(client)<CreatePaymentArgs>('/payments')(),
      confirm: createPostQuery(client)<ConfirmArgs>('/confirmations')(),
    }));

  it('starts idle with the right step count', () => {
    const { createOrder, createPayment } = makeQueries();

    const seq = querySequence(createOrder, () => ({ args: { body: { item: 'book' } } })).then(
      createPayment,
      (order) => ({ args: { body: { orderId: order.id } } }),
    );

    expect(seq.status()).toBe('idle');
    expect(seq.running()).toBe(false);
    expect(seq.currentStep()).toBe(0);
    expect(seq.total).toBe(2);
    expect(seq.error()).toBeNull();
  });

  it('reports the fully-built step count from every link', () => {
    const { createOrder, createPayment, confirm } = makeQueries();

    const seed = querySequence(createOrder, () => ({ args: { body: { item: 'book' } } }));
    const chain = seed
      .then(createPayment, (order) => ({ args: { body: { orderId: order.id } } }))
      .then(confirm, (payment, [order]) => ({ args: { body: { orderId: order.id, paymentId: payment.id } } }));

    expect(seed.total).toBe(3);
    expect(chain.total).toBe(3);
    expect(seed.progress()).toBe(0);
  });

  it('types the next mapArgs from the previous step declared response, null included', () => {
    const { createOrder, createPayment } = makeQueries();
    const archive = TestBed.runInInjectionContext(() => createPostQuery(client)<ArchiveArgs>('/archive')());

    querySequence(createOrder, () => ({ args: { body: { item: 'book' } } })).then(createPayment, (order) => {
      expectTypeOf(order).toEqualTypeOf<{ id: number; item: string }>();

      return { args: { body: { orderId: order.id } } };
    });

    querySequence(archive, () => ({ args: { body: { item: 'book' } } })).then(createPayment, (archived) => {
      expectTypeOf(archived).toEqualTypeOf<{ id: number } | null>();

      return { args: { body: { orderId: archived?.id ?? 0 } } };
    });
  });

  it('can run again after an args mapper throws', async () => {
    const { createOrder } = makeQueries();
    let shouldThrow = true;
    const sequence = querySequence(createOrder, () => {
      if (shouldThrow) throw new Error('bad args');

      return { args: { body: { item: 'book' } } };
    });

    await expect(sequence.run()).rejects.toThrow('bad args');
    expect(sequence.running()).toBe(false);
    expect(sequence.status()).toBe('idle');

    shouldThrow = false;
    const rerun = sequence.run();
    await settleStep('https://example.com/orders', { id: 10, item: 'book' });

    await expect(rerun).resolves.toEqual(expect.objectContaining({ ok: true }));
  });

  it('runs dependent steps in order, threading each response into the next', async () => {
    const { createOrder, createPayment, confirm } = makeQueries();

    const seq = querySequence(createOrder, () => ({ args: { body: { item: 'book' } } }))
      .then(createPayment, (order) => ({ args: { body: { orderId: order.id } } }))
      .then(confirm, (payment, [order]) => ({ args: { body: { orderId: order.id, paymentId: payment.id } } }));

    const run = seq.run();

    await settleStep('https://example.com/orders', { id: 10, item: 'book' });

    // The payment request must carry the order id from the previous step.
    TestBed.tick();
    const paymentReq = httpTesting.expectOne('https://example.com/payments');
    expect(paymentReq.request.body).toEqual({ orderId: 10 });
    paymentReq.flush({ id: 99, paid: true });
    TestBed.tick();
    await flushMicrotasks();
    TestBed.tick();
    await flushMicrotasks();

    // The confirmation request reaches back to the first step's response.
    TestBed.tick();
    const confirmReq = httpTesting.expectOne('https://example.com/confirmations');
    expect(confirmReq.request.body).toEqual({ orderId: 10, paymentId: 99 });
    confirmReq.flush({ confirmed: true });
    TestBed.tick();
    await flushMicrotasks();
    TestBed.tick();

    const result = await run;

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.responses).toEqual([{ id: 10, item: 'book' }, { id: 99, paid: true }, { confirmed: true }]);
    }
    expect(seq.status()).toBe('success');
    expect(seq.running()).toBe(false);
    expect(seq.responses()).toHaveLength(3);
  });

  it('aborts on the first error and never runs later steps', async () => {
    const { createOrder, createPayment } = makeQueries();

    const seq = querySequence(createOrder, () => ({ args: { body: { item: 'book' } } })).then(
      createPayment,
      (order) => ({ args: { body: { orderId: order.id } } }),
    );

    const run = seq.run();

    await settleStep(
      'https://example.com/orders',
      { violations: [{ message: 'nope', propertyPath: 'item' }] },
      { status: 422, statusText: 'Unprocessable Entity' },
    );

    const result = await run;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failedAt).toBe(0);
      expect(result.error.code).toBe(422);
      expect(result.snapshots).toHaveLength(1);
    }
    expect(seq.status()).toBe('error');
    expect(seq.failedAt()).toBe(0);
    expect(seq.error()?.code).toBe(422);

    // The second step's request was never issued.
    httpTesting.expectNone('https://example.com/payments');
  });

  it('throws when run() is called while a run is already in flight', async () => {
    const { createOrder } = makeQueries();

    const seq = querySequence(createOrder, () => ({ args: { body: { item: 'book' } } }));

    const run = seq.run();

    await expect(seq.run()).rejects.toThrowError(/already running/i);

    await settleStep('https://example.com/orders', { id: 1, item: 'book' });
    await run;
  });

  it('is re-runnable after settling', async () => {
    const { createOrder } = makeQueries();

    const seq = querySequence(createOrder, () => ({ args: { body: { item: 'book' } } }));

    const firstRun = seq.run();
    await settleStep('https://example.com/orders', { id: 1, item: 'book' });
    const first = await firstRun;
    expect(first.ok).toBe(true);

    const secondRun = seq.run();
    expect(seq.status()).toBe('running');
    await settleStep('https://example.com/orders', { id: 2, item: 'book' });
    const second = await secondRun;

    expect(second.ok).toBe(true);
    if (second.ok) expect(second.responses).toEqual([{ id: 2, item: 'book' }]);
  });
});
