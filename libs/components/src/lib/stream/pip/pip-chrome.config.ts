export type StreamPipChromeConfig = {
  /**
   * Optional color key applied to built-in PiP titlebar controls.
   * Uses the button's neutral fallback styling when omitted.
   */
  controlsColor?: string;
};

export const DEFAULT_PIP_CHROME_CONFIG: StreamPipChromeConfig = {
  controlsColor: undefined,
};
