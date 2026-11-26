import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it } from 'vitest';
import { createQueryClient } from './query-client';
import { createPostQuery } from './query-creator-templates';
import { withArgs } from './query-features';
import { createQueryGroup, QueryGroupSuccess } from './query-group';

type AcceptArgs = { response: { accepted: true }; pathParams: { id: string } };
type DeclineArgs = { response: { declined: true }; body: { id: string; reason: string } };

describe('createQueryGroup', () => {
  const client = createQueryClient({ baseUrl: 'https://example.com', name: 'group-test' });
  const postAccept = createPostQuery(client)<AcceptArgs>((p) => `/invitations/${p.id}/accept`);
  const postDecline = createPostQuery(client)<DeclineArgs>('/invitations/decline');

  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  const makeGroup = () => {
    const group = TestBed.runInInjectionContext(() =>
      createQueryGroup({
        accept: postAccept(withArgs(() => ({ pathParams: { id: '1' } }))),
        decline: postDecline(),
      }),
    );
    TestBed.tick();

    return group;
  };

  const respond = (url: string, body: object | null, opts?: { status: number; statusText: string }) => {
    TestBed.tick();
    httpTesting.expectOne(`https://example.com${url}`).flush(body, opts);
    TestBed.tick();
  };

  it('types latest and succeeded$ per member', () => {
    const group = makeGroup();

    expectTypeOf(group.latest()).toEqualTypeOf<
      | { key: 'accept'; response: { accepted: true } | null }
      | { key: 'decline'; response: { declined: true } | null }
      | null
    >();
    expectTypeOf(group.succeeded$).toEqualTypeOf<Observable<QueryGroupSuccess<typeof group.members>>>();
  });

  it('starts with no latest member, no error and nothing loading', () => {
    const group = makeGroup();

    expect(group.latest()).toBeNull();
    expect(group.error()).toBeNull();
    expect(group.loading()).toBeNull();
  });

  it('records the member executed through members as latest', () => {
    const group = makeGroup();

    group.members.decline.execute({ args: { body: { id: '1', reason: 'busy' } } });

    expect(group.latest()).toEqual({ key: 'decline', response: null });
    expect(group.loading()).not.toBeNull();

    respond('/invitations/decline', { declined: true });

    expect(group.latest()).toEqual({ key: 'decline', response: { declined: true } });
    expect(group.loading()).toBeNull();
  });

  it('reports only the latest member error', () => {
    const group = makeGroup();

    group.members.decline.execute({ args: { body: { id: '1', reason: 'busy' } } });
    respond('/invitations/decline', { message: 'gone' }, { status: 410, statusText: 'Gone' });

    expect(group.error()?.code).toBe(410);

    group.members.accept.execute();
    respond('/invitations/1/accept', { accepted: true });

    expect(group.error()).toBeNull();
    expect(group.latest()).toEqual({ key: 'accept', response: { accepted: true } });
  });

  it('re-runs the latest member with its last args', () => {
    const group = makeGroup();

    group.execute();
    TestBed.tick();
    httpTesting.expectNone(() => true);

    group.members.decline.execute({ args: { body: { id: '7', reason: 'busy' } } });
    respond('/invitations/decline', { message: 'down' }, { status: 503, statusText: 'Unavailable' });

    group.execute({ options: { allowCache: false } });
    TestBed.tick();
    const retry = httpTesting.expectOne('https://example.com/invitations/decline');

    expect(retry.request.body).toEqual({ id: '7', reason: 'busy' });
    retry.flush({ declined: true });
    TestBed.tick();

    expect(group.error()).toBeNull();
  });

  it('emits each success once with its key', async () => {
    const group = makeGroup();
    const seen: unknown[] = [];
    const subscription = group.succeeded$.subscribe((success) => seen.push(success));

    group.members.accept.execute();
    respond('/invitations/1/accept', { accepted: true });
    group.members.decline.execute({ args: { body: { id: '1', reason: 'busy' } } });
    respond('/invitations/decline', { message: 'no' }, { status: 400, statusText: 'Bad Request' });
    await Promise.resolve();
    TestBed.tick();

    expect(seen).toEqual([{ key: 'accept', response: { accepted: true } }]);
    subscription.unsubscribe();
  });

  it('completes succeeded$ when its injection context is destroyed', () => {
    const group = TestBed.runInInjectionContext(() =>
      createQueryGroup({ accept: postAccept(withArgs(() => ({ pathParams: { id: '1' } }))) }),
    );
    let completed = false;

    group.succeeded$.subscribe({ complete: () => (completed = true) });
    TestBed.resetTestingModule();

    expect(completed).toBe(true);
  });
});
