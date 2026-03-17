export type YtWindow = Window & {
  YT: {
    Player: new (elementOrId: HTMLElement | string, config: YtPlayerConfig) => YtPlayer;
    PlayerState: {
      UNSTARTED: -1;
      ENDED: 0;
      PLAYING: 1;
      PAUSED: 2;
      BUFFERING: 3;
      CUED: 5;
    };
    ready(callback: () => void): void;
  };
  onYouTubeIframeAPIReady?: () => void;
};

export type YtPlayerConfig = {
  width?: string | number;
  height?: string | number;
  videoId?: string;
  playerVars?: YtPlayerVars;
  events?: {
    onReady?: (event: YtPlayerEvent) => void;
    onStateChange?: (event: YtPlayerStateChangeEvent) => void;
    onError?: (event: YtPlayerErrorEvent) => void;
  };
};

export type YtPlayerVars = {
  autoplay?: 0 | 1;
  controls?: 0 | 1 | 2;
  rel?: 0 | 1;
  modestbranding?: 0 | 1;
  start?: number;
  mute?: 0 | 1;
  enablejsapi?: 0 | 1;
  origin?: string;
  [key: string]: unknown;
};

export type YtPlayer = {
  playVideo(): void;
  pauseVideo(): void;
  stopVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  getPlayerState(): number;
  getCurrentTime(): number;
  getDuration(): number;
  cueVideoById(videoId: string, startSeconds?: number): void;
  loadVideoById(videoId: string, startSeconds?: number): void;
  destroy(): void;
};

export type YtPlayerEvent = {
  target: YtPlayer;
};

export type YtPlayerStateChangeEvent = {
  target: YtPlayer;
  data: number;
};

export type YtPlayerErrorEvent = {
  target: YtPlayer;
  data: number;
};
