import { InjectionToken } from '@angular/core';
import { SocketMessageView, WebSocketClient } from './web-socket-client';

export type CreateWebSocketClientConfig = {
  name: string;
  url: string;
};

export type WebSocketClientRef<T extends SocketMessageView = SocketMessageView> = InjectionToken<WebSocketClient<T>>;

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
