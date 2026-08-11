/**
 * Drops output from one `console` method for the rest of the current test, for a spec that drives a
 * path the SDK logs about on purpose. Call it inside the `it` (or a `beforeEach`); the real method is
 * restored when the test finishes, so an unexpected log in the next one still prints.
 */
export const silenceExpectedConsole = (method: 'error' | 'log' | 'warn') => {
  const spy = vi.spyOn(console, method).mockImplementation(() => undefined);

  onTestFinished(() => spy.mockRestore());
};
