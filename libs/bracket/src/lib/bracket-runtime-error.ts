/**
 * The error every `@ethlete/bracket` engine function throws for a malformed source. `code` is one of
 * {@link BRACKET_ERROR_CODES}; the message starts with `ET<code>: `.
 */
export class BracketRuntimeError extends Error {
  public readonly code: number;

  constructor(code: number, message: string) {
    super(`ET${code}: ${message}`);
    this.name = 'BracketRuntimeError';
    this.code = code;
  }
}
