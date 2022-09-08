import { VIEWPORT_CONFIG } from '../constants';
import { ViewportConfig } from '../types';

export const provideViewportConfig = (
  viewportConfig: ViewportConfig,
): { provide: typeof VIEWPORT_CONFIG; useValue: typeof viewportConfig } => {
  return { provide: VIEWPORT_CONFIG, useValue: viewportConfig };
};
