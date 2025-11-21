import { clone } from './comparison';

export const RUNTIME_ERROR_NO_DATA = '__ET_NO_DATA__';

export class RuntimeError<T extends number> extends Error {
  constructor(
    public code: T,
    message: null | false | string,
    public devOnly = false,
    public data: unknown = RUNTIME_ERROR_NO_DATA,
  ) {
    super(formatRuntimeError<T>(code, message, devOnly));

    if (data !== RUNTIME_ERROR_NO_DATA) {
      try {
        const _data = clone(data);

        setTimeout(() => {
          console.error(_data);
        }, 1);
      } catch {
        setTimeout(() => {
          console.error(data);
        }, 1);
      }
    }
  }
}

export function formatRuntimeError<T extends number>(
  code: T,
  message: null | false | string,
  devOnly: boolean,
): string {
  // prefix code with zeros if it's less than 100
  const codeWithZeros = code < 10 ? `00${code}` : code < 100 ? `0${code}` : code;

  const fullCode = `ET${codeWithZeros}`;
  const devOnlyText = devOnly ? ' [DEV ONLY] ' : '';
  return `${devOnlyText}${fullCode}${message ? ': ' + message : ''}`;
}
