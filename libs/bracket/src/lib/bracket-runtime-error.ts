export class BracketRuntimeError extends Error {
  constructor(code: number, message: string) {
    super(`ET${code}: ${message}`);
    this.name = 'BracketRuntimeError';
  }
}
