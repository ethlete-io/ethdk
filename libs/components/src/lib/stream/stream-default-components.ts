import { StreamPlayerErrorComponent } from './error/stream-player-error.component';
import { StreamPlayerLoadingComponent } from './loading/stream-player-loading.component';
import { StreamConfig } from './stream-config';

/**
 * The shipped loading and error overlays, to spread into `provideStreamConfig`. An app that draws only
 * overlays of its own leaves this out and bundles neither.
 *
 * @example
 * provideStreamConfig({ ...STREAM_DEFAULT_COMPONENTS });
 */
export const STREAM_DEFAULT_COMPONENTS = {
  loadingComponent: StreamPlayerLoadingComponent,
  errorComponent: StreamPlayerErrorComponent,
} satisfies Partial<StreamConfig>;
