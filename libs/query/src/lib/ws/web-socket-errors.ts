import { RuntimeError } from '@ethlete/core';

// codes 1000-1999
export const WebSocketRuntimeErrorCode = {
  // Web Socket Client
  ROOM_NOT_JOINED: 1000,
  MESSAGE_MALFORMED: 1001,
  AUTH_AND_AUTH_PROVIDER: 1002,
} as const;

export type WebSocketRuntimeErrorCode = (typeof WebSocketRuntimeErrorCode)[keyof typeof WebSocketRuntimeErrorCode];

export const roomNotJoined = (room: string) => {
  return new RuntimeError(
    WebSocketRuntimeErrorCode.ROOM_NOT_JOINED,
    `Tried leaving the room "${room}" but it has not been joined.`,
  );
};

export const messageMalformed = () => {
  return new RuntimeError(
    WebSocketRuntimeErrorCode.MESSAGE_MALFORMED,
    'A message has been received but it is malformed. Expected a JSON string shaped like { room: string; event: string; data: unknown }.',
  );
};

export const authAndAuthProvider = (name: string) => {
  return new RuntimeError(
    WebSocketRuntimeErrorCode.AUTH_AND_AUTH_PROVIDER,
    `The web socket client "${name}" sets both \`auth\` and \`authProvider\`. \`authProvider\` sends the access token itself, so \`auth\` is ignored. Remove one of them.`,
  );
};
