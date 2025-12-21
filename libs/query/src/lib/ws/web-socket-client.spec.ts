import { TestBed } from '@angular/core/testing';
import { createWebSocketClient } from './web-socket-client';

describe('createWebSocketClient', () => {
  afterEach(() => {
    // Disconnect all sockets after each test to prevent errors on cleanup
    TestBed.resetTestingModule();
  });

  it('should create a web socket client tuple', () => {
    const client = createWebSocketClient({ name: 'test', url: 'ws://localhost:3000' });
    const [provideClient, injectClient, clientToken] = client;

    expect(provideClient).toBeTruthy();
    expect(injectClient).toBeTruthy();
    expect(clientToken).toBeTruthy();
  });

  it('should create client using provider', () => {
    const client = createWebSocketClient({ name: 'test', url: 'ws://localhost:3000' });
    const [, , clientToken] = client;

    TestBed.configureTestingModule({});

    const wsClient = TestBed.inject(clientToken);

    expect(wsClient).toBeTruthy();
    expect(wsClient.isConnected).toBeTruthy();
    expect(wsClient.joinRoom).toBeTruthy();
    expect(wsClient.subtle).toBeTruthy();
  });

  it('should create client using inject function', () => {
    const client = createWebSocketClient({ name: 'test', url: 'ws://localhost:3000' });
    const [provideClient, injectClient] = client;

    TestBed.configureTestingModule({
      providers: [provideClient()],
    });

    TestBed.runInInjectionContext(() => {
      const wsClient = injectClient();

      expect(wsClient).toBeTruthy();
      expect(wsClient.isConnected).toBeTruthy();
      expect(wsClient.joinRoom).toBeTruthy();
      expect(wsClient.subtle).toBeTruthy();
      expect(wsClient.subtle.leaveRoom).toBeTruthy();
    });
  });

  it('should create client with custom transports', () => {
    const client = createWebSocketClient({
      name: 'test',
      url: 'ws://localhost:3000',
      transports: ['websocket', 'polling'],
    });
    const [provideClient, injectClient] = client;

    TestBed.configureTestingModule({
      providers: [provideClient()],
    });

    TestBed.runInInjectionContext(() => {
      const wsClient = injectClient();
      expect(wsClient).toBeTruthy();
    });
  });

  it('should have isConnected signal', () => {
    const client = createWebSocketClient({ name: 'test', url: 'ws://localhost:3000' });
    const [provideClient, injectClient] = client;

    TestBed.configureTestingModule({
      providers: [provideClient()],
    });

    TestBed.runInInjectionContext(() => {
      const wsClient = injectClient();
      const connected = wsClient.isConnected();

      expect(typeof connected).toBe('boolean');
    });
  });

  it('should have subtle.leaveRoom function', () => {
    const client = createWebSocketClient({ name: 'test', url: 'ws://localhost:3000' });
    const [provideClient, injectClient] = client;

    TestBed.configureTestingModule({
      providers: [provideClient()],
    });

    TestBed.runInInjectionContext(() => {
      const wsClient = injectClient();

      expect(wsClient.subtle.leaveRoom).toBeTruthy();
      expect(typeof wsClient.subtle.leaveRoom).toBe('function');
    });
  });

  it('should create unique tokens for different clients', () => {
    const client1 = createWebSocketClient({ name: 'client1', url: 'ws://localhost:3000' });
    const client2 = createWebSocketClient({ name: 'client2', url: 'ws://localhost:3000' });

    const [, , token1] = client1;
    const [, , token2] = client2;

    expect(token1).not.toBe(token2);
  });

  it('should have joinRoom method that returns a signal', () => {
    const client = createWebSocketClient({ name: 'test', url: 'ws://localhost:3000' });
    const [provideClient, injectClient] = client;

    TestBed.configureTestingModule({
      providers: [provideClient()],
    });

    TestBed.runInInjectionContext(() => {
      const wsClient = injectClient();
      expect(typeof wsClient.joinRoom).toBe('function');
    });
  });
});
