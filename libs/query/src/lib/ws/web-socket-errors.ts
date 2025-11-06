import { RuntimeError } from '@ethlete/core';

// codes 1000-1999
export const WebSocketRuntimeErrorCode = {
  // Web Socket Client
  ROOM_NOT_JOINED: 1000,
  MESSAGE_MALFORMED: 1001,
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
    'A message has been received but it is malformed (cannot be parsed as JSON).',
  );
};
