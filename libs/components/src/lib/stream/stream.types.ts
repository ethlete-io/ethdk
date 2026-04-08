export type StreamPlayerCapabilities = {
  canPlay: boolean;
  canPause: boolean;
  canMute: boolean;
  canSeek: boolean;
  canGetDuration: boolean;
  isLiveCapable: boolean;
  hasThumbnail: boolean;
};

export type StreamPlayerState = {
  isReady: boolean;
  isLoading: boolean;
  error: null | unknown;
  isPlaying: boolean;
  isMuted: boolean;
  isEnded: boolean;
  /** null until the player is ready and duration is available */
  duration: number | null;
  /** null for live streams */
  currentTime: number | null;
};

export const DEFAULT_STREAM_PLAYER_STATE: StreamPlayerState = {
  isReady: false,
  isLoading: true,
  error: null,
  isPlaying: false,
  isMuted: false,
  isEnded: false,
  duration: null,
  currentTime: null,
};
