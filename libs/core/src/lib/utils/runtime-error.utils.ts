import { clone } from './clone.util';

export class RuntimeError<T extends number> extends Error {
  constructor(public code: T, message: null | false | string, public data: unknown = '__ET_NO_DATA__') {
    super(formatRuntimeError<T>(code, message));

    if (data !== '__ET_NO_DATA__') {
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

export function formatRuntimeError<T extends number>(code: T, message: null | false | string): string {
  // prefix code with zeros if it's less than 100
  const codeWithZeros = code < 10 ? `00${code}` : code < 100 ? `0${code}` : code;

  const fullCode = `ET${codeWithZeros}`;

  return `${fullCode}${message ? ': ' + message : ''}`;
}
