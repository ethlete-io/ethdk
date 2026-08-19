import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { createQueryClient } from './query-client';
import { createPostQuery } from './query-creator-templates';
import { executeUntilSettled } from './query-snapshot-utils';

type CreateUserArgs = {
  body: { name: string };
  response: { id: number; name: string };
};

describe('executeUntilSettled', () => {
  const client = createQueryClient({ baseUrl: 'https://example.com', name: 'settled-test' });

  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    httpTesting = TestBed.inject(HttpTestingController);
  });

  const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve));

  it('should resolve with the response once the execution succeeds', async () => {
    const createUser = createPostQuery(client)<CreateUserArgs>('/users');
    const query = TestBed.runInInjectionContext(() => createUser());

    const settled = executeUntilSettled(query, { args: { body: { name: 'Ada' } } });

    TestBed.tick();

    httpTesting.expectOne('https://example.com/users').flush({ id: 1, name: 'Ada' });

    TestBed.tick();
    await flushMicrotasks();
    TestBed.tick();

    const snapshot = await settled;

    expect(snapshot.isAlive()).toBe(false);
    expect(snapshot.response()).toEqual({ id: 1, name: 'Ada' });
    expect(snapshot.error()).toBeNull();
  });

  it('should resolve with the error once the execution fails', async () => {
    const createUser = createPostQuery(client)<CreateUserArgs>('/users');
    const query = TestBed.runInInjectionContext(() => createUser());

    const settled = executeUntilSettled(query, { args: { body: { name: 'Ada' } } });

    TestBed.tick();

    httpTesting
      .expectOne('https://example.com/users')
      .flush(
        { violations: [{ message: 'Name is taken', propertyPath: 'name' }] },
        { status: 422, statusText: 'Unprocessable Entity' },
      );

    TestBed.tick();
    await flushMicrotasks();
    TestBed.tick();

    const snapshot = await settled;

    expect(snapshot.isAlive()).toBe(false);
    expect(snapshot.response()).toBeNull();
    expect(snapshot.error()?.code).toBe(422);
  });

  it('should correlate consecutive executions while the previous response is retained', async () => {
    const createUser = createPostQuery(client)<CreateUserArgs>('/users');
    const query = TestBed.runInInjectionContext(() => createUser());

    const settled = executeUntilSettled(query, { args: { body: { name: 'Ada' } } });

    TestBed.tick();
    httpTesting.expectOne('https://example.com/users').flush({ id: 1, name: 'Ada' });
    TestBed.tick();
    await flushMicrotasks();
    TestBed.tick();

    const snapshot = await settled;

    const secondSettled = executeUntilSettled(query, { args: { body: { name: 'Grace' } } });
    TestBed.tick();
    query.subtle.setResponse({ id: 1, name: 'Ada' });
    TestBed.tick();

    expect(query.response()).toEqual({ id: 1, name: 'Ada' });

    httpTesting.expectOne('https://example.com/users').flush({ id: 2, name: 'Grace' });
    TestBed.tick();
    await flushMicrotasks();
    TestBed.tick();

    const secondSnapshot = await secondSettled;

    expect(snapshot.response()).toEqual({ id: 1, name: 'Ada' });
    expect(secondSnapshot.response()).toEqual({ id: 2, name: 'Grace' });
    expect(query.response()).toEqual({ id: 2, name: 'Grace' });
  });
});
