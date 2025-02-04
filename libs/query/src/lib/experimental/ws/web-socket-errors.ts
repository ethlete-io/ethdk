import { RuntimeError } from '@ethlete/core';

// codes 1000-1999
export const enum QueryRuntimeErrorCode {
  // Web Socket Client
  ROOM_ALREADY_JOINED = 1000,
  ROOM_NOT_JOINED = 1001,
  MESSAGE_MALFORMED = 1002,
}

export const roomAlreadyJoined = (room: string) => {
  return new RuntimeError(
    QueryRuntimeErrorCode.ROOM_ALREADY_JOINED,
    `Tried joining the room "${room}" but it has already been joined.`,
  );
};

export const roomNotJoined = (room: string) => {
  return new RuntimeError(
    QueryRuntimeErrorCode.ROOM_NOT_JOINED,
    `Tried leaving the room "${room}" but it has not been joined.`,
  );
};

export const messageMalformed = () => {
  return new RuntimeError(
    QueryRuntimeErrorCode.MESSAGE_MALFORMED,
    'A message has been received but it is malformed (cannot be parsed as JSON).',
  );
};
