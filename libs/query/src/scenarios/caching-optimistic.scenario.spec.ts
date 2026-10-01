import { describe, expect, it } from 'vitest';
import { createGetQuery, createPatchQuery, createPostQuery, withArgs, withOptimisticUpdate } from '../index';
import { useScenario } from './harness';

type Opportunity = { uuid: string; people: string[] };
type GetOpportunityArgs = { response: Opportunity; pathParams: { uuid: string } };
type PatchPersonArgs = {
  response: { uuid: string; role: string } | null;
  pathParams: { uuid: string; peopleUuid: string };
  body: { role: string };
};

const toggle = (list: string[], item: string) =>
  list.includes(item) ? list.filter((entry) => entry !== item) : [...list, item];

describe('withOptimisticUpdate', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  const setup = (options: { patchStatus?: (peopleUuid: string) => number } = {}) => {
    const s = scenario();
    const people = new Map([['9', ['p1']]]);

    s.api.on('GET', '/opportunities/:uuid', ({ params }) => ({
      body: { uuid: params['uuid'], people: [...(people.get(params['uuid'] ?? '') ?? [])] },
      delay: 20,
    }));
    s.api.on('PATCH', '/opportunities/:uuid/people/:peopleUuid', ({ params }) => {
      const status = options.patchStatus?.(params['peopleUuid'] ?? '') ?? 200;

      if (status === 200) {
        const uuid = params['uuid'] ?? '';
        people.set(uuid, toggle(people.get(uuid) ?? [], params['peopleUuid'] ?? ''));
      }

      return status === 200
        ? { body: { uuid: params['peopleUuid'], role: 'lead' }, delay: 50 }
        : { status, body: { message: 'nope' }, delay: 50 };
    });

    const getOpportunity = createGetQuery(s.clientRef)<GetOpportunityArgs>((p) => `/opportunities/${p.uuid}`, {
      tags: ({ args }) => [`opportunity:${args.pathParams.uuid}`],
    });
    const patchOpportunityPerson = createPatchQuery(s.clientRef)<PatchPersonArgs>(
      (p) => `/opportunities/${p.uuid}/people/${p.peopleUuid}`,
      {
        invalidates: ({ args }) => [{ tag: `opportunity:${args.pathParams.uuid}` }],
        reportErrors: false,
      },
    );

    const c = s.consumer();
    const opportunity = c.run(() => getOpportunity(withArgs(() => ({ pathParams: { uuid: '9' } }))));
    const patchPerson = (peopleUuid: string) =>
      c.run(() =>
        patchOpportunityPerson(
          withArgs(() => ({ pathParams: { uuid: '9', peopleUuid }, body: { role: 'lead' } })),
          withOptimisticUpdate({
            read: getOpportunity,
            target: ({ args }) => ({ tag: `opportunity:${args.pathParams.uuid}` }),
            update: ({ current, args }) => ({
              ...current,
              people: toggle(current.people, args.pathParams.peopleUuid),
            }),
          }),
        ),
      );

    s.tick(50);

    return { s, c, opportunity, patchPerson, getOpportunity };
  };

  it('applies the update before the request and keeps it through the invalidates refetch', () => {
    const { s, opportunity, patchPerson } = setup();
    const patch = patchPerson('p2');

    patch.execute();

    expect(opportunity.response()).toEqual({ uuid: '9', people: ['p1', 'p2'] });
    expect(s.api.requestCount('PATCH', '/opportunities/9/people/p2')).toBe(1);

    s.tick(50);

    expect(opportunity.loading()).not.toBeNull();
    expect(opportunity.response()).toEqual({ uuid: '9', people: ['p1', 'p2'] });

    s.flush();

    expect(s.api.requestCount('GET', '/opportunities/9')).toBe(2);
    expect(opportunity.response()).toEqual({ uuid: '9', people: ['p1', 'p2'] });
  });

  it('rolls the update back when the mutation fails', () => {
    const { s, opportunity, patchPerson } = setup({ patchStatus: () => 500 });
    const before = opportunity.response();
    const patch = patchPerson('p2');

    patch.execute();
    expect(opportunity.response()).toEqual({ uuid: '9', people: ['p1', 'p2'] });

    s.flush();

    expect(patch.error()).not.toBeNull();
    expect(opportunity.response()).toBe(before);
    expect(s.api.requestCount('GET', '/opportunities/9')).toBe(1);
  });

  it('rolls the update back when the mutation is aborted or its consumer is destroyed', () => {
    const { s, opportunity, patchPerson } = setup();
    const before = opportunity.response();

    const patch = patchPerson('p2');
    patch.execute();
    expect(patch.abort()).toBe(true);
    expect(opportunity.response()).toBe(before);

    const other = s.consumer();
    const patchFromOther = other.run(() =>
      createPatchQuery(s.clientRef)<PatchPersonArgs>((p) => `/opportunities/${p.uuid}/people/${p.peopleUuid}`)(
        withArgs(() => ({ pathParams: { uuid: '9', peopleUuid: 'p3' }, body: { role: 'lead' } })),
        withOptimisticUpdate({
          target: () => ({ url: '/opportunities/9' }),
          update: () => ({ uuid: '9', people: ['changed'] }),
        }),
      ),
    );
    patchFromOther.execute();
    expect(opportunity.response()).toEqual({ uuid: '9', people: ['changed'] });

    other.destroy();
    expect(opportunity.response()).toBe(before);

    s.flush();
  });

  it('skips an entry the update returns null for, and entries without a response', () => {
    const s = scenario();
    s.api.on('GET', '/players/:id', ({ params }) => ({ body: { id: params['id'], name: 'old' }, delay: 20 }));
    s.api.on('PATCH', '/players', () => ({ body: null, status: 204, delay: 50 }));

    type Player = { id: string; name: string };
    const getPlayer = createGetQuery(s.clientRef)<{ response: Player; pathParams: { id: string } }>(
      (p) => `/players/${p.id}`,
    );
    const patchPlayers = createPatchQuery(s.clientRef)<{ response: null; body: { name: string } }>('/players');
    const updated: string[] = [];

    const c = s.consumer();
    const one = c.run(() => getPlayer(withArgs(() => ({ pathParams: { id: '1' } }))));
    const two = c.run(() => getPlayer(withArgs(() => ({ pathParams: { id: '2' } }))));
    s.tick(50);
    const pending = c.run(() => getPlayer(withArgs(() => ({ pathParams: { id: '3' } }))));

    const patch = c.run(() =>
      patchPlayers(
        withArgs(() => ({ body: { name: 'new' } })),
        withOptimisticUpdate({
          read: getPlayer,
          target: () => ({ url: '/players' }),
          update: ({ current, args }) => {
            updated.push(current.id);

            return current.id === '2' ? null : { ...current, name: args.body.name };
          },
        }),
      ),
    );

    patch.execute();

    expect(updated).toEqual(['1', '2']);
    expect(one.response()).toEqual({ id: '1', name: 'new' });
    expect(two.response()).toEqual({ id: '2', name: 'old' });
    expect(pending.response()).toBeNull();

    s.flush();
  });

  it('re-applies a pending update on top of the original when another one on the same entry rolls back', () => {
    const { s, opportunity, patchPerson } = setup({ patchStatus: (peopleUuid) => (peopleUuid === 'p2' ? 500 : 200) });
    const failing = patchPerson('p2');
    const succeeding = patchPerson('p3');

    failing.execute();
    s.tick(10);
    succeeding.execute();

    expect(opportunity.response()).toEqual({ uuid: '9', people: ['p1', 'p2', 'p3'] });

    s.tick(45);

    expect(failing.error()).not.toBeNull();
    expect(opportunity.response()).toEqual({ uuid: '9', people: ['p1', 'p3'] });

    s.flush();

    expect(opportunity.response()).toEqual({ uuid: '9', people: ['p1', 'p3'] });
  });

  it('calls update again with the mutation response after success', () => {
    const s = scenario();
    let comments = [{ id: 1, text: 'first' }];
    s.api.on('GET', '/comments', () => ({ body: comments, delay: 100 }));
    s.api.on('POST', '/comments', ({ body }) => {
      const comment = { id: comments.length + 1, text: (body as { text: string }).text };
      comments = [...comments, comment];

      return { body: comment, delay: 20 };
    });

    type Comment = { id: number; text: string };
    const getComments = createGetQuery(s.clientRef)<{ response: Comment[] }>('/comments');
    const postComment = createPostQuery(s.clientRef)<{ response: Comment; body: { text: string } }>('/comments', {
      invalidates: [{ url: '/comments' }],
    });
    const seen: unknown[] = [];

    const c = s.consumer();
    const list = c.run(() => getComments());
    s.tick(100);

    const post = c.run(() =>
      postComment(
        withArgs(() => ({ body: { text: 'second' } })),
        withOptimisticUpdate({
          read: getComments,
          target: () => ({ url: '/comments' }),
          update: ({ current, args, response }) => {
            seen.push(response);

            return [...current, response ?? { id: -1, text: args.body.text }];
          },
        }),
      ),
    );

    post.execute();
    expect(list.response()).toEqual([
      { id: 1, text: 'first' },
      { id: -1, text: 'second' },
    ]);

    s.tick(20);

    expect(seen).toEqual([undefined, { id: 2, text: 'second' }]);
    expect(list.response()).toEqual([
      { id: 1, text: 'first' },
      { id: 2, text: 'second' },
    ]);
    expect(list.loading()).not.toBeNull();

    s.flush();

    expect(s.api.requestCount('GET', '/comments')).toBe(2);
    expect(list.response()).toEqual([
      { id: 1, text: 'first' },
      { id: 2, text: 'second' },
    ]);
  });

  it('leaves an entry alone on rollback that a refetch wrote in the meantime', () => {
    const { s, opportunity, patchPerson } = setup({ patchStatus: () => 500 });
    const patch = patchPerson('p2');

    patch.execute();
    s.client.invalidateQueries({ tag: 'opportunity:9' });
    s.tick(20);

    const refetched = opportunity.response();
    expect(refetched).toEqual({ uuid: '9', people: ['p1'] });

    s.flush();

    expect(patch.error()).not.toBeNull();
    expect(opportunity.response()).toBe(refetched);
  });

  it('throws on a read', () => {
    const { c, getOpportunity } = setup();

    expect(() =>
      c.run(() =>
        getOpportunity(
          withArgs(() => ({ pathParams: { uuid: '9' } })),
          withOptimisticUpdate({ target: () => ({ url: '/opportunities' }), update: () => null }),
        ),
      ),
    ).toThrow(/"withOptimisticUpdate\(\)" is only supported on mutations/);
  });
});
