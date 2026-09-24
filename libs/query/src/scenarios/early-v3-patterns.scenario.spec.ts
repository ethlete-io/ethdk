import {
  computed,
  DestroyRef,
  effect,
  inject,
  Injector,
  runInInjectionContext,
  signal,
  untracked,
  WritableSignal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, takeUntil, tap, timer } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { Query, queryComputed, QueryErrorResponse, withArgs, withPolling, withSuccessHandling } from '../index';
import { createLegacyClient, LEGACY_CLIENT_KINDS, LegacyClient, Scenario, useScenario } from './harness';

type Match = { id: string; externalId: string | null };
type GgMatch = { id: string; conversationId: string };
type Permissions = { side: string; canChat: boolean };
type Scheduling = { tournamentMatchId: string; phase: string };
type ChatMessage = { id: string; content: string };

type GetPublicMatchArgs = { response: Match; pathParams: { id: string } };
type GetGgMatchArgs = { response: GgMatch; pathParams: { matchId: string } };
type GetPermissionsArgs = { response: Permissions; pathParams: { matchId: string; side: string } };
type GetSchedulingArgs = { response: Scheduling; pathParams: { tournamentMatchId: string } };
type MarkAsReadArgs = {
  response: ChatMessage[];
  pathParams: { conversationId: string };
  body: { participation: string; messages: string[] };
};
type CreateMessageArgs = {
  response: ChatMessage;
  pathParams: { conversationId: string };
  body: { content: string; participation: string };
};

const MARK_AS_READ_DELAY = 3000;
const DEFAULT_POLLING_INTERVAL = 30_000;

const createQueries = (s: Scenario) => ({
  getPublicMatchWithDetails: s.get<GetPublicMatchArgs>((p) => `/public/matches/${p.id}`),
  getGgBridgeProxyMatch: s.get<GetGgMatchArgs>((p) => `/gg/matches/${p.matchId}`),
  getGgBridgeProxyMatchSideUserPermissions: s.get<GetPermissionsArgs>(
    (p) => `/gg/matches/${p.matchId}/sides/${p.side}/permissions`,
  ),
  getTournamentMatchScheduling: s.get<GetSchedulingArgs>(
    (p) => `/tournament-matches/${p.tournamentMatchId}/scheduling`,
  ),
  postGgBridgeProxyMatchChatMessagesMarkAsRead: s.post<MarkAsReadArgs>(
    (p) => `/gg/conversations/${p.conversationId}/messages/mark-as-read`,
  ),
  postGgBridgeProxyMatchChatMessagesCreate: s.post<CreateMessageArgs>(
    (p) => `/gg/conversations/${p.conversationId}/messages`,
  ),
});

type Queries = ReturnType<typeof createQueries>;

const createLobbyApiContext = (
  Query3: Queries,
  legacy: LegacyClient,
  dfbMatchId: WritableSignal<string>,
  sideParam: WritableSignal<string | null>,
) => {
  const legacyGetTeam = legacy.get<{ pathParams: { id: string } }>((p) => `/legacy/matches/${p.id}/teams`);

  const dfbMatchQuery = Query3.getPublicMatchWithDetails(withArgs(() => ({ pathParams: { id: dfbMatchId() } })));
  const ggMatchId = computed(() => dfbMatchQuery.response()?.externalId ?? null);

  const matchQuery = Query3.getGgBridgeProxyMatch(
    withArgs(() => {
      const id = ggMatchId();

      return id ? { pathParams: { matchId: id } } : null;
    }),
  );
  const conversationId = computed(() => matchQuery.response()?.conversationId ?? null);

  const schedulingQuery = Query3.getTournamentMatchScheduling(
    withArgs(() => ({ pathParams: { tournamentMatchId: dfbMatchId() } })),
    withPolling({ interval: DEFAULT_POLLING_INTERVAL }),
  );

  const myPermissionsQuery = Query3.getGgBridgeProxyMatchSideUserPermissions(
    withArgs(() => {
      const id = ggMatchId();
      const side = sideParam();

      if (!side) return null;

      return id ? { pathParams: { matchId: id, side } } : null;
    }),
  );

  const teamsQuery = queryComputed(() => legacyGetTeam.prepare({ pathParams: { id: dfbMatchId() } }).execute());

  const isLoaded = computed(
    () => !!dfbMatchQuery.response() && !!matchQuery.response() && !!myPermissionsQuery.response(),
  );
  const loading = computed(
    () => (!!dfbMatchQuery.loading() || !!matchQuery.loading() || !!myPermissionsQuery.loading()) && !isLoaded(),
  );
  const nextError = computed<QueryErrorResponse | null>(
    () => dfbMatchQuery.error() ?? matchQuery.error() ?? myPermissionsQuery.error(),
  );

  const refetchLobby = () => {
    dfbMatchQuery.execute({ options: { allowCache: false } });
    matchQuery.execute({ options: { allowCache: false } });
    myPermissionsQuery.execute({ options: { allowCache: false } });
    schedulingQuery.execute({ options: { allowCache: false } });
  };

  return {
    dfbMatchQuery,
    matchQuery,
    schedulingQuery,
    myPermissionsQuery,
    teamsQuery,
    conversationId,
    loading,
    nextError,
    refetchLobby,
  };
};

type LobbyApiContext = ReturnType<typeof createLobbyApiContext>;

const createMatchChatMessageUpdater = (
  Query3: Queries,
  lobbyContext: LobbyApiContext,
  participationId: () => string,
) => {
  const destroyRef = inject(DestroyRef);
  const handled: ChatMessage[][] = [];

  const markAsReadQuery = Query3.postGgBridgeProxyMatchChatMessagesMarkAsRead(
    withArgs(() => {
      const cId = lobbyContext.conversationId();
      const messageIds = messageIdsToMarkAsRead();
      const contextId = participationId();

      if (!cId || !contextId || !messageIds.length) return null;

      return {
        pathParams: { conversationId: cId },
        body: { participation: contextId, messages: messageIds },
      };
    }),
    withSuccessHandling({
      handler: (response) => {
        messageIdsToMarkAsRead.set([]);
        handled.push(response);
      },
    }),
  );

  const messageIdsToMarkAsRead = signal<string[]>([]);
  const killPreviousMarkAsReadSignal$ = new Subject<boolean>();

  const markMessageAsRead = (...messageIds: string[]) => {
    const filteredMessageIds = messageIds.filter((messageId) => !messageIdsToMarkAsRead().includes(messageId));

    if (!filteredMessageIds.length) return;

    killPreviousMarkAsReadSignal$.next(true);

    const uniqueMessageIds = new Set([...messageIdsToMarkAsRead(), ...filteredMessageIds]);
    messageIdsToMarkAsRead.set(Array.from(uniqueMessageIds));

    timer(MARK_AS_READ_DELAY)
      .pipe(
        tap(() => {
          const messageIds = messageIdsToMarkAsRead();

          messageIdsToMarkAsRead.set(messageIds);
          markAsReadQuery.execute();
        }),
        takeUntil(killPreviousMarkAsReadSignal$),
        takeUntilDestroyed(destroyRef),
      )
      .subscribe();
  };

  return { markMessageAsRead, markAsReadQuery, handled };
};

type PendingChatMessage = { id: string; body: string; query: Query<CreateMessageArgs> };
type ChatMessageUnion =
  (ChatMessage & { metaType: 'message' }) | (PendingChatMessage & { metaType: 'pending-message' });

const createMatchChatContext = (lobbyContext: LobbyApiContext) => {
  const chatMessages = signal<ChatMessageUnion[]>([]);
  let pendingCounter = 0;

  effect(() => {
    lobbyContext.conversationId();

    untracked(() => {
      const pendingMessages = chatMessages().filter((msg) => msg.metaType === 'pending-message');

      for (const message of pendingMessages) {
        message.query.subtle.destroy();
      }

      chatMessages.set([]);
    });
  });

  const addPendingMessage = (message: Omit<PendingChatMessage, 'id'>) => {
    const fullPendingMessage = { ...message, metaType: 'pending-message' as const, id: `pending-${++pendingCounter}` };

    chatMessages.set([...chatMessages(), fullPendingMessage]);

    return fullPendingMessage;
  };

  const replacePendingMessage = (message: PendingChatMessage, newMessage: ChatMessage) => {
    const existingMessages = chatMessages();
    const messageIndex = existingMessages.findIndex((m) => m.id === message.id);
    const existingMessage = existingMessages[messageIndex];

    if (!existingMessage || existingMessage.metaType !== 'pending-message') return;

    existingMessage.query.subtle.destroy();

    const newMessages = [...existingMessages];
    newMessages[messageIndex] = { ...newMessage, metaType: 'message' };
    chatMessages.set(newMessages);
  };

  return { chatMessages, addPendingMessage, replacePendingMessage };
};

const createMatchChatMessageSender = (
  Query3: Queries,
  lobbyContext: LobbyApiContext,
  chatContext: ReturnType<typeof createMatchChatContext>,
) => {
  const injector = inject(Injector);

  const sendMessage = (text: string) => {
    const conversationId = lobbyContext.conversationId();

    runInInjectionContext(injector, () => {
      const trimmedMessage = text.trim();

      if (!trimmedMessage || !conversationId) return;

      const query = Query3.postGgBridgeProxyMatchChatMessagesCreate(
        withSuccessHandling({
          handler: (newMessage) => {
            chatContext.replacePendingMessage(pendingMessage, newMessage);
          },
        }),
        withArgs(() => ({
          pathParams: { conversationId },
          body: { content: trimmedMessage, participation: 'p-1' },
        })),
      );

      query.execute();

      const pendingMessage = chatContext.addPendingMessage({ body: trimmedMessage, query });
    });
  };

  return { sendMessage };
};

const serveLobby = (s: Scenario, options: { failPermissionsFor?: string } = {}) => {
  s.api.on('GET', '/public/matches/:id', ({ params }) => ({
    body: { id: params['id'], externalId: `gg-${params['id']}` },
    delay: 30,
  }));
  s.api.on('GET', '/gg/matches/:matchId', ({ params }) => ({
    body: { id: params['matchId'], conversationId: `conv-${params['matchId']}` },
    delay: 30,
  }));
  s.api.on('GET', '/gg/matches/:matchId/sides/:side/permissions', ({ params }) =>
    params['matchId'] === options.failPermissionsFor
      ? { status: 403, body: { message: 'forbidden' }, delay: 30 }
      : { body: { side: params['side'], canChat: true }, delay: 30 },
  );
  s.api.on('GET', '/tournament-matches/:id/scheduling', ({ params }) => ({
    body: { tournamentMatchId: params['id'], phase: 'open' },
    delay: 30,
  }));
  s.api.on('GET', '/legacy/matches/:id/teams', ({ params }) => ({ body: { matchId: params['id'] }, delay: 30 }));
  s.api.on('POST', '/gg/conversations/:conversationId/messages/mark-as-read', ({ body }) => ({
    body: (body as MarkAsReadArgs['body']).messages.map((id) => ({ id, content: 'read' })),
    delay: 30,
  }));
  s.api.on('POST', '/gg/conversations/:conversationId/messages', ({ body, params }) => ({
    body: { id: `${params['conversationId']}:${(body as CreateMessageArgs['body']).content}`, content: 'sent' },
    delay: 500,
  }));
};

const paths = (s: Scenario, prefix: string) =>
  s.api.requests.filter((request) => request.path.startsWith(prefix)).map((request) => request.path);

describe.each(LEGACY_CLIENT_KINDS)('early v3 lobby context next to a v2 call site on the %s client', (kind) => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  const setup = (options?: { failPermissionsFor?: string }) => {
    const s = scenario();
    serveLobby(s, options);
    const legacy = createLegacyClient(s, kind);
    const Query3 = createQueries(s);
    const dfbMatchId = signal('1');
    const sideParam = signal<string | null>('home');
    const c = s.consumer();
    const lobby = c.run(() => createLobbyApiContext(Query3, legacy, dfbMatchId, sideParam));

    return { s, legacy, Query3, c, lobby, dfbMatchId, sideParam };
  };

  it('follows each match change with one request per dependent query', () => {
    const { s, legacy, c, lobby, dfbMatchId } = setup();

    s.flush(1000);
    expect(lobby.loading()).toBe(false);

    for (const next of ['2', '3', '4']) {
      dfbMatchId.set(next);
      s.flush(1000);

      expect(lobby.myPermissionsQuery.response()).toEqual({ side: 'home', canChat: true });
      expect(lobby.conversationId()).toBe(`conv-gg-${next}`);
    }

    for (const id of ['1', '2', '3', '4']) {
      expect(s.api.requestCount('GET', `/public/matches/${id}`)).toBe(1);
      expect(s.api.requestCount('GET', `/gg/matches/gg-${id}`)).toBe(1);
      expect(s.api.requestCount('GET', `/gg/matches/gg-${id}/sides/home/permissions`)).toBe(1);
      expect(s.api.requestCount('GET', `/tournament-matches/${id}/scheduling`)).toBe(1);
      expect(s.api.requestCount('GET', `/legacy/matches/${id}/teams`)).toBe(1);
    }

    expect(lobby.teamsQuery()?.rawState).toMatchObject({ response: { matchId: '4' } });
    expect(legacy.liveQueries()).toEqual([lobby.teamsQuery()]);

    c.destroy();
    legacy.destroy();
  });

  it('parks the permissions query without a side and resumes it when one is set', () => {
    const { s, legacy, c, lobby, sideParam } = setup();

    s.flush(1000);

    for (const side of [null, 'away', null, 'home']) {
      sideParam.set(side);
      s.flush(1000);
    }

    expect(paths(s, '/gg/matches/gg-1/sides')).toEqual([
      '/gg/matches/gg-1/sides/home/permissions',
      '/gg/matches/gg-1/sides/away/permissions',
      '/gg/matches/gg-1/sides/home/permissions',
    ]);
    expect(lobby.myPermissionsQuery.response()).toEqual({ side: 'home', canChat: true });

    c.destroy();
    legacy.destroy();
  });

  it('polls the scheduling and refetches every lobby query once on refetchLobby', () => {
    const { s, legacy, c, lobby } = setup();

    s.flush(1000);
    s.tick(3 * DEFAULT_POLLING_INTERVAL);

    expect(s.api.requestCount('GET', '/tournament-matches/1/scheduling')).toBe(4);

    lobby.refetchLobby();
    s.tick(1000);

    expect(s.api.requestCount('GET', '/public/matches/1')).toBe(2);
    expect(s.api.requestCount('GET', '/gg/matches/gg-1')).toBe(2);
    expect(s.api.requestCount('GET', '/gg/matches/gg-1/sides/home/permissions')).toBe(2);
    expect(s.api.requestCount('GET', '/tournament-matches/1/scheduling')).toBe(5);
    expect(s.api.requestCount('GET', '/legacy/matches/1/teams')).toBe(1);

    c.destroy();
    legacy.destroy();
  });

  it('surfaces a failing dependent query as the next error', () => {
    const { s, legacy, c, lobby, dfbMatchId } = setup({ failPermissionsFor: 'gg-2' });

    s.flush(1000);
    expect(lobby.nextError()).toBeNull();

    dfbMatchId.set('2');
    s.flush(1000);

    expect(lobby.nextError()?.code).toBe(403);
    s.expectError((entry) => (entry.error as { status?: number }).status === 403);

    dfbMatchId.set('3');
    s.flush(1000);

    expect(lobby.nextError()).toBeNull();
    expect(s.api.requestCount('GET', '/gg/matches/gg-2/sides/home/permissions')).toBe(1);

    c.destroy();
    legacy.destroy();
  });
});

describe('early v3 chat queries created in a handler and destroyed by hand', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  const setup = () => {
    const s = scenario();
    serveLobby(s);
    const legacy = createLegacyClient(s, 'interop');
    const Query3 = createQueries(s);
    const dfbMatchId = signal('1');
    const c = s.consumer();
    const lobby = c.run(() => createLobbyApiContext(Query3, legacy, dfbMatchId, signal('home')));
    const chat = c.run(() => createMatchChatContext(lobby));
    const sender = c.run(() => createMatchChatMessageSender(Query3, lobby, chat));
    const updater = c.run(() => createMatchChatMessageUpdater(Query3, lobby, () => 'p-1'));

    s.flush(1000);

    const chatQueries = () =>
      s
        .liveQueries()
        .filter((query) => chat.chatMessages().some((m) => m.metaType === 'pending-message' && m.query === query));

    return { s, legacy, c, lobby, chat, sender, updater, dfbMatchId, chatQueries };
  };

  it('posts each message once and destroys its query from its own success handler', () => {
    const { s, legacy, c, chat, sender } = setup();
    const liveBefore = s.liveQueries().length;

    for (const text of ['hi', 'gg', 'rematch?']) {
      sender.sendMessage(text);
    }

    s.tick(10);
    expect(s.liveQueries()).toHaveLength(liveBefore + 3);
    expect(chat.chatMessages().map((m) => m.metaType)).toEqual([
      'pending-message',
      'pending-message',
      'pending-message',
    ]);

    s.flush(1000);

    expect(s.api.requestCount('POST', '/gg/conversations/conv-gg-1/messages')).toBe(3);
    expect(chat.chatMessages().map((m) => m.id)).toEqual(['conv-gg-1:hi', 'conv-gg-1:gg', 'conv-gg-1:rematch?']);
    expect(s.liveQueries()).toHaveLength(liveBefore);

    c.destroy();
    legacy.destroy();
  });

  it('aborts and destroys in-flight message queries when the conversation changes', () => {
    const { s, legacy, c, chat, sender, dfbMatchId } = setup();
    const liveBefore = s.liveQueries().length;

    sender.sendMessage('first');
    sender.sendMessage('second');
    s.tick(10);
    expect(s.liveQueries()).toHaveLength(liveBefore + 2);

    dfbMatchId.set('2');
    s.flush(1000);

    expect(chat.chatMessages()).toEqual([]);
    expect(s.liveQueries()).toHaveLength(liveBefore);
    expect(s.api.requests.filter((request) => request.method === 'POST').map((request) => request.aborted)).toEqual([
      true,
      true,
    ]);

    sender.sendMessage('third');
    s.flush(1000);

    expect(chat.chatMessages().map((m) => m.id)).toEqual(['conv-gg-2:third']);
    expect(s.liveQueries()).toHaveLength(liveBefore);

    c.destroy();
    legacy.destroy();
  });

  it('marks a batch of messages as read with one POST per batch', () => {
    const { s, legacy, c, updater } = setup();
    const markAsRead = '/gg/conversations/conv-gg-1/messages/mark-as-read';

    updater.markMessageAsRead('m1');
    s.tick(1000);
    updater.markMessageAsRead('m2', 'm1');
    s.tick(1000);
    updater.markMessageAsRead('m3');
    s.tick(MARK_AS_READ_DELAY + 1000);

    expect(s.api.requestCount('POST', markAsRead)).toBe(1);
    expect(s.api.requests.find((request) => request.path === markAsRead)?.body).toEqual({
      participation: 'p-1',
      messages: ['m1', 'm2', 'm3'],
    });

    for (const id of ['m4', 'm5']) {
      updater.markMessageAsRead(id);
      s.tick(MARK_AS_READ_DELAY + 1000);
    }

    expect(s.api.requestCount('POST', markAsRead)).toBe(3);
    expect(updater.handled.map((batch) => batch.map((m) => m.id))).toEqual([['m1', 'm2', 'm3'], ['m4'], ['m5']]);

    c.destroy();
    legacy.destroy();
  });
});
