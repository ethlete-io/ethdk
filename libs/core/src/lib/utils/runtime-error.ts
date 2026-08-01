export const RUNTIME_ERROR_NO_DATA = '__ET_NO_DATA__';

export class RuntimeError<T extends number> extends Error {
  constructor(
    public code: T,
    message: null | false | string,
    public data: unknown = RUNTIME_ERROR_NO_DATA,
  ) {
    super(formatRuntimeError<T>(code, message));

    if (data !== RUNTIME_ERROR_NO_DATA) {
      // deferred so the error itself is logged first - consoles render the live object, so a
      // mutation after the throw is visible in the log
      setTimeout(() => {
        console.error(data);
      }, 1);
    }
  }
}

export function formatRuntimeError<T extends number>(code: T, message: null | false | string): string {
  // prefix code with zeros if it's less than 100
  const codeWithZeros = code < 10 ? `00${code}` : code < 100 ? `0${code}` : code;

  const fullCode = `ET${codeWithZeros}`;
  return `${fullCode}${message ? ': ' + message : ''}`;
}
