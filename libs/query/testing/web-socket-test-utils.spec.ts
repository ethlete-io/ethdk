import { createWebSocketTestDouble } from './web-socket-test-utils';

describe('createWebSocketTestDouble', () => {
  it('reports null for withCredentials until the client called the factory', () => {
    const double = createWebSocketTestDouble();

    expect(double.withCredentials()).toBeNull();
  });

  it('records the withCredentials the client asked the factory for', () => {
    const double = createWebSocketTestDouble();

    double.io('ws://localhost', { withCredentials: true, autoConnect: false, transports: undefined });

    expect(double.withCredentials()).toBe(true);
  });

  it('records a factory call that opted out of credentials', () => {
    const double = createWebSocketTestDouble();

    double.io('ws://localhost', { withCredentials: false, autoConnect: false, transports: ['websocket'] });

    expect(double.withCredentials()).toBe(false);
    expect(double.connection()).toEqual({ url: 'ws://localhost', transports: ['websocket'] });
  });
});
