import { Directive, InjectionToken, Signal, inject } from '@angular/core';

export type StreamPlayerErrorContext = {
  readonly error: Signal<unknown>;
  retry(): void;
};

export const STREAM_PLAYER_ERROR_CONTEXT_TOKEN = new InjectionToken<StreamPlayerErrorContext>(
  'STREAM_PLAYER_ERROR_CONTEXT_TOKEN',
);

export const STREAM_PLAYER_ERROR_TOKEN = new InjectionToken<StreamPlayerErrorDirective>('STREAM_PLAYER_ERROR_TOKEN');

@Directive({
  selector: '[etStreamPlayerError]',
  providers: [{ provide: STREAM_PLAYER_ERROR_TOKEN, useExisting: StreamPlayerErrorDirective }],
})
export class StreamPlayerErrorDirective {
  private context = inject(STREAM_PLAYER_ERROR_CONTEXT_TOKEN);

  error = this.context.error;

  retry() {
    this.context.retry();
  }
}
