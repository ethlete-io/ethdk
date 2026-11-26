import { ErrorHandler, inject } from '@angular/core';

/**
 * Returns a function that hands a configuration error to the app's `ErrorHandler`. Use it where a
 * throw would escape change detection (a computed, an effect, a template binding): report, then
 * render nothing. Call in an injection context.
 */
export const injectReportError = () => {
  const errorHandler = inject(ErrorHandler);

  return (error: unknown) => errorHandler.handleError(error);
};
