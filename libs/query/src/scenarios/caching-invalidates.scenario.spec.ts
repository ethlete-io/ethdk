import { describe, expect, it } from 'vitest';
import {
  createGetQuery,
  createGqlMutationViaPost,
  createPatchQuery,
  gql,
  QueryInvalidationOptions,
  withArgs,
} from '../index';
import { useScenario } from './harness';

type Opportunity = { uuid: string; people: string[] };
type GetOpportunityArgs = { response: Opportunity; pathParams: { uuid: string } };
type PatchPersonArgs = {
  response: { uuid: string; role: string };
  pathParams: { uuid: string; peopleUuid: string };
  body: { role: string };
};
type Player = { id: string; v: number };
type PlayerArgs = { response: Player; pathParams: { id: string } };

describe('invalidates and tags', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  it('re-runs an in-use read once after a patch with invalidates: [{ url }]', () => {
    const s = scenario();
    let version = 1;
    s.api.on('GET', '/players/:id', ({ params }) => ({ body: { id: params['id'], v: version } }));
    s.api.on('PATCH', '/players/:id', () => {
      version++;

      return { body: null, status: 204 };
    });

    const getPlayer = s.get<PlayerArgs>((p) => `/players/${p.id}`);
    const patchPlayer = s.patch<{ response: null; pathParams: { id: string }; body: { name: string } }>(
      (p) => `/players/${p.id}`,
      { invalidates: [{ url: '/players' }] },
    );

    const c = s.consumer();
    const player = c.run(() => getPlayer(withArgs(() => ({ pathParams: { id: '1' } }))));
    const patch = c.run(() => patchPlayer(withArgs(() => ({ pathParams: { id: '1' }, body: { name: 'Ada' } }))));
    s.tick();

    patch.execute();
    s.flush();

    expect(s.api.requestCount('PATCH', '/players/1')).toBe(1);
    expect(s.api.requestCount('GET', '/players/1')).toBe(2);
    expect(player.response()).toEqual({ id: '1', v: 2 });
  });

  it('re-runs only the read whose tags match a tag invalidation', () => {
    const s = scenario();
    s.api.on('GET', '/players/:id', ({ params }) => ({ body: { id: params['id'], v: 1 } }));

    const getPlayer = s.get<PlayerArgs>((p) => `/players/${p.id}`, {
      tags: ({ args }) => [`player:${args.pathParams.id}`],
    });
    const getPlayerUntagged = s.get<PlayerArgs>((p) => `/players/${p.id}`);

    const c = s.consumer();
    c.run(() => getPlayer(withArgs(() => ({ pathParams: { id: '1' } }))));
    c.run(() => getPlayer(withArgs(() => ({ pathParams: { id: '2' } }))));
    c.run(() => getPlayerUntagged(withArgs(() => ({ pathParams: { id: '3' } }))));
    s.tick();

    s.client.invalidateQueries({ tag: 'player:1' });
    s.tick();

    expect(s.api.requestCount('GET', '/players/1')).toBe(2);
    expect(s.api.requestCount('GET', '/players/2')).toBe(1);
    expect(s.api.requestCount('GET', '/players/3')).toBe(1);
  });

  it('re-runs the reads a mutation tags through an invalidates function, with its args and response', () => {
    const s = scenario();
    s.api.on('GET', '/teams/:id', ({ params }) => ({ body: { id: params['id'], v: 1 } }));
    s.api.on('POST', '/transfers', () => ({ body: { toTeam: '7' } }));

    const getTeam = s.get<PlayerArgs>((p) => `/teams/${p.id}`, {
      tags: ({ args }) => [`team:${args.pathParams.id}`],
    });
    const seen: unknown[] = [];
    const createTransfer = s.post<{ response: { toTeam: string }; body: { fromTeam: string } }>('/transfers', {
      invalidates: ({ args, response }) => {
        seen.push({ args, response });

        return [{ tag: `team:${args.body.fromTeam}` }, { tag: `team:${response?.toTeam}` }];
      },
    });

    const c = s.consumer();
    c.run(() => getTeam(withArgs(() => ({ pathParams: { id: '3' } }))));
    c.run(() => getTeam(withArgs(() => ({ pathParams: { id: '7' } }))));
    c.run(() => getTeam(withArgs(() => ({ pathParams: { id: '9' } }))));
    const transfer = c.run(() => createTransfer(withArgs(() => ({ body: { fromTeam: '3' } }))));
    s.tick();

    transfer.execute();
    s.flush();

    expect(seen).toEqual([{ args: { body: { fromTeam: '3' } }, response: { toTeam: '7' } }]);
    expect(s.api.requestCount('GET', '/teams/3')).toBe(2);
    expect(s.api.requestCount('GET', '/teams/7')).toBe(2);
    expect(s.api.requestCount('GET', '/teams/9')).toBe(1);
  });

  it('restarts a tagged read that is still in flight', () => {
    const s = scenario();
    let version = 1;
    s.api.on('GET', '/players/:id', ({ params }) => ({ body: { id: params['id'], v: version }, delay: 100 }));

    const getPlayer = s.get<PlayerArgs>((p) => `/players/${p.id}`, {
      tags: ({ args }) => [`player:${args.pathParams.id}`],
    });

    const c = s.consumer();
    const player = c.run(() => getPlayer(withArgs(() => ({ pathParams: { id: '1' } }))));
    s.tick(10);

    version = 2;
    s.client.invalidateQueries({ tag: 'player:1' });
    s.tick(200);

    expect(s.api.requests.filter((r) => r.path === '/players/1').map((r) => r.aborted)).toEqual([true, false]);
    expect(player.response()).toEqual({ id: '1', v: 2 });
  });

  it('restarts a read once when several invalidates targets of one mutation match it', () => {
    const s = scenario();
    let version = 1;
    s.api.on('GET', '/players/:id', ({ params }) => ({ body: { id: params['id'], v: version }, delay: 50 }));
    s.api.on('PATCH', '/players/:id', () => {
      version++;

      return { body: null, status: 204 };
    });

    const getPlayer = s.get<PlayerArgs>((p) => `/players/${p.id}`, {
      tags: ({ args }) => [`player:${args.pathParams.id}`],
    });
    const patchPlayer = s.patch<{ response: null; pathParams: { id: string } }>((p) => `/players/${p.id}`, {
      invalidates: ({ args }) => [{ tag: `player:${args.pathParams.id}` }, { url: '/players' }],
    });

    const c = s.consumer();
    const player = c.run(() => getPlayer(withArgs(() => ({ pathParams: { id: '1' } }))));
    const patch = c.run(() => patchPlayer(withArgs(() => ({ pathParams: { id: '1' } }))));
    s.tick(100);

    patch.execute();
    s.flush();

    expect(s.api.requests.filter((r) => r.path === '/players/1' && r.method === 'GET').map((r) => r.aborted)).toEqual([
      false,
      false,
    ]);
    expect(player.response()).toEqual({ id: '1', v: 2 });
  });

  it('invalidates nothing when the mutation fails', () => {
    const s = scenario();
    s.api.on('GET', '/players/:id', ({ params }) => ({ body: { id: params['id'], v: 1 } }));
    s.api.on('PATCH', '/players/:id', () => ({ status: 500, body: { message: 'nope' } }));

    const getPlayer = s.get<PlayerArgs>((p) => `/players/${p.id}`, {
      tags: ({ args }) => [`player:${args.pathParams.id}`],
    });
    const patchPlayer = s.patch<{ response: null; pathParams: { id: string } }>((p) => `/players/${p.id}`, {
      invalidates: [{ url: '/players' }, { tag: 'player:1' }],
      reportErrors: false,
    });

    const c = s.consumer();
    c.run(() => getPlayer(withArgs(() => ({ pathParams: { id: '1' } }))));
    const patch = c.run(() => patchPlayer(withArgs(() => ({ pathParams: { id: '1' } }))));
    s.tick();

    patch.execute();
    s.flush();

    expect(patch.error()).not.toBeNull();
    expect(s.api.requestCount('PATCH', '/players/1')).toBe(1);
    expect(s.api.requestCount('GET', '/players/1')).toBe(1);
  });

  it('invalidates from a GraphQL mutation', () => {
    const s = scenario();
    s.api.on('GET', '/players/:id', ({ params }) => ({ body: { id: params['id'], v: 1 } }));
    s.api.on('POST', '/', () => ({ body: { data: { renamePlayer: { ok: true } } } }));

    const getPlayer = s.get<PlayerArgs>((p) => `/players/${p.id}`, {
      tags: ({ args }) => [`player:${args.pathParams.id}`],
    });
    const renamePlayer = createGqlMutationViaPost(s.clientRef)<{
      response: { renamePlayer: { ok: boolean } };
      variables: { id: string; name: string };
    }>(
      gql`
        mutation RenamePlayer($id: ID!, $name: String!) {
          renamePlayer(id: $id, name: $name) {
            ok
          }
        }
      `,
      { invalidates: ({ args }) => [{ tag: `player:${args.variables.id}` }] },
    );

    const c = s.consumer();
    c.run(() => getPlayer(withArgs(() => ({ pathParams: { id: '1' } }))));
    const rename = c.run(() => renamePlayer(withArgs(() => ({ variables: { id: '1', name: 'Ada' } }))));
    s.tick();

    rename.execute();
    s.flush();

    expect(s.api.requestCount('GET', '/players/1')).toBe(2);
  });

  it('throws when a read declares invalidates', () => {
    const s = scenario();

    const getPlayers = s.get<{ response: Player[] }>('/players', { invalidates: [{ url: '/teams' }] });

    expect(() => s.consumer().run(() => getPlayers())).toThrow(/"invalidates" is only supported on mutations/);
  });

  it('runs the plan example through the public API', () => {
    const s = scenario();
    const people = new Map([['9', ['p1']]]);
    s.api.on('GET', '/opportunities/:uuid', ({ params }) => ({
      body: { uuid: params['uuid'], people: people.get(params['uuid'] ?? '') ?? [] },
    }));
    s.api.on('GET', '/people', () => ({ body: [] }));
    s.api.on('PATCH', '/opportunities/:uuid/people/:peopleUuid', ({ params, body }) => {
      people.set(params['uuid'] ?? '', [...(people.get(params['uuid'] ?? '') ?? []), params['peopleUuid'] ?? '']);

      return { body: { uuid: params['peopleUuid'], role: (body as { role: string }).role } };
    });

    const getOpportunity = createGetQuery(s.clientRef)<GetOpportunityArgs>((p) => `/opportunities/${p.uuid}`, {
      tags: ({ args }) => [`opportunity:${args.pathParams.uuid}`],
    });
    const getPeople = createGetQuery(s.clientRef)<{ response: unknown[] }>('/people');
    const patchOpportunityPerson = createPatchQuery(s.clientRef)<PatchPersonArgs>(
      (p) => `/opportunities/${p.uuid}/people/${p.peopleUuid}`,
      {
        invalidates: ({ args }) => [{ tag: `opportunity:${args.pathParams.uuid}` }, { url: '/people' }],
      },
    );

    const c = s.consumer();
    const opportunity = c.run(() => getOpportunity(withArgs(() => ({ pathParams: { uuid: '9' } }))));
    const otherOpportunity = c.run(() => getOpportunity(withArgs(() => ({ pathParams: { uuid: '10' } }))));
    c.run(() => getPeople());
    const patch = c.run(() =>
      patchOpportunityPerson(withArgs(() => ({ pathParams: { uuid: '9', peopleUuid: 'p2' }, body: { role: 'lead' } }))),
    );
    s.tick();

    patch.execute();
    s.flush();

    expect(opportunity.response()).toEqual({ uuid: '9', people: ['p1', 'p2'] });
    expect(otherOpportunity.response()).toEqual({ uuid: '10', people: [] });
    expect(s.api.requestCount('GET', '/opportunities/9')).toBe(2);
    expect(s.api.requestCount('GET', '/opportunities/10')).toBe(1);
    expect(s.api.requestCount('GET', '/people')).toBe(2);
  });
});

describe('invalidates and tags with retained entries', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 5_000 } });

  it('leaves an unused tagged entry alone and revalidates it when a consumer binds again', () => {
    const s = scenario();
    let version = 1;
    s.api.on('GET', '/players/:id', ({ params }) => ({ body: { id: params['id'], v: version } }));
    s.api.on('PATCH', '/players/:id', () => {
      version++;

      return { body: null, status: 204 };
    });

    const getPlayer = s.get<PlayerArgs>((p) => `/players/${p.id}`, {
      tags: ({ args }) => [`player:${args.pathParams.id}`],
    });
    const patchPlayer = s.patch<{ response: null; pathParams: { id: string } }>((p) => `/players/${p.id}`, {
      invalidates: ({ args }) => [{ tag: `player:${args.pathParams.id}` }],
    });

    const orphan = s.consumer();
    orphan.run(() => getPlayer(withArgs(() => ({ pathParams: { id: '1' } }))));
    s.tick();
    orphan.destroy();

    const c = s.consumer();
    const patch = c.run(() => patchPlayer(withArgs(() => ({ pathParams: { id: '1' } }))));
    patch.execute();
    s.flush();

    expect(s.api.requestCount('PATCH', '/players/1')).toBe(1);
    expect(s.api.requestCount('GET', '/players/1')).toBe(1);

    const returning = c.run(() => getPlayer(withArgs(() => ({ pathParams: { id: '1' } }))));
    s.tick();

    expect(s.api.requestCount('GET', '/players/1')).toBe(2);
    expect(returning.response()).toEqual({ id: '1', v: 2 });

    c.destroy();
    s.tick(5_001);
  });

  it.each<{ by: string; target: QueryInvalidationOptions }>([
    { by: 'url', target: { url: '/players' } },
    { by: 'tag', target: { tag: 'player:1' } },
  ])('marks an unused entry stale on a $by invalidation, so allowCache refetches it', ({ target }) => {
    const s = scenario();
    let version = 1;
    s.api.on('GET', '/players/:id', ({ params }) => ({
      body: { id: params['id'], v: version },
      headers: { 'cache-control': 'max-age=600' },
    }));

    const getPlayer = s.get<PlayerArgs>((p) => `/players/${p.id}`, {
      tags: ({ args }) => [`player:${args.pathParams.id}`],
    });
    const getPlayerManually = s.get<PlayerArgs>((p) => `/players/${p.id}`);

    const orphan = s.consumer();
    orphan.run(() => getPlayer(withArgs(() => ({ pathParams: { id: '1' } }))));
    s.tick();
    orphan.destroy();

    version = 2;
    s.client.invalidateQueries(target);
    s.tick();

    expect(s.api.requestCount('GET', '/players/1')).toBe(1);

    const c = s.consumer();
    const returning = c.run(() =>
      getPlayerManually(
        { onlyManualExecution: true },
        withArgs(() => ({ pathParams: { id: '1' } })),
      ),
    );
    returning.execute({ options: { allowCache: true } });
    s.tick();

    expect(s.api.requestCount('GET', '/players/1')).toBe(2);
    expect(returning.response()).toEqual({ id: '1', v: 2 });

    c.destroy();
    s.tick(5_001);
  });

  it('leaves an unused entry outside the invalidation fresh', () => {
    const s = scenario();
    s.api.on('GET', '/teams/:id', ({ params }) => ({
      body: { id: params['id'], v: 1 },
      headers: { 'cache-control': 'max-age=600' },
    }));

    const getTeam = s.get<PlayerArgs>((p) => `/teams/${p.id}`);

    const orphan = s.consumer();
    orphan.run(() => getTeam(withArgs(() => ({ pathParams: { id: '1' } }))));
    s.tick();
    orphan.destroy();

    s.client.invalidateQueries({ url: '/players' });
    s.client.invalidateQueries({ tag: 'player:1' });
    s.tick();

    const c = s.consumer();
    const returning = c.run(() =>
      getTeam(
        { onlyManualExecution: true },
        withArgs(() => ({ pathParams: { id: '1' } })),
      ),
    );
    returning.execute({ options: { allowCache: true } });
    s.tick();

    expect(s.api.requestCount('GET', '/teams/1')).toBe(1);
    expect(returning.response()).toEqual({ id: '1', v: 1 });

    c.destroy();
    s.tick(5_001);
  });
});
