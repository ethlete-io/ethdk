import { createWebSocketClient } from '../index';
import { createWebSocketTestDouble } from '@ethlete/query/testing';
import { describe, expect, it } from 'vitest';
import { mintToken, Scenario, useScenario } from './harness';

let socketCounter = 0;

const tokenOf = (handshake: object | null | undefined) => (handshake as { token: string | null }).token;

describe('ws auth hunt 2026-10-10', () => {
  const scenario = useScenario({ clientOptions: { keepUnusedFor: 0 } });

  const boot = (s: Scenario, options: { bound: boolean } = { bound: true }) => {
    const auth = s.auth();
    const double = createWebSocketTestDouble();
    const client = createWebSocketClient({
      name: `ws-auth-hunt-${socketCounter++}`,
      url: 'ws://localhost',
      io: double.io,
      authProvider: options.bound ? auth.ref : undefined,
    });
    const instance = s.run(() => client.inject());
    const consumer = s.consumer();

    const login = (sub?: string) => {
      if (sub) {
        s.api.once('POST', '/auth/login', () => ({
          body: { accessToken: mintToken({ claims: { sub } }), refreshToken: mintToken({ expiresInMs: 3600000 }) },
        }));
      }

      consumer.run(() => auth.queries.login.execute({ body: {} }));
      s.tick();
    };

    return { auth, double, instance, consumer, login };
  };

  it('reconnects with the new token when setTokens hands over a pair while authenticated', () => {
    const s = scenario();
    const { auth, double, consumer, login } = boot(s);

    login('x');
    double.serverConnect();
    const connectCalls = double.state().connectCalls;

    auth.setTokens(mintToken({ claims: { sub: 'y' } }), mintToken({ expiresInMs: 3600000 }));
    s.tick();

    expect(double.state().connectCalls).toBe(connectCalls + 1);

    double.serverConnect();
    expect(tokenOf(double.handshakes().at(-1))).toBe(auth.accessToken());

    consumer.destroy();
  });

  it('delivers nothing the previous user emitted while the transport was down to the next session', () => {
    const s = scenario();
    const { auth, double, instance, consumer, login } = boot(s);

    login('x');
    double.serverConnect();
    double.serverDisconnect();

    const privateRoom = s.consumer();
    privateRoom.run(() => instance.joinRoom('private-x'));
    instance.send({ event: 'chat', data: 'hi' });

    auth.logout();
    s.tick();
    login('y');

    const before = double.delivered().length;
    double.serverConnect();
    const delivered = double.delivered().slice(before);

    expect(delivered).not.toContainEqual({ event: 'chat', data: 'hi' });
    expect(delivered.filter((m) => m.event === 'join-room')).toEqual([{ event: 'join-room', data: 'private-x' }]);

    privateRoom.destroy();
    s.tick();
    expect(double.sent().at(-1)).toEqual({ event: 'leave-room', data: 'private-x' });

    consumer.destroy();
  });

  it('sets held rooms to null on logout and re-joins them after the next login', () => {
    const s = scenario();
    const { auth, double, instance, consumer, login } = boot(s);

    login();
    double.serverConnect();

    const lobby = consumer.run(() => instance.joinRoom('lobby'));
    const team = consumer.run(() => instance.joinRoom(() => 'team:1'));
    s.tick();
    const firstLobby = lobby();

    auth.logout();
    s.tick();
    double.serverConnect();

    expect(lobby()).toBeNull();
    expect(team()).toBeNull();

    login();
    double.serverConnect();

    expect(lobby()).not.toBeNull();
    expect(lobby()).not.toBe(firstLobby);
    expect(team()).not.toBeNull();

    const joins = double.delivered().filter((m) => m.event === 'join-room');
    expect(joins.slice(-2).map((m) => m.data)).toEqual(['lobby', 'team:1']);

    double.serverSend({ room: 'lobby', event: 'score', data: 1 });
    s.tick();
    expect(lobby()?.latestMessage()).toEqual({ room: 'lobby', event: 'score', data: 1 });

    consumer.destroy();
  });

  it('joins a room after a logout on the anonymous connection, like a fresh anonymous page load', () => {
    const s = scenario();
    const { auth, double, instance, consumer, login } = boot(s);

    login();
    double.serverConnect();
    const connectCalls = double.state().connectCalls;

    auth.logout();
    s.tick();
    expect(double.state().connectCalls).toBe(connectCalls + 1);
    double.serverConnect();

    const publicRoom = consumer.run(() => instance.joinRoom('public'));

    expect(instance.isConnected()).toBe(true);
    expect(tokenOf(double.handshakes().at(-1))).toBeNull();
    expect(publicRoom()).not.toBeNull();
    expect(double.delivered().at(-1)).toEqual({ event: 'join-room', data: 'public' });

    consumer.destroy();
  });

  it('keeps a client without an auth provider connected, joined and buffering across logout and login', () => {
    const s = scenario();
    const { auth, double, instance, consumer, login } = boot(s, { bound: false });

    double.serverConnect();
    const room = consumer.run(() => instance.joinRoom('scores'));
    const joined = room();

    login('x');
    double.serverDisconnect();
    instance.send({ event: 'ping', data: 1 });

    auth.logout();
    s.tick();
    login('y');

    expect(double.state()).toMatchObject({ connectCalls: 1, disconnected: false });
    expect(room()).toBe(joined);

    double.serverConnect();
    expect(double.delivered()).toContainEqual({ event: 'ping', data: 1 });
    expect(double.handshakes()).toEqual([null, null]);
    expect(double.delivered().filter((m) => m.event === 'join-room')).toHaveLength(2);

    consumer.destroy();
  });
});
