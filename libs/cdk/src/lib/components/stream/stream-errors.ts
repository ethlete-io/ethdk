import { RuntimeError } from '@ethlete/core';

export const STREAM_ERROR_CODES = {
  missing_consent_token: 1600,
} as const;

export const streamError = (code: keyof typeof STREAM_ERROR_CODES, message: string, devOnly: boolean) => {
  throw new RuntimeError(STREAM_ERROR_CODES[code], message, devOnly);
};
