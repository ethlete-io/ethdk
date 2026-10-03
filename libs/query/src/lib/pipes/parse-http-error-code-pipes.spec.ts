import { HttpStatusCode } from '@angular/common/http';
import { ParseHttpErrorCodeToMessageDePipe, ParseHttpErrorCodeToTitleDePipe } from './parse-http-error-code-de.pipe';
import { ParseHttpErrorCodeToMessageEnPipe, ParseHttpErrorCodeToTitleEnPipe } from './parse-http-error-code-en.pipe';

const pipes = {
  titleDe: new ParseHttpErrorCodeToTitleDePipe(),
  messageDe: new ParseHttpErrorCodeToMessageDePipe(),
  titleEn: new ParseHttpErrorCodeToTitleEnPipe(),
  messageEn: new ParseHttpErrorCodeToMessageEnPipe(),
};

const transformAll = (status: unknown) => Object.values(pipes).map((pipe) => pipe.transform(status as HttpStatusCode));

describe('parse http error code pipes', () => {
  const fallback = transformAll(0);

  it.each([null, undefined, Number.NaN, -1, 1000])(
    'renders the generic text for %s, the status of a loading or error-free query',
    (status) => {
      expect(transformAll(status)).toEqual(fallback);
    },
  );

  it('renders the generic text for a status that is not a number', () => {
    expect(transformAll('404')).toEqual(fallback);
  });

  it('gives each pipe its own text for a known status', () => {
    const texts = transformAll(HttpStatusCode.NotFound);

    expect(texts).toEqual(['Nicht gefunden', expect.any(String), 'Not found', expect.any(String)]);
    expect(new Set(texts).size).toBe(4);
    expect(texts).not.toEqual(fallback);
  });

  it('is pure: the same status yields the same text on every call', () => {
    expect(transformAll(HttpStatusCode.TooManyRequests)).toEqual(transformAll(HttpStatusCode.TooManyRequests));
  });
});
