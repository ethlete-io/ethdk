import { InjectionToken } from '@angular/core';
import { SocketMessageView, WebSocketClient } from './web-socket-client';

export type CreateWebSocketClientTransport = 'polling' | 'websocket' | 'webtransport';

export type CreateWebSocketClientConfig = {
  /** A unique name for the client */
  name: string;

  /** The URL of the socket io server */
  url: string;

  /** A list of transports to try (in order). Engine.io always attempts to connect directly with the first one, provided the feature detection test for it passes. */
  transports?: CreateWebSocketClientTransport[];
};

export type WebSocketClientRef<TMessageData extends SocketMessageView = SocketMessageView> = InjectionToken<
  WebSocketClient<TMessageData>
>;

export type WebSocketClientConfig = CreateWebSocketClientConfig & {
  /** A generated token for dependency injection */
  token: WebSocketClientRef;
};

export const createWebSocketClientConfig = (options: CreateWebSocketClientConfig) => {
  const token = new InjectionToken<WebSocketClientConfig>(`WebSocketClient_${options.name}`);

  const clientConfig: WebSocketClientConfig = {
    token,
    name: options.name,
    url: options.url,
  };

  return clientConfig;
};
