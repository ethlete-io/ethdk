import { extractHtmlErrorMessage, htmlErrorPayload, isHtmlErrorPayload } from './query-error-html-utils';

const MAINTENANCE_PAGE = `<!DOCTYPE html> <html lang="en"> <head> <meta charset="UTF-8"> <title>Service Temporarily Unavailable</title> <style> body { font-family: sans-serif; background-color: rgb(2,2,2); } h1 { font-size: 1.6rem; } </style> </head> <body> <div class="container"> <h1>Service Temporarily Unavailable</h1> <p>We're sorry &mdash; the server is currently restarting and will be back shortly.<br> Please try again in a few minutes.</p> </div> </body> </html>`;

describe('isHtmlErrorPayload', () => {
  it('should detect a document', () => {
    expect(isHtmlErrorPayload(MAINTENANCE_PAGE)).toBe(true);
    expect(isHtmlErrorPayload('<html><body>nope</body></html>')).toBe(true);
  });

  it('should detect a fragment with a balanced pair', () => {
    expect(isHtmlErrorPayload('<h1>Bad Gateway</h1>')).toBe(true);
    expect(isHtmlErrorPayload('<div><p>Bad Gateway</p></div>')).toBe(true);
  });

  it('should not treat a plain message as markup', () => {
    expect(isHtmlErrorPayload('value must be < 5')).toBe(false);
    expect(isHtmlErrorPayload('line one<br>line two')).toBe(false);
    expect(isHtmlErrorPayload('the <p> tag is not allowed here')).toBe(false);
  });

  it('should ignore non string values', () => {
    expect(isHtmlErrorPayload(null)).toBe(false);
    expect(isHtmlErrorPayload({ message: '<h1>hi</h1>' })).toBe(false);
  });
});

describe('htmlErrorPayload', () => {
  it('should return a raw string body', () => {
    expect(htmlErrorPayload(MAINTENANCE_PAGE)).toBe(MAINTENANCE_PAGE);
  });

  it('should unwrap the xhr json parse failure shape', () => {
    const body = { error: new SyntaxError('Unexpected token <'), text: MAINTENANCE_PAGE };

    expect(htmlErrorPayload(body)).toBe(MAINTENANCE_PAGE);
  });

  it('should return null for anything that is not an error page', () => {
    expect(htmlErrorPayload('service unavailable')).toBeNull();
    expect(htmlErrorPayload({ message: 'service unavailable' })).toBeNull();
    expect(htmlErrorPayload({ text: 'service unavailable' })).toBeNull();
    expect(htmlErrorPayload(null)).toBeNull();
    expect(htmlErrorPayload(undefined)).toBeNull();
  });
});

describe('extractHtmlErrorMessage', () => {
  it('should combine the heading and the paragraph of an error page', () => {
    expect(extractHtmlErrorMessage(MAINTENANCE_PAGE)).toBe(
      "Service Temporarily Unavailable: We're sorry - the server is currently restarting and will be back shortly. Please try again in a few minutes.",
    );
  });

  it('should not leak css or script contents', () => {
    const message = extractHtmlErrorMessage(MAINTENANCE_PAGE)!;

    expect(message).not.toContain('font-family');
    expect(message).not.toContain('rgb(');
    expect(extractHtmlErrorMessage('<body><script>alert(1)</script><h1>Oops</h1></body>')).toBe('Oops');
  });

  it('should never contain markup', () => {
    expect(extractHtmlErrorMessage(MAINTENANCE_PAGE)).not.toMatch(/[<>]/);
  });

  it('should keep escaped markup escaped as text', () => {
    expect(extractHtmlErrorMessage('<h1>Invalid input: &lt;script&gt;</h1>')).toBe('Invalid input: <script>');
  });

  it('should fall back to the title when there is no heading', () => {
    const html = '<html><head><title>504 Gateway Timeout</title></head><body><div></div></body></html>';

    expect(extractHtmlErrorMessage(html)).toBe('504 Gateway Timeout');
  });

  it('should prefer the heading over the title', () => {
    const html = '<html><head><title>Error</title></head><body><h1>502 Bad Gateway</h1></body></html>';

    expect(extractHtmlErrorMessage(html)).toBe('502 Bad Gateway');
  });

  it('should parse a typical nginx page', () => {
    const html =
      '<html><head><title>502 Bad Gateway</title></head><body><center><h1>502 Bad Gateway</h1></center><hr><center>nginx</center></body></html>';

    expect(extractHtmlErrorMessage(html)).toBe('502 Bad Gateway');
  });

  it('should skip a paragraph that repeats the heading', () => {
    const html = '<body><h1>Not Found</h1><p>Not Found</p><p>The page does not exist.</p></body>';

    expect(extractHtmlErrorMessage(html)).toBe('Not Found: The page does not exist.');
  });

  it('should use a space when the heading is already a sentence', () => {
    const html = '<body><h1>Something went wrong.</h1><p>Please try again.</p></body>';

    expect(extractHtmlErrorMessage(html)).toBe('Something went wrong. Please try again.');
  });

  it('should fall back to the flattened body text', () => {
    const html = '<html><body><div><span>Upstream connect error</span></div></body></html>';

    expect(extractHtmlErrorMessage(html)).toBe('Upstream connect error');
  });

  it('should truncate a very long message', () => {
    const message = extractHtmlErrorMessage(`<body><p>${'a'.repeat(500)}</p></body>`)!;

    expect(message).toHaveLength(300);
    expect(message.endsWith('…')).toBe(true);
  });

  it('should decode numeric entities', () => {
    expect(extractHtmlErrorMessage('<h1>Caf&#233; &#x2014; closed</h1>')).toBe('Café - closed');
  });

  it('should leave an out of range entity untouched', () => {
    expect(extractHtmlErrorMessage('<h1>&#xFFFFFFF; broken</h1>')).toBe('&#xFFFFFFF; broken');
  });

  it('should return null for a page without readable text', () => {
    expect(extractHtmlErrorMessage('<html><head><style>body{color:red}</style></head><body></body></html>')).toBeNull();
  });
});
