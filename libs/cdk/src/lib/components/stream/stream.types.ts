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
  isPlaying: boolean;
  isMuted: boolean;
  isEnded: boolean;
  /** null until the player is ready and duration is available */
  duration: number | null;
  /** null for live streams */
  currentTime: number | null;
};
